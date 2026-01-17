import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@stockboom/database';

import { KisApiService } from '../market-data/kis-api.service';
import { StrategiesService } from '../strategies/strategies.service';
import { RiskManagerService } from './risk-manager.service';
import { PositionManagerService } from './position-manager.service';
import { SignalProcessorService } from './signal-processor.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { AuditTrailService } from './audit-trail.service';

import {
  TradingSignal,
  OrderRequest,
  OrderResult,
  SplitOrderRequest,
  SplitOrderResult,
  ScheduledOrderRequest,
  AutoTradingSession,
  AutoTradingConfig,
  StrategyExecutionResult,
} from './trading-engine.types';

/**
 * Trading Engine Service
 * 자동매매 핵심 엔진
 * 
 * 책임:
 * - 자동매매 세션 관리
 * - 매매 신호 처리 및 주문 실행
 * - 분할 매수/매도
 * - 예약 주문 관리
 * - 전략 주기적 실행
 */
@Injectable()
export class TradingEngineService {
  private readonly logger = new Logger(TradingEngineService.name);

  // 활성 자동매매 세션
  private activeSessions = new Map<string, AutoTradingConfig>();

  // 전략 실행 인터벌 (strategyId → intervalId)
  private strategyIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectQueue('trading') private tradingQueue: Queue,
    @InjectQueue('scheduled-orders') private scheduledOrderQueue: Queue,
    @InjectQueue('split-orders') private splitOrderQueue: Queue,
    private kisApiService: KisApiService,
    private strategiesService: StrategiesService,
    private riskManagerService: RiskManagerService,
    private positionManagerService: PositionManagerService,
    private signalProcessorService: SignalProcessorService,
    private circuitBreakerService: CircuitBreakerService,
    private auditTrailService: AuditTrailService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ============================================
  // 자동매매 세션 관리
  // ============================================

  /**
   * 자동매매 시작
   */
  async startAutoTrading(config: AutoTradingConfig): Promise<AutoTradingSession> {
    const { userId, strategyIds } = config;

    this.logger.log(`🚀 Starting auto trading for user ${userId}`);

    // 기존 세션 확인
    if (this.activeSessions.has(userId)) {
      throw new Error('이미 자동매매가 실행 중입니다.');
    }

    // 서킷 브레이커 확인
    if (!this.circuitBreakerService.canPlaceOrder(userId)) {
      throw new Error('서킷 브레이커가 활성화되어 자동매매를 시작할 수 없습니다.');
    }

    // 전략 유효성 검증
    for (const strategyId of strategyIds) {
      const strategy = await this.strategiesService.findOne(strategyId, userId);
      if (!strategy || !strategy.isActive) {
        throw new Error(`전략 ${strategyId}이(가) 유효하지 않습니다.`);
      }
    }

    // 세션 생성
    const session = await prisma.autoTradingSession.create({
      data: {
        userId,
        status: 'RUNNING',
        startedAt: new Date(),
        strategies: strategyIds,
      },
    });

    // 설정 저장
    this.activeSessions.set(userId, config);

    // 전략별 실행 스케줄링
    for (const strategyId of strategyIds) {
      this.scheduleStrategy(strategyId, userId);
    }

    // 감사 로그
    await this.auditTrailService.logSessionEvent(
      userId,
      'AUTO_TRADING_STARTED',
      {
        sessionId: session.id,
        strategies: strategyIds,
        config: {
          enableAISignals: config.enableAISignals,
          enableIndicatorSignals: config.enableIndicatorSignals,
          tradingHoursOnly: config.tradingHoursOnly,
        },
      },
    );

    // 이벤트 발행
    this.eventEmitter.emit('auto-trading.started', { userId, session });

    return {
      id: session.id,
      userId,
      status: 'RUNNING',
      startedAt: session.startedAt,
      activeStrategies: strategyIds,
      totalTrades: 0,
      profitLoss: 0,
    };
  }

