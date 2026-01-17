/**
 * Real-time WebSocket Gateway
 * 클라이언트에 실시간 데이터 전송을 위한 WebSocket 게이트웨이
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { RealTimeEventHandler, RealTimePnL, PriceAlert } from './realtime-event-handler.service';
import { KisWebsocketService, RealTimePrice, RealTimeExecution } from './kis-websocket.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/trading',
})
export class RealTimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealTimeGateway.name);

  // 사용자별 소켓 연결 관리
  private userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
  
  // 종목별 구독자 관리
  private symbolSubscribers = new Map<string, Set<string>>(); // symbol -> Set<socketId>

  constructor(
    private jwtService: JwtService,
    private realTimeEventHandler: RealTimeEventHandler,
    private kisWebsocketService: KisWebsocketService,
  ) {}

  /**
   * 클라이언트 연결
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      // JWT 인증
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      
      if (token) {
        const payload = this.jwtService.verify(token);
        const userId = payload.sub as string;
        client.userId = userId;
        
        // 사용자 소켓 등록
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(client.id);

        // 실시간 PnL 활성화
        this.realTimeEventHandler.activateUser(userId);

        this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
      } else {
        this.logger.warn(`Unauthenticated connection: ${client.id}`);
      }
    } catch (error: any) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * 클라이언트 연결 해제
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.userId) {
      const userSocketSet = this.userSockets.get(client.userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(client.userId);
          this.realTimeEventHandler.deactivateUser(client.userId);
        }
      }
    }

    // 종목 구독 해제
    for (const [symbol, subscribers] of this.symbolSubscribers) {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.symbolSubscribers.delete(symbol);
        // KIS WebSocket 구독도 해제할 수 있음
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * 종목 구독 요청
   */
  @SubscribeMessage('subscribe:price')
  async handleSubscribePrice(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { symbols: string[] },
  ): Promise<void> {
    for (const symbol of data.symbols) {
      // 구독자 등록
      if (!this.symbolSubscribers.has(symbol)) {
        this.symbolSubscribers.set(symbol, new Set());
        // KIS WebSocket 구독
        await this.realTimeEventHandler.subscribeSymbol(symbol);
      }
      this.symbolSubscribers.get(symbol)!.add(client.id);

      // 클라이언트를 해당 symbol room에 추가
      client.join(`price:${symbol}`);
    }

    client.emit('subscribed', { symbols: data.symbols });
    this.logger.log(`Client ${client.id} subscribed to: ${data.symbols.join(', ')}`);
  }

  /**
   * 종목 구독 해제
   */
  @SubscribeMessage('unsubscribe:price')
  async handleUnsubscribePrice(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { symbols: string[] },
  ): Promise<void> {
    for (const symbol of data.symbols) {
      const subscribers = this.symbolSubscribers.get(symbol);
      if (subscribers) {
        subscribers.delete(client.id);
        if (subscribers.size === 0) {
          this.symbolSubscribers.delete(symbol);
          await this.realTimeEventHandler.unsubscribeSymbol(symbol);
        }
      }
      client.leave(`price:${symbol}`);
    }

    client.emit('unsubscribed', { symbols: data.symbols });
  }

  /**
   * 실시간 가격 이벤트 브로드캐스트
   */
  @OnEvent('realtime.price')
  handlePriceEvent(data: { symbol: string; price: number; volume: number; timestamp: Date }): void {
    this.server.to(`price:${data.symbol}`).emit('price:update', data);
  }

  /**
   * 실시간 PnL 이벤트 전송
   */
  @OnEvent('realtime.pnl')
  handlePnLEvent(data: RealTimePnL): void {
    const userSocketSet = this.userSockets.get(data.userId);
    if (userSocketSet) {
      for (const socketId of userSocketSet) {
        this.server.to(socketId).emit('pnl:update', data);
      }
    }
  }

  /**
   * 체결 통보 이벤트 전송
   */
  @OnEvent('trade.executed')
  handleTradeExecutedEvent(data: {
    orderNumber: string;
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    status: string;
    timestamp: Date;
  }): void {
    // 해당 종목 구독자들에게 전송
    this.server.to(`price:${data.symbol}`).emit('trade:executed', data);
  }

  /**
   * 가격 급등락 알림 전송
   */
  @OnEvent('alert.price-spike')
  handlePriceSpikeEvent(alert: PriceAlert): void {
    // 해당 종목 구독자들에게 전송
    this.server.to(`price:${alert.symbol}`).emit('alert:price-spike', alert);
    
    // 전체 알림 채널에도 전송
    this.server.emit('alert:global', {
      type: alert.alertType,
      symbol: alert.symbol,
      message: `${alert.symbol} ${alert.changePercent > 0 ? '급등' : '급락'} ${alert.changePercent.toFixed(2)}%`,
      timestamp: alert.timestamp,
    });
  }

  /**
   * 자동매매 세션 시작 알림
   */
  @OnEvent('auto-trading.started')
  handleAutoTradingStarted(data: { userId: string; session: any }): void {
    const userSocketSet = this.userSockets.get(data.userId);
    if (userSocketSet) {
      for (const socketId of userSocketSet) {
        this.server.to(socketId).emit('auto-trading:started', data.session);
      }
    }
  }

  /**
   * 자동매매 세션 중지 알림
   */
  @OnEvent('auto-trading.stopped')
  handleAutoTradingStopped(data: { userId: string }): void {
    const userSocketSet = this.userSockets.get(data.userId);
    if (userSocketSet) {
      for (const socketId of userSocketSet) {
        this.server.to(socketId).emit('auto-trading:stopped', {});
      }
    }
  }

  /**
   * 주문 제출 알림
   */
  @OnEvent('order.submitted')
  handleOrderSubmitted(data: { userId: string; trade: any }): void {
    const userSocketSet = this.userSockets.get(data.userId);
    if (userSocketSet) {
      for (const socketId of userSocketSet) {
        this.server.to(socketId).emit('order:submitted', data.trade);
      }
    }
  }

  /**
   * 리스크 알림
   */
  @OnEvent('risk.emergency-liquidation')
  handleEmergencyLiquidation(data: { userId: string; reason: string; result: any }): void {
    const userSocketSet = this.userSockets.get(data.userId);
    if (userSocketSet) {
      for (const socketId of userSocketSet) {
        this.server.to(socketId).emit('risk:emergency-liquidation', {
          reason: data.reason,
          result: data.result,
        });
      }
    }
  }

  /**
   * 서킷 브레이커 상태 변경 알림
   */
  @OnEvent('audit.critical')
  handleAuditCritical(data: { userId: string; type: string; eventData: any }): void {
    const userSocketSet = this.userSockets.get(data.userId);
    if (userSocketSet) {
      for (const socketId of userSocketSet) {
        this.server.to(socketId).emit('audit:critical', {
          type: data.type,
          data: data.eventData,
        });
      }
    }
  }

  /**
   * 연결된 사용자 수 조회
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * 특정 사용자의 연결 상태 확인
   */
  isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }
}
