import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * WebSocket Gateway for real-time updates
 * Handles real-time portfolio, price, and trade updates
 */
@WebSocketGateway({
    cors: {
        origin: '*', // Configure properly in production
    },
})
export class WebsocketGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WebsocketGateway.name);

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
     * Subscribe to stock price updates
     */
    @SubscribeMessage('subscribe-stock')
    handleSubscribeStock(
        @MessageBody() stockId: string,
        @ConnectedSocket() client: Socket,
    ) {
        client.join(`stock-${stockId}`);
        this.logger.log(`Client ${client.id} subscribed to stock ${stockId}`);
        return { event: 'subscribed', data: { stockId } };
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
}