  /**
   * 자동매매 중지
   */
  async stopAutoTrading(userId: string): Promise<void> {
    this.logger.log(`⏹️ Stopping auto trading for user ${userId}`);

    const config = this.activeSessions.get(userId);
    if (!config) {
      throw new Error('실행 중인 자동매매가 없습니다.');
    }

    // 전략 스케줄 취소
    for (const strategyId of config.strategyIds) {
      this.unscheduleStrategy(strategyId);
    }

    // 세션 종료
    await prisma.autoTradingSession.updateMany({
      where: { userId, status: 'RUNNING' },
      data: {
        status: 'STOPPED',
        stoppedAt: new Date(),
      },
    });

    this.activeSessions.delete(userId);

    // 감사 로그
    await this.auditTrailService.logSessionEvent(
      userId,
      'AUTO_TRADING_STOPPED',
      { strategies: config.strategyIds },
    );

    // 이벤트 발행
    this.eventEmitter.emit('auto-trading.stopped', { userId });
  }

  /**
   * 자동매매 일시정지
   */
  async pauseAutoTrading(userId: string): Promise<void> {
    const config = this.activeSessions.get(userId);
    if (!config) {
      throw new Error('실행 중인 자동매매가 없습니다.');
    }

    // 전략 스케줄 일시 취소
    for (const strategyId of config.strategyIds) {
      this.unscheduleStrategy(strategyId);
    }

    await prisma.autoTradingSession.updateMany({
      where: { userId, status: 'RUNNING' },
      data: { status: 'PAUSED' },
    });

    await this.auditTrailService.logSessionEvent(
      userId,
      'AUTO_TRADING_PAUSED',
      {},
    );
  }

  /**
   * 자동매매 재개
   */
  async resumeAutoTrading(userId: string): Promise<void> {
    const config = this.activeSessions.get(userId);
    if (!config) {
      throw new Error('일시정지된 자동매매가 없습니다.');
    }

    // 전략 스케줄 재개
    for (const strategyId of config.strategyIds) {
      this.scheduleStrategy(strategyId, userId);
    }

    await prisma.autoTradingSession.updateMany({
      where: { userId, status: 'PAUSED' },
      data: { status: 'RUNNING' },
    });

    await this.auditTrailService.logSessionEvent(
      userId,
      'AUTO_TRADING_RESUMED',
      {},
    );
  }

  /**
   * 자동매매 상태 조회
   */
  getAutoTradingStatus(userId: string): { isRunning: boolean; config?: AutoTradingConfig } {
    const config = this.activeSessions.get(userId);
    return {
      isRunning: !!config,
      config,
    };
  }

  // ============================================
  // 신호 처리 및 주문 실행
  // ============================================

  /**
   * 매매 신호 처리
   */
  @OnEvent('signal.new')
  async processSignal(signal: TradingSignal): Promise<OrderResult | null> {
    const config = this.activeSessions.get(signal.userId);
    
    // 자동매매 활성화 확인
    if (!config) {
      this.logger.debug(`Auto trading not active for user ${signal.userId}`);
      return null;
    }

    // 거래 시간 확인
    if (config.tradingHoursOnly && !this.isTradingHours()) {
      this.logger.debug('Outside trading hours, skipping signal');
      return null;
    }

    // 신호 강도 필터링
    if (signal.strength === 'WEAK') {
      this.logger.debug('Signal too weak, skipping');
      return null;
    }

    // 브로커 계좌 조회
    const brokerAccount = await prisma.brokerAccount.findFirst({
      where: { userId: signal.userId, isActive: true },
    });

    if (!brokerAccount) {
      this.logger.warn(`No active broker account for user ${signal.userId}`);
      return null;
    }

    // 주문 요청 생성
    const orderRequest: OrderRequest = {
      userId: signal.userId,
      brokerAccountId: brokerAccount.id,
      stockId: signal.stockId,
      symbol: signal.symbol,
      side: signal.side,
      priceType: 'LIMIT',
      quantity: await this.calculateOrderQuantity(signal, brokerAccount.id),
      price: signal.price,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      strategyId: signal.strategyId,
      signalId: signal.id,
      isAutoTrade: true,
    };

    // 주문 실행
    return this.executeOrder(orderRequest);
  }

