/**
 * Real-time Event Handler Service
 * 실시간 이벤트 처리 서비스
 * 
 * 책임:
 * - 실시간 체결 통보 처리
 * - 실시간 손익 계산
 * - 급등/급락 알림
 * - 거래 상태 업데이트
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { prisma } from '@stockboom/database';
import {
  RealTimePrice,
  RealTimeExecution,
  KisWebsocketService,
} from './kis-websocket.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface PriceAlert {
  symbol: string;
  stockId: string;
  alertType: 'SPIKE_UP' | 'SPIKE_DOWN' | 'LIMIT_UP' | 'LIMIT_DOWN';
  changePercent: number;
  price: number;
  previousPrice: number;
  volume: number;
  timestamp: Date;
}

export interface RealTimePnL {
  userId: string;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  }>;
  timestamp: Date;
}

@Injectable()
export class RealTimeEventHandler implements OnModuleInit {
  private readonly logger = new Logger(RealTimeEventHandler.name);

  // 가격 캐시 (급등락 감지용)
  private priceCache = new Map<string, { price: number; timestamp: Date }>();
  
  // 급등락 감지 설정
  private readonly SPIKE_THRESHOLD = 3; // 3% 이상 변동
  private readonly SPIKE_WINDOW_MS = 60000; // 1분 내

  // 활성 사용자 목록 (실시간 PnL 계산 대상)
  private activeUsers = new Set<string>();

  // 실시간 PnL 계산 주기
  private pnlCalculationInterval: NodeJS.Timeout | null = null;

  constructor(
    private kisWebsocketService: KisWebsocketService,
    private notificationsService: NotificationsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('RealTimeEventHandler initialized');
    
    // 실시간 PnL 계산 시작 (10초마다)
    this.startPnLCalculation();
  }

  /**
   * 실시간 체결가 이벤트 처리
   */
  @OnEvent('kis.realtime.price')
  async handleRealTimePrice(data: RealTimePrice): Promise<void> {
    try {
      // 가격 캐시 업데이트
      const previousCache = this.priceCache.get(data.symbol);
      this.priceCache.set(data.symbol, {
        price: data.price,
        timestamp: data.timestamp,
      });

      // DB 현재가 업데이트
      await this.updateStockPrice(data);

      // 급등락 감지
      if (previousCache) {
        await this.detectPriceSpike(data, previousCache.price);
      }

      // 신호 처리 서비스로 이벤트 전달
      this.eventEmitter.emit('realtime.price', {
        symbol: data.symbol,
        price: data.price,
        volume: data.volume,
        timestamp: data.timestamp,
      });

    } catch (error) {
      this.logger.error(`Failed to handle real-time price: ${error.message}`);
    }
  }

  /**
   * 실시간 체결 통보 이벤트 처리
   */
  @OnEvent('kis.realtime.execution')
  async handleRealTimeExecution(data: RealTimeExecution): Promise<void> {
    this.logger.log(`📊 Execution notification: ${data.symbol} ${data.side} ${data.filledQuantity}@${data.price}`);

    try {
      // 거래 상태 업데이트
      await this.updateTradeStatus(data);

      // 포지션 업데이트
      await this.updatePositionFromExecution(data);

      // 알림 발송
      await this.sendExecutionNotification(data);

      // 이벤트 발행 (대시보드 업데이트용)
      this.eventEmitter.emit('trade.executed', {
        orderNumber: data.orderNumber,
        symbol: data.symbol,
        side: data.side,
        quantity: data.filledQuantity,
        price: data.price,
        status: data.status,
        timestamp: data.timestamp,
      });

    } catch (error) {
      this.logger.error(`Failed to handle execution: ${error.message}`);
    }
  }

  /**
   * 주식 현재가 업데이트
   */
  private async updateStockPrice(data: RealTimePrice): Promise<void> {
    await prisma.stock.updateMany({
      where: { symbol: data.symbol },
      data: {
        currentPrice: data.price,
        volume: BigInt(data.volume),
        lastPriceUpdate: data.timestamp,
      },
    });
  }

  /**
   * 급등락 감지
   */
  private async detectPriceSpike(
    current: RealTimePrice,
    previousPrice: number,
  ): Promise<void> {
    if (previousPrice <= 0) return;

    const changePercent = ((current.price - previousPrice) / previousPrice) * 100;

    if (Math.abs(changePercent) >= this.SPIKE_THRESHOLD) {
      const stock = await prisma.stock.findUnique({
        where: { symbol: current.symbol },
      });

      const alert: PriceAlert = {
        symbol: current.symbol,
        stockId: stock?.id || '',
        alertType: changePercent > 0 ? 'SPIKE_UP' : 'SPIKE_DOWN',
        changePercent,
        price: current.price,
        previousPrice,
        volume: current.volume,
        timestamp: current.timestamp,
      };

      this.logger.warn(
        `🚨 Price ${alert.alertType}: ${current.symbol} ${changePercent.toFixed(2)}%`,
      );

      // 알림 이벤트 발행
      this.eventEmitter.emit('alert.price-spike', alert);

      // 관련 알림 조회 및 발송
      await this.sendPriceSpikeNotifications(alert);
    }
  }

  /**
   * 거래 상태 업데이트
   */
  private async updateTradeStatus(data: RealTimeExecution): Promise<void> {
    const trade = await prisma.trade.findFirst({
      where: { brokerOrderId: data.orderNumber },
    });

    if (!trade) {
      this.logger.warn(`Trade not found for order: ${data.orderNumber}`);
      return;
    }

    // 상태 결정
    let status: string;
    if (data.filledQuantity >= trade.quantity) {
      status = 'FILLED';
    } else if (data.filledQuantity > 0) {
      status = 'PARTIALLY_FILLED';
    } else {
      status = data.status === '완료' ? 'FILLED' : 'SUBMITTED';
    }

    // 거래 업데이트
    await prisma.trade.update({
      where: { id: trade.id },
      data: {
        status: status as any,
        filledQuantity: data.filledQuantity,
        avgFillPrice: data.price,
        totalAmount: data.price * data.filledQuantity,
        filledAt: status === 'FILLED' ? new Date() : undefined,
      },
    });

    this.logger.log(`Trade ${trade.id} updated to ${status}`);
  }

  /**
   * 체결에 따른 포지션 업데이트
   */
  private async updatePositionFromExecution(data: RealTimeExecution): Promise<void> {
    // 종목 조회
    const stock = await prisma.stock.findUnique({
      where: { symbol: data.symbol },
    });

    if (!stock) return;

    // 거래에서 사용자 정보 조회
    const trade = await prisma.trade.findFirst({
      where: { brokerOrderId: data.orderNumber },
      include: {
        brokerAccount: {
          include: {
            portfolios: true,
          },
        },
      },
    });

    if (!trade || !trade.brokerAccount?.portfolios?.[0]) return;

    const portfolioId = trade.brokerAccount.portfolios[0].id;

    // 포지션 조회
    const position = await prisma.position.findUnique({
      where: {
        portfolioId_stockId: {
          portfolioId,
          stockId: stock.id,
        },
      },
    });

    if (data.side === 'BUY') {
      // 매수: 포지션 추가/업데이트
      if (position) {
        const totalCost = Number(position.totalCost) + (data.price * data.filledQuantity);
        const newQuantity = position.quantity + data.filledQuantity;
        const newAvgPrice = totalCost / newQuantity;

        await prisma.position.update({
          where: { id: position.id },
          data: {
            quantity: newQuantity,
            avgPrice: newAvgPrice,
            totalCost,
            currentPrice: data.price,
            marketValue: newQuantity * data.price,
            unrealizedPL: (data.price - newAvgPrice) * newQuantity,
            unrealizedPLPct: ((data.price - newAvgPrice) / newAvgPrice) * 100,
          },
        });
      } else {
        await prisma.position.create({
          data: {
            portfolioId,
            stockId: stock.id,
            quantity: data.filledQuantity,
            avgPrice: data.price,
            currentPrice: data.price,
            totalCost: data.price * data.filledQuantity,
            marketValue: data.price * data.filledQuantity,
            unrealizedPL: 0,
            unrealizedPLPct: 0,
          },
        });
      }
    } else {
      // 매도: 포지션 감소
      if (position && position.quantity >= data.filledQuantity) {
        const newQuantity = position.quantity - data.filledQuantity;

        if (newQuantity > 0) {
          await prisma.position.update({
            where: { id: position.id },
            data: {
              quantity: newQuantity,
              currentPrice: data.price,
              marketValue: newQuantity * data.price,
              totalCost: Number(position.avgPrice) * newQuantity,
            },
          });
        } else {
          // 전량 매도 시 포지션 삭제
          await prisma.position.delete({ where: { id: position.id } });
        }
      }
    }
  }

  /**
   * 체결 알림 발송
   */
  private async sendExecutionNotification(data: RealTimeExecution): Promise<void> {
    const trade = await prisma.trade.findFirst({
      where: { brokerOrderId: data.orderNumber },
      select: { userId: true },
    });

    if (!trade) return;

    await this.notificationsService.createAndSend({
      userId: trade.userId,
      title: `주문 체결`,
      message: `${data.symbol} ${data.side === 'BUY' ? '매수' : '매도'} ${data.filledQuantity}주 @ ${data.price.toLocaleString()}원`,
      type: 'TRADE_EXECUTION',
      priority: 'NORMAL',
      channel: 'WEB_PUSH',
      data: {
        symbol: data.symbol,
        side: data.side,
        quantity: data.filledQuantity,
        price: data.price,
        orderNumber: data.orderNumber,
      },
    });
  }

  /**
   * 급등락 알림 발송
   */
  private async sendPriceSpikeNotifications(alert: PriceAlert): Promise<void> {
    // 해당 종목에 대한 알림 설정이 있는 사용자 조회
    const userAlerts = await prisma.alert.findMany({
      where: {
        type: alert.alertType === 'SPIKE_UP' ? 'PRICE_CHANGE' : 'PRICE_CHANGE',
        isActive: true,
      },
      include: { user: true },
    });

    for (const userAlert of userAlerts) {
      const conditions = userAlert.conditions as any;
      
      // 조건 확인 (임계값 체크)
      if (conditions?.threshold && Math.abs(alert.changePercent) >= conditions.threshold) {
        await this.notificationsService.createAndSend({
          userId: userAlert.userId,
          alertId: userAlert.id,
          title: alert.alertType === 'SPIKE_UP' ? '📈 급등 알림' : '📉 급락 알림',
          message: `${alert.symbol} ${alert.changePercent > 0 ? '+' : ''}${alert.changePercent.toFixed(2)}% (${alert.price.toLocaleString()}원)`,
          type: 'PRICE_CHANGE',
          priority: 'HIGH',
          channel: 'WEB_PUSH',
          data: alert,
        });
      }
    }
  }

  /**
   * 실시간 PnL 계산 시작
   */
  private startPnLCalculation(): void {
    this.pnlCalculationInterval = setInterval(async () => {
      for (const userId of this.activeUsers) {
        try {
          const pnl = await this.calculateRealTimePnL(userId);
          this.eventEmitter.emit('realtime.pnl', pnl);
        } catch (error) {
          this.logger.error(`PnL calculation failed for ${userId}: ${error.message}`);
        }
      }
    }, 10000); // 10초마다
  }

  /**
   * 실시간 PnL 계산
   */
  async calculateRealTimePnL(userId: string): Promise<RealTimePnL> {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      include: {
        positions: {
          include: { stock: true },
        },
      },
    });

    let totalValue = 0;
    let totalCost = 0;
    const positions: RealTimePnL['positions'] = [];

    for (const portfolio of portfolios) {
      totalValue += Number(portfolio.cashBalance);

      for (const position of portfolio.positions) {
        // 캐시된 현재가 사용
        const cachedPrice = this.priceCache.get(position.stock.symbol);
        const currentPrice = cachedPrice?.price || Number(position.currentPrice);

        const value = currentPrice * position.quantity;
        const cost = Number(position.totalCost);
        const pnl = value - cost;
        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

        totalValue += value;
        totalCost += cost;

        positions.push({
          symbol: position.stock.symbol,
          quantity: position.quantity,
          avgPrice: Number(position.avgPrice),
          currentPrice,
          pnl,
          pnlPercent,
        });
      }
    }

    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    return {
      userId,
      totalValue,
      totalPnL,
      totalPnLPercent,
      positions,
      timestamp: new Date(),
    };
  }

  /**
   * 사용자 활성화 (실시간 PnL 계산 대상 추가)
   */
  activateUser(userId: string): void {
    this.activeUsers.add(userId);
    this.logger.log(`User ${userId} activated for real-time PnL`);
  }

  /**
   * 사용자 비활성화
   */
  deactivateUser(userId: string): void {
    this.activeUsers.delete(userId);
    this.logger.log(`User ${userId} deactivated from real-time PnL`);
  }

  /**
   * 종목 구독 시작
   */
  async subscribeSymbol(symbol: string): Promise<void> {
    await this.kisWebsocketService.subscribePrice(symbol);
    this.logger.log(`Subscribed to real-time price: ${symbol}`);
  }

  /**
   * 종목 구독 해제
   */
  async unsubscribeSymbol(symbol: string): Promise<void> {
    await this.kisWebsocketService.unsubscribe('H0STCNT0', symbol);
    this.priceCache.delete(symbol);
    this.logger.log(`Unsubscribed from real-time price: ${symbol}`);
  }

  /**
   * 현재 캐시된 가격 조회
   */
  getCachedPrice(symbol: string): number | null {
    return this.priceCache.get(symbol)?.price || null;
  }

  /**
   * 모든 캐시된 가격 조회
   */
  getAllCachedPrices(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [symbol, data] of this.priceCache) {
      result.set(symbol, data.price);
    }
    return result;
  }
}
