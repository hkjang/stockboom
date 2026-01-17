/**
 * Smart Order Router Service
 * 스마트 주문 실행 서비스
 * 
 * 전문가급 주문 실행 알고리즘:
 * - VWAP (Volume Weighted Average Price)
 * - TWAP (Time Weighted Average Price)
 * - Iceberg Orders (대량 주문 분할)
 * - 최유리 호가 추적
 * - 슬리피지 최소화
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma } from '@stockboom/database';
import { KisApiService } from '../market-data/kis-api.service';
import { AuditTrailService } from './audit-trail.service';

export type SmartOrderType = 'VWAP' | 'TWAP' | 'ICEBERG' | 'BEST_LIMIT' | 'AGGRESSIVE';

export interface SmartOrderRequest {
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  totalQuantity: number;
  orderType: SmartOrderType;
  
  // VWAP/TWAP 옵션
  durationMinutes?: number;     // 실행 기간 (분)
  participationRate?: number;   // 시장 거래량 대비 참여율 (0.1 = 10%)
  
  // Iceberg 옵션
  displayQuantity?: number;     // 노출 수량
  
  // 가격 제한
  limitPrice?: number;          // 최대/최소 가격
  priceTolerancePercent?: number; // 허용 가격 변동 (%)
  
  // 실행 조건
  startTime?: Date;
  endTime?: Date;
  pauseOnSpike?: boolean;       // 급등락 시 일시정지
}

export interface SmartOrderResult {
  orderId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  totalQuantity: number;
  filledQuantity: number;
  avgFillPrice: number;
  vwapBenchmark?: number;       // VWAP 벤치마크 대비 성과
  slippageBps?: number;         // 슬리피지 (basis points)
  childOrders: string[];
  startedAt: Date;
  completedAt?: Date;
}

interface ActiveSmartOrder {
  request: SmartOrderRequest;
  result: SmartOrderResult;
  intervalId?: NodeJS.Timeout;
  slices: Array<{
    quantity: number;
    scheduledTime: Date;
    executed: boolean;
    childOrderId?: string;
    fillPrice?: number;
  }>;
}

@Injectable()
export class SmartOrderService {
  private readonly logger = new Logger(SmartOrderService.name);
  
  // 활성 스마트 주문
  private activeOrders = new Map<string, ActiveSmartOrder>();
  
  // 거래량 히스토리 (VWAP 계산용)
  private volumeProfile = new Map<string, number[]>(); // symbol -> 분당 거래량

  constructor(
    private kisApiService: KisApiService,
    private auditTrailService: AuditTrailService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 스마트 주문 실행
   */
  async executeSmartOrder(request: SmartOrderRequest): Promise<SmartOrderResult> {
    const orderId = `SMART-${Date.now()}-${request.symbol}`;
    
    this.logger.log(
      `📊 Smart Order: ${request.orderType} ${request.side} ${request.totalQuantity} ${request.symbol}`
    );

    const result: SmartOrderResult = {
      orderId,
      status: 'ACTIVE',
      totalQuantity: request.totalQuantity,
      filledQuantity: 0,
      avgFillPrice: 0,
      childOrders: [],
      startedAt: new Date(),
    };

    try {
      switch (request.orderType) {
        case 'VWAP':
          await this.executeVWAP(orderId, request, result);
          break;
        case 'TWAP':
          await this.executeTWAP(orderId, request, result);
          break;
        case 'ICEBERG':
          await this.executeIceberg(orderId, request, result);
          break;
        case 'BEST_LIMIT':
          await this.executeBestLimit(orderId, request, result);
          break;
        case 'AGGRESSIVE':
          await this.executeAggressive(orderId, request, result);
          break;
        default:
          throw new Error(`Unknown order type: ${request.orderType}`);
      }

      // 감사 로그
      await this.auditTrailService.logOrderEvent(
        request.userId,
        'SMART_ORDER_STARTED',
        {
          orderId,
          type: request.orderType,
          symbol: request.symbol,
          side: request.side,
          quantity: request.totalQuantity,
        },
      );

      return result;
    } catch (error) {
      result.status = 'FAILED';
      this.logger.error(`Smart order failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * VWAP 주문 실행
   * 거래량 가중 평균 가격 추적
   */
  private async executeVWAP(
    orderId: string,
    request: SmartOrderRequest,
    result: SmartOrderResult,
  ): Promise<void> {
    const durationMs = (request.durationMinutes || 60) * 60 * 1000;
    const participationRate = request.participationRate || 0.05;
    
    // 예상 거래량 프로필 조회
    const volumeProfile = await this.getVolumeProfile(request.symbol);
    
    // 슬라이스 계획 생성
    const totalSlices = Math.min(request.durationMinutes || 60, 60);
    const sliceInterval = durationMs / totalSlices;
    
    const slices: ActiveSmartOrder['slices'] = [];
    let remainingQty = request.totalQuantity;
    
    for (let i = 0; i < totalSlices && remainingQty > 0; i++) {
      // 거래량 프로필 기반 수량 배분
      const volumeWeight = volumeProfile[i % volumeProfile.length] || 1;
      const baseQty = Math.ceil(request.totalQuantity / totalSlices);
      const sliceQty = Math.min(
        Math.ceil(baseQty * volumeWeight * participationRate),
        remainingQty
      );
      
      slices.push({
        quantity: sliceQty,
        scheduledTime: new Date(Date.now() + i * sliceInterval),
        executed: false,
      });
      
      remainingQty -= sliceQty;
    }
    
    // 남은 수량 마지막 슬라이스에 추가
    if (remainingQty > 0 && slices.length > 0) {
      slices[slices.length - 1].quantity += remainingQty;
    }

    const activeOrder: ActiveSmartOrder = { request, result, slices };
    this.activeOrders.set(orderId, activeOrder);

    // 스케줄 실행 시작
    this.scheduleSlices(orderId, activeOrder);
  }

  /**
   * TWAP 주문 실행
   * 시간 가중 균등 분할 주문
   */
  private async executeTWAP(
    orderId: string,
    request: SmartOrderRequest,
    result: SmartOrderResult,
  ): Promise<void> {
    const durationMs = (request.durationMinutes || 60) * 60 * 1000;
    const totalSlices = Math.min(request.durationMinutes || 60, 60);
    const sliceInterval = durationMs / totalSlices;
    const qtyPerSlice = Math.ceil(request.totalQuantity / totalSlices);
    
    const slices: ActiveSmartOrder['slices'] = [];
    let remainingQty = request.totalQuantity;
    
    for (let i = 0; i < totalSlices && remainingQty > 0; i++) {
      const sliceQty = Math.min(qtyPerSlice, remainingQty);
      slices.push({
        quantity: sliceQty,
        scheduledTime: new Date(Date.now() + i * sliceInterval),
        executed: false,
      });
      remainingQty -= sliceQty;
    }

    const activeOrder: ActiveSmartOrder = { request, result, slices };
    this.activeOrders.set(orderId, activeOrder);

    this.scheduleSlices(orderId, activeOrder);
  }

  /**
   * Iceberg 주문 실행
   * 대량 주문 분할 노출
   */
  private async executeIceberg(
    orderId: string,
    request: SmartOrderRequest,
    result: SmartOrderResult,
  ): Promise<void> {
    const displayQty = request.displayQuantity || Math.ceil(request.totalQuantity / 10);
    const slices: ActiveSmartOrder['slices'] = [];
    let remainingQty = request.totalQuantity;
    
    while (remainingQty > 0) {
      const sliceQty = Math.min(displayQty, remainingQty);
      slices.push({
        quantity: sliceQty,
        scheduledTime: new Date(), // 즉시 실행, 체결 후 다음 슬라이스
        executed: false,
      });
      remainingQty -= sliceQty;
    }

    const activeOrder: ActiveSmartOrder = { request, result, slices };
    this.activeOrders.set(orderId, activeOrder);

    // 첫 슬라이스 즉시 실행, 체결 시 다음 슬라이스 실행
    await this.executeNextIcebergSlice(orderId);
  }

  /**
   * 최유리 지정가 주문
   * 호가 추적하며 최적 가격 갱신
   */
  private async executeBestLimit(
    orderId: string,
    request: SmartOrderRequest,
    result: SmartOrderResult,
  ): Promise<void> {
    // 현재 호가 조회
    const orderbook = await this.kisApiService.getOrderbook(request.symbol, request.userId);
    
    // 최유리 가격 결정
    let bestPrice: number;
    if (request.side === 'BUY') {
      bestPrice = orderbook.bids[0]?.price || orderbook.currentPrice;
    } else {
      bestPrice = orderbook.asks[0]?.price || orderbook.currentPrice;
    }

    // 가격 제한 적용
    if (request.limitPrice) {
      if (request.side === 'BUY') {
        bestPrice = Math.min(bestPrice, request.limitPrice);
      } else {
        bestPrice = Math.max(bestPrice, request.limitPrice);
      }
    }

    // 주문 실행
    const kisResult = await this.kisApiService.placeOrder(
      {
        symbol: request.symbol,
        side: request.side,
        orderType: 'LIMIT',
        quantity: request.totalQuantity,
        price: bestPrice,
      },
      request.userId,
    );

    if (kisResult.status === 'SUCCESS') {
      result.childOrders.push(kisResult.orderId);
      
      // 호가 모니터링 시작 (미체결 시 가격 조정)
      this.monitorAndAdjustOrder(orderId, request, kisResult.orderId, bestPrice);
    }

    const activeOrder: ActiveSmartOrder = { request, result, slices: [] };
    this.activeOrders.set(orderId, activeOrder);
  }

  /**
   * 공격적 주문
   * 즉시 체결 우선 (시장가 + 슬리피지 허용)
   */
  private async executeAggressive(
    orderId: string,
    request: SmartOrderRequest,
    result: SmartOrderResult,
  ): Promise<void> {
    let remainingQty = request.totalQuantity;
    let totalCost = 0;
    
    // 호가창 기반 분할 체결
    const orderbook = await this.kisApiService.getOrderbook(request.symbol, request.userId);
    const levels = request.side === 'BUY' ? orderbook.asks : orderbook.bids;
    
    for (const level of levels) {
      if (remainingQty <= 0) break;
      
      // 가격 허용 범위 체크
      if (request.priceTolerancePercent) {
        const basePrice = orderbook.currentPrice;
        const tolerance = basePrice * (request.priceTolerancePercent / 100);
        if (request.side === 'BUY' && level.price > basePrice + tolerance) break;
        if (request.side === 'SELL' && level.price < basePrice - tolerance) break;
      }
      
      const fillQty = Math.min(level.quantity, remainingQty);
      
      const kisResult = await this.kisApiService.placeOrder(
        {
          symbol: request.symbol,
          side: request.side,
          orderType: 'LIMIT',
          quantity: fillQty,
          price: level.price,
        },
        request.userId,
      );
      
      if (kisResult.status === 'SUCCESS') {
        result.childOrders.push(kisResult.orderId);
        result.filledQuantity += fillQty;
        totalCost += fillQty * level.price;
        remainingQty -= fillQty;
      }
    }
    
    // 남은 수량 시장가 처리
    if (remainingQty > 0) {
      const kisResult = await this.kisApiService.placeOrder(
        {
          symbol: request.symbol,
          side: request.side,
          orderType: 'MARKET',
          quantity: remainingQty,
        },
        request.userId,
      );
      
      if (kisResult.status === 'SUCCESS') {
        result.childOrders.push(kisResult.orderId);
      }
    }
    
    result.avgFillPrice = result.filledQuantity > 0 
      ? totalCost / result.filledQuantity 
      : 0;
    result.status = remainingQty === 0 ? 'COMPLETED' : 'ACTIVE';

    const activeOrder: ActiveSmartOrder = { request, result, slices: [] };
    this.activeOrders.set(orderId, activeOrder);
  }

  /**
   * 슬라이스 스케줄 실행
   */
  private scheduleSlices(orderId: string, activeOrder: ActiveSmartOrder): void {
    const { slices, request, result } = activeOrder;
    
    for (const slice of slices) {
      const delay = Math.max(0, slice.scheduledTime.getTime() - Date.now());
      
      setTimeout(async () => {
        if (!this.activeOrders.has(orderId)) return;
        if (slice.executed) return;
        
        try {
          // 급등락 체크
          if (request.pauseOnSpike) {
            const shouldPause = await this.checkPriceSpike(request.symbol);
            if (shouldPause) {
              this.logger.warn(`⏸️ Pausing smart order due to price spike: ${request.symbol}`);
              return; // 다음 슬라이스에서 재시도
            }
          }
          
          // 최적 가격 결정
          const orderbook = await this.kisApiService.getOrderbook(request.symbol, request.userId);
          let price: number;
          
          if (request.side === 'BUY') {
            price = orderbook.bids[0]?.price || orderbook.currentPrice;
            if (request.limitPrice) price = Math.min(price, request.limitPrice);
          } else {
            price = orderbook.asks[0]?.price || orderbook.currentPrice;
            if (request.limitPrice) price = Math.max(price, request.limitPrice);
          }
          
          // 주문 실행
          const kisResult = await this.kisApiService.placeOrder(
            {
              symbol: request.symbol,
              side: request.side,
              orderType: 'LIMIT',
              quantity: slice.quantity,
              price,
            },
            request.userId,
          );
          
          if (kisResult.status === 'SUCCESS') {
            slice.executed = true;
            slice.childOrderId = kisResult.orderId;
            slice.fillPrice = price;
            result.childOrders.push(kisResult.orderId);
            result.filledQuantity += slice.quantity;
            
            // 평균 가격 갱신
            const totalCost = slices
              .filter(s => s.executed && s.fillPrice)
              .reduce((sum, s) => sum + s.quantity * s.fillPrice!, 0);
            result.avgFillPrice = totalCost / result.filledQuantity;
          }
          
          // 완료 체크
          const allExecuted = slices.every(s => s.executed);
          if (allExecuted) {
            result.status = 'COMPLETED';
            result.completedAt = new Date();
            
            // 슬리피지 계산
            const vwap = await this.calculateVWAP(request.symbol);
            if (vwap > 0) {
              result.vwapBenchmark = vwap;
              result.slippageBps = Math.round(
                ((result.avgFillPrice - vwap) / vwap) * 10000 * 
                (request.side === 'BUY' ? 1 : -1)
              );
            }
            
            this.eventEmitter.emit('smart-order.completed', result);
            this.activeOrders.delete(orderId);
            
            this.logger.log(
              `✅ Smart order completed: ${orderId} | Avg: ${result.avgFillPrice} | Slippage: ${result.slippageBps}bps`
            );
          }
        } catch (error) {
          this.logger.error(`Slice execution failed: ${error.message}`);
        }
      }, delay);
    }
  }

  /**
   * Iceberg 다음 슬라이스 실행
   */
  private async executeNextIcebergSlice(orderId: string): Promise<void> {
    const activeOrder = this.activeOrders.get(orderId);
    if (!activeOrder) return;
    
    const { slices, request, result } = activeOrder;
    const nextSlice = slices.find(s => !s.executed);
    
    if (!nextSlice) {
      result.status = 'COMPLETED';
      result.completedAt = new Date();
      this.activeOrders.delete(orderId);
      return;
    }
    
    try {
      const orderbook = await this.kisApiService.getOrderbook(request.symbol, request.userId);
      const price = request.side === 'BUY' 
        ? orderbook.bids[0]?.price 
        : orderbook.asks[0]?.price;
      
      const kisResult = await this.kisApiService.placeOrder(
        {
          symbol: request.symbol,
          side: request.side,
          orderType: 'LIMIT',
          quantity: nextSlice.quantity,
          price: price || orderbook.currentPrice,
        },
        request.userId,
      );
      
      if (kisResult.status === 'SUCCESS') {
        nextSlice.executed = true;
        nextSlice.childOrderId = kisResult.orderId;
        nextSlice.fillPrice = price;
        result.childOrders.push(kisResult.orderId);
        result.filledQuantity += nextSlice.quantity;
        
        // 체결 확인 후 다음 슬라이스 (5초 대기)
        setTimeout(() => this.executeNextIcebergSlice(orderId), 5000);
      }
    } catch (error) {
      this.logger.error(`Iceberg slice failed: ${error.message}`);
    }
  }

  /**
   * 호가 모니터링 및 가격 조정
   */
  private monitorAndAdjustOrder(
    orderId: string,
    request: SmartOrderRequest,
    childOrderId: string,
    currentPrice: number,
  ): void {
    const intervalId = setInterval(async () => {
      const activeOrder = this.activeOrders.get(orderId);
      if (!activeOrder || activeOrder.result.status !== 'ACTIVE') {
        clearInterval(intervalId);
        return;
      }
      
      try {
        // 체결 여부 확인
        const history = await this.kisApiService.getOrderHistory(request.userId, {
          onlyUnfilled: true,
        });
        
        const order = history.find(o => o.orderNumber === childOrderId);
        if (!order) {
          // 체결 완료
          activeOrder.result.status = 'COMPLETED';
          activeOrder.result.completedAt = new Date();
          clearInterval(intervalId);
          this.activeOrders.delete(orderId);
          return;
        }
        
        // 미체결 시 호가 조정
        const orderbook = await this.kisApiService.getOrderbook(request.symbol, request.userId);
        const newPrice = request.side === 'BUY'
          ? orderbook.bids[0]?.price
          : orderbook.asks[0]?.price;
        
        if (newPrice && newPrice !== currentPrice) {
          // 가격 조정 (주문 정정)
          await this.kisApiService.modifyOrder(
            childOrderId,
            order.remainingQuantity,
            newPrice,
            request.userId,
          );
          
          this.logger.debug(`Adjusted order price: ${currentPrice} -> ${newPrice}`);
        }
      } catch (error) {
        this.logger.error(`Order monitoring error: ${error.message}`);
      }
    }, 10000); // 10초마다 체크
  }

  /**
   * 거래량 프로필 조회 (분봉 기준)
   */
  private async getVolumeProfile(symbol: string): Promise<number[]> {
    if (this.volumeProfile.has(symbol)) {
      return this.volumeProfile.get(symbol)!;
    }
    
    try {
      const candles = await this.kisApiService.getIntradayCandles(symbol, 1);
      const volumes = candles.slice(0, 60).map(c => c.volume);
      
      // 정규화
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length || 1;
      const normalized = volumes.map(v => v / avgVolume);
      
      this.volumeProfile.set(symbol, normalized);
      return normalized;
    } catch {
      // 기본 프로필 (균등)
      return new Array(60).fill(1);
    }
  }

  /**
   * 급등락 체크
   */
  private async checkPriceSpike(symbol: string): Promise<boolean> {
    try {
      const quote = await this.kisApiService.getQuote(symbol);
      return Math.abs(quote.changeRate) > 3; // 3% 이상 변동
    } catch {
      return false;
    }
  }

  /**
   * VWAP 계산
   */
  private async calculateVWAP(symbol: string): Promise<number> {
    try {
      const candles = await this.kisApiService.getIntradayCandles(symbol, 1);
      
      let volumeSum = 0;
      let priceVolumeSum = 0;
      
      for (const candle of candles) {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        priceVolumeSum += typicalPrice * candle.volume;
        volumeSum += candle.volume;
      }
      
      return volumeSum > 0 ? priceVolumeSum / volumeSum : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 스마트 주문 취소
   */
  async cancelSmartOrder(orderId: string, userId: string): Promise<void> {
    const activeOrder = this.activeOrders.get(orderId);
    if (!activeOrder) {
      throw new Error(`Smart order not found: ${orderId}`);
    }
    
    // 미체결 자식 주문 취소
    for (const childOrderId of activeOrder.result.childOrders) {
      try {
        await this.kisApiService.cancelOrder(childOrderId, 0, userId);
      } catch (error) {
        this.logger.warn(`Failed to cancel child order: ${childOrderId}`);
      }
    }
    
    activeOrder.result.status = 'CANCELLED';
    this.activeOrders.delete(orderId);
    
    this.logger.log(`Smart order cancelled: ${orderId}`);
  }

  /**
   * 활성 스마트 주문 조회
   */
  getActiveOrders(userId: string): SmartOrderResult[] {
    return Array.from(this.activeOrders.values())
      .filter(o => o.request.userId === userId)
      .map(o => o.result);
  }

  /**
   * 거래량 프로필 갱신 (매시간)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshVolumeProfiles(): Promise<void> {
    this.volumeProfile.clear();
    this.logger.debug('Volume profiles cleared');
  }
}