  /**
   * 주문 실행
   */
  async executeOrder(request: OrderRequest): Promise<OrderResult> {
    this.logger.log(
      `📊 Executing order: ${request.side} ${request.quantity} ${request.symbol}`,
    );

    try {
      // 리스크 검증
      const riskCheck = await this.riskManagerService.validateOrder(request);
      if (!riskCheck.approved) {
        this.logger.warn(`Order rejected by risk manager: ${riskCheck.errors.join(', ')}`);
        return {
          success: false,
          message: '리스크 검증 실패',
          error: riskCheck.errors.join(', '),
        };
      }

      // 수량 조정 (리스크 권장)
      const quantity = riskCheck.suggestedQuantity || request.quantity;

      // 주문 타입 결정 (KISOrderRequest 타입 맞춤)
      const orderType: 'MARKET' | 'LIMIT' = request.priceType === 'MARKET' ? 'MARKET' : 'LIMIT';

      // KIS API 주문 실행
      const kisResult = await this.kisApiService.placeOrder(
        {
          symbol: request.symbol,
          side: request.side,
          orderType,
          quantity,
          price: request.price,
        },
        request.userId,
      );

      if (kisResult.status !== 'SUCCESS') {
        // 실패 기록
        await this.circuitBreakerService.recordFailure(
          request.userId,
          kisResult.message || 'Order failed',
        );

        await this.auditTrailService.logOrderEvent(
          request.userId,
          'ORDER_FAILED',
          {
            symbol: request.symbol,
            side: request.side,
            quantity,
            error: kisResult.message || 'Order failed',
          },
          'ERROR',
        );

        return {
          success: false,
          message: kisResult.message || 'Order failed',
          error: kisResult.message || 'Order failed',
        };
      }

      // 성공 기록
      this.circuitBreakerService.recordSuccess(request.userId);

      // DB에 거래 기록
      const trade = await prisma.trade.create({
        data: {
          userId: request.userId,
          brokerAccountId: request.brokerAccountId,
          stockId: request.stockId,
          orderType: request.priceType === 'MARKET' ? 'MARKET' : 'LIMIT',
          orderSide: request.side,
          quantity,
          limitPrice: request.price,
          stopPrice: request.stopLoss,
          isAutoTrade: request.isAutoTrade,
          signalSource: request.isAutoTrade ? 'indicator' : 'manual',
          strategyId: request.strategyId,
          brokerOrderId: kisResult.orderId,
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      // 감사 로그
      await this.auditTrailService.logOrderEvent(
        request.userId,
        'ORDER_SUBMITTED',
        {
          tradeId: trade.id,
          symbol: request.symbol,
          side: request.side,
          quantity,
          price: request.price,
          brokerOrderId: kisResult.orderId,
        },
      );

      // 이벤트 발행
      this.eventEmitter.emit('order.submitted', {
        userId: request.userId,
        trade,
      });

      return {
        success: true,
        tradeId: trade.id,
        brokerOrderId: kisResult.orderId,
        message: '주문이 제출되었습니다.',
      };

    } catch (error) {
      this.logger.error(`Order execution error: ${error.message}`);

      await this.circuitBreakerService.recordFailure(
        request.userId,
        error.message,
      );

      return {
        success: false,
        message: '주문 실행 중 오류 발생',
        error: error.message,
      };
    }
  }

  /**
   * 분할 주문 실행
   */
  async executeSplitOrder(request: SplitOrderRequest): Promise<SplitOrderResult> {
    this.logger.log(
      `📊 Executing split order: ${request.totalQuantity} ${request.symbol} in ${request.splitCount} parts`,
    );

    const quantityPerOrder = Math.floor(request.totalQuantity / request.splitCount);
    const remainder = request.totalQuantity % request.splitCount;

    const tradeIds: string[] = [];
    const errors: string[] = [];
    let totalFilledQuantity = 0;
    let totalFilledAmount = 0;

    for (let i = 0; i < request.splitCount; i++) {
      // 마지막 주문에 나머지 수량 추가
      const quantity = i === request.splitCount - 1
        ? quantityPerOrder + remainder
        : quantityPerOrder;

      if (quantity <= 0) continue;

      // 주문 실행
      const orderResult = await this.executeOrder({
        userId: request.userId,
        brokerAccountId: request.brokerAccountId,
        stockId: request.stockId,
        symbol: request.symbol,
        side: request.side,
        priceType: request.priceType,
        quantity,
        price: request.limitPrice,
        strategyId: request.strategyId,
        isAutoTrade: true,
      });

      if (orderResult.success && orderResult.tradeId) {
        tradeIds.push(orderResult.tradeId);
        totalFilledQuantity += orderResult.filledQuantity || quantity;
        totalFilledAmount +=
          (orderResult.filledQuantity || quantity) *
          (orderResult.filledPrice || request.limitPrice || 0);
      } else {
        errors.push(orderResult.error || 'Unknown error');
      }

      // 분할 간격 대기
      if (i < request.splitCount - 1) {
        await this.sleep(request.intervalSeconds * 1000);
      }
    }

    const avgFilledPrice =
      totalFilledQuantity > 0 ? totalFilledAmount / totalFilledQuantity : 0;

    return {
      success: errors.length === 0,
      totalOrders: request.splitCount,
      completedOrders: tradeIds.length,
      failedOrders: errors.length,
      totalFilledQuantity,
      avgFilledPrice,
      tradeIds,
      errors,
    };
  }

  /**
   * 예약 주문 생성
   */
  async createScheduledOrder(request: ScheduledOrderRequest): Promise<string> {
    const scheduledOrder = await prisma.scheduledOrder.create({
      data: {
        userId: request.userId,
        symbol: request.symbol,
        side: request.side,
        orderType: request.priceType === 'MARKET' ? 'MARKET' : 'LIMIT',
        quantity: request.quantity,
        price: request.price,
        scheduledAt: request.scheduledTime,
        validUntil: request.validUntil,
        status: 'PENDING',
      },
    });

    // 예약 시간에 실행되도록 큐에 추가
    const delay = request.scheduledTime.getTime() - Date.now();
    if (delay > 0) {
      await this.scheduledOrderQueue.add(
        'execute-scheduled',
        { scheduledOrderId: scheduledOrder.id },
        { delay },
      );
    }

    await this.auditTrailService.logOrderEvent(
      request.userId,
      'SCHEDULED_ORDER_CREATED',
      {
        scheduledOrderId: scheduledOrder.id,
        symbol: request.symbol,
        scheduledAt: request.scheduledTime.toISOString(),
      },
    );

    return scheduledOrder.id;
  }

  // ============================================
  // 전략 실행
  // ============================================

  /**
   * 전략 스케줄링
   */
  private scheduleStrategy(strategyId: string, userId: string): void {
    // 기존 스케줄 제거
    this.unscheduleStrategy(strategyId);

    // 1분마다 전략 실행
    const interval = setInterval(async () => {
      await this.executeStrategy(strategyId, userId);
    }, 60 * 1000);

    this.strategyIntervals.set(strategyId, interval);

    // 즉시 한 번 실행
    this.executeStrategy(strategyId, userId).catch((error) => {
      this.logger.error(`Strategy execution failed: ${error.message}`);
    });
  }

  /**
   * 전략 스케줄 취소
   */
  private unscheduleStrategy(strategyId: string): void {
    const interval = this.strategyIntervals.get(strategyId);
    if (interval) {
      clearInterval(interval);
      this.strategyIntervals.delete(strategyId);
    }
  }

  /**
   * 전략 실행
   */
  private async executeStrategy(
    strategyId: string,
    userId: string,
  ): Promise<StrategyExecutionResult> {
    const startTime = Date.now();

    try {
      const strategy = await this.strategiesService.findOne(strategyId, userId);
      if (!strategy || !strategy.isActive) {
        return {
          strategyId,
          success: false,
          duration: Date.now() - startTime,
          error: 'Strategy not found or inactive',
        };
      }

      const config = strategy.config as { symbols?: string[] };
      const symbols = config.symbols || [];

      for (const symbol of symbols) {
        const stock = await prisma.stock.findUnique({
          where: { symbol },
        });

        if (!stock) continue;

        // 전략 평가
        const evaluation = await this.strategiesService.evaluateStrategy(
          strategyId,
          stock.id,
        );

        if (evaluation.shouldTrade && evaluation.signal !== 'HOLD') {
          // 신호 생성
          await this.signalProcessorService.generateIndicatorSignal(
            userId,
            stock.id,
          );
        }
      }

      return {
        strategyId,
        success: true,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      this.logger.error(`Strategy ${strategyId} execution failed: ${error.message}`);

      await this.auditTrailService.logStrategyEvent(
        userId,
        strategyId,
        'STRATEGY_EXECUTION_FAILED',
        { error: error.message },
        'ERROR',
      );

      return {
        strategyId,
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  // ============================================
  // 유틸리티
  // ============================================

  /**
   * 거래 시간 확인 (한국 주식시장: 09:00-15:30)
   */
  private isTradingHours(): boolean {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours * 100 + minutes;

    // 주말 체크
    const day = now.getDay();
    if (day === 0 || day === 6) return false;

    // 09:00 ~ 15:30
    return time >= 900 && time <= 1530;
  }

  /**
   * 주문 수량 계산
   */
  private async calculateOrderQuantity(
    signal: TradingSignal,
    brokerAccountId: string,
  ): Promise<number> {
    if (signal.quantity) return signal.quantity;

    // 기본 수량 계산 (예수금의 10% 기준)
    try {
      const accountBalance = await this.kisApiService.getAccountBalance(signal.userId);
      const availableAmount = accountBalance.cashBalance * 0.1;
      const quantity = Math.floor(availableAmount / signal.price);
      return Math.max(1, quantity);
    } catch (error) {
      return 1; // 기본값
    }
  }

  /**
   * KIS 주문 타입 변환
   */
  private getKISOrderType(priceType: string): string {
    const typeMap: Record<string, string> = {
      MARKET: '01',       // 시장가
      LIMIT: '00',        // 지정가
      BEST_LIMIT: '03',   // 최유리지정가
      BEST_MARKET: '04',  // 최유리시장가
      IOC: '05',          // IOC
      FOK: '06',          // FOK
    };
    return typeMap[priceType] || '00';
  }

  /**
   * 슬립
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================
  // 예약 주문 처리 (Cron)
  // ============================================

  /**
   * 만료된 예약 주문 처리
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredScheduledOrders(): Promise<void> {
    const now = new Date();

    const expiredOrders = await prisma.scheduledOrder.findMany({
      where: {
        status: 'PENDING',
        validUntil: { lt: now },
      },
    });

    for (const order of expiredOrders) {
      await prisma.scheduledOrder.update({
        where: { id: order.id },
        data: { status: 'EXPIRED' },
      });

      await this.auditTrailService.logOrderEvent(
        order.userId,
        'SCHEDULED_ORDER_EXPIRED',
        { scheduledOrderId: order.id, symbol: order.symbol },
      );
    }
  }
}
