import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { KisWebsocketService, RealTimePrice, RealTimeOrderbook, RealTimeExecution } from '../market-data/kis-websocket.service';

/**
 * WebSocket Gateway for real-time updates
 * Handles real-time portfolio, price, and trade updates
 * Integrates with KIS WebSocket for live market data
 */
@WebSocketGateway({
    cors: {
        origin: '*', // Configure properly in production
    },
})
export class WebsocketGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WebsocketGateway.name);

    constructor(private kisWebsocketService: KisWebsocketService) {}

    afterInit() {
        this.logger.log('WebSocket Gateway initialized');
        
        // 서버 시작 시 KIS WebSocket 연결
        this.kisWebsocketService.connect().catch(err => {
            this.logger.warn('Failed to connect to KIS WebSocket on startup', err);
        });
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    /**
     * Subscribe to portfolio updates
     */
    @SubscribeMessage('subscribe-portfolio')
    handleSubscribePortfolio(
        @MessageBody() portfolioId: string,
        @ConnectedSocket() client: Socket,
    ) {
        client.join(`portfolio-${portfolioId}`);
        this.logger.log(`Client ${client.id} subscribed to portfolio ${portfolioId}`);
        return { event: 'subscribed', data: { portfolioId } };
    }

    /**
     * Unsubscribe from portfolio updates
     */
    @SubscribeMessage('unsubscribe-portfolio')
    handleUnsubscribePortfolio(
        @MessageBody() portfolioId: string,
        @ConnectedSocket() client: Socket,
    ) {
        client.leave(`portfolio-${portfolioId}`);
        this.logger.log(`Client ${client.id} unsubscribed from portfolio ${portfolioId}`);
        return { event: 'unsubscribed', data: { portfolioId } };
    }

    /**
     * Subscribe to stock price updates (also triggers KIS WebSocket subscription)
     */
    @SubscribeMessage('subscribe-stock')
    async handleSubscribeStock(
        @MessageBody() stockSymbol: string,
        @ConnectedSocket() client: Socket,
    ) {
        client.join(`stock-${stockSymbol}`);
        this.logger.log(`Client ${client.id} subscribed to stock ${stockSymbol}`);

        // KIS WebSocket에 실시간 체결가 구독 요청
        try {
            if (this.kisWebsocketService.isWebSocketConnected()) {
                await this.kisWebsocketService.subscribePrice(stockSymbol);
            }
        } catch (error) {
            this.logger.warn(`Failed to subscribe KIS realtime for ${stockSymbol}`, error);
        }

        return { event: 'subscribed', data: { stockSymbol } };
    }

    /**
     * Unsubscribe from stock price updates
     */
    @SubscribeMessage('unsubscribe-stock')
    async handleUnsubscribeStock(
        @MessageBody() stockSymbol: string,
        @ConnectedSocket() client: Socket,
    ) {
        client.leave(`stock-${stockSymbol}`);
        this.logger.log(`Client ${client.id} unsubscribed from stock ${stockSymbol}`);

        // Check if any clients still subscribed
        const room = this.server.sockets.adapter.rooms.get(`stock-${stockSymbol}`);
        if (!room || room.size === 0) {
            try {
                await this.kisWebsocketService.unsubscribe('H0STCNT0', stockSymbol);
            } catch (error) {
                this.logger.warn(`Failed to unsubscribe KIS realtime for ${stockSymbol}`);
            }
        }

        return { event: 'unsubscribed', data: { stockSymbol } };
    }

    /**
     * Subscribe to orderbook updates
     */
    @SubscribeMessage('subscribe-orderbook')
    async handleSubscribeOrderbook(
        @MessageBody() stockSymbol: string,
        @ConnectedSocket() client: Socket,
    ) {
        client.join(`orderbook-${stockSymbol}`);
        
        try {
            if (this.kisWebsocketService.isWebSocketConnected()) {
                await this.kisWebsocketService.subscribeOrderbook(stockSymbol);
            }
        } catch (error) {
            this.logger.warn(`Failed to subscribe KIS orderbook for ${stockSymbol}`);
        }

        return { event: 'subscribed', data: { stockSymbol, type: 'orderbook' } };
    }

    /**
     * Event handler: KIS 실시간 체결가 수신
     */
    @OnEvent('kis.realtime.price')
    handleKisRealtimePrice(price: RealTimePrice) {
        this.server.to(`stock-${price.symbol}`).emit('price-update', {
            symbol: price.symbol,
            price: price.price,
            change: price.change,
            changeRate: price.changeRate,
            volume: price.volume,
            timestamp: price.timestamp,
        });
    }

    /**
     * Event handler: KIS 실시간 호가 수신
     */
    @OnEvent('kis.realtime.orderbook')
    handleKisRealtimeOrderbook(orderbook: RealTimeOrderbook) {
        this.server.to(`orderbook-${orderbook.symbol}`).emit('orderbook-update', {
            symbol: orderbook.symbol,
            asks: orderbook.asks,
            bids: orderbook.bids,
            timestamp: orderbook.timestamp,
        });
    }

    /**
     * Event handler: KIS 체결 통보 수신
     */
    @OnEvent('kis.realtime.execution')
    handleKisRealtimeExecution(execution: RealTimeExecution) {
        // 사용자별로 체결 통보 전송 (userId room 사용)
        this.server.emit('execution-update', {
            symbol: execution.symbol,
            orderNumber: execution.orderNumber,
            side: execution.side,
            quantity: execution.quantity,
            price: execution.price,
            filledQuantity: execution.filledQuantity,
            status: execution.status,
            timestamp: execution.timestamp,
        });
    }

    /**
     * Emit portfolio update to all subscribers
     */
    emitPortfolioUpdate(portfolioId: string, data: any) {
        this.server.to(`portfolio-${portfolioId}`).emit('portfolio-update', data);
    }

    /**
     * Emit stock price update to all subscribers
     */
    emitStockPriceUpdate(stockId: string, data: any) {
        this.server.to(`stock-${stockId}`).emit('price-update', data);
    }

    /**
     * Emit trade update
     */
    emitTradeUpdate(userId: string, data: any) {
        this.server.to(`user-${userId}`).emit('trade-update', data);
    }

    /**
     * Broadcast market summary
     */
    broadcastMarketSummary(data: any) {
        this.server.emit('market-summary', data);
    }

    /**
     * Get KIS WebSocket connection status
     */
    @SubscribeMessage('kis-status')
    handleKisStatus() {
        return {
            connected: this.kisWebsocketService.isWebSocketConnected(),
            subscriptions: Object.fromEntries(this.kisWebsocketService.getSubscriptions()),
        };
    }
}

