import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { prisma } from '@stockboom/database';
import { IndicatorsService } from '../analysis/indicators.service';
import { AuditTrailService } from './audit-trail.service';
import {
  TradingSignal,
  SignalSource,
  SignalStrength,
  PriceSpikeEvent,
  LargeVolumeEvent,
} from './trading-engine.types';
import { RealTimePrice } from '../market-data/kis-websocket.service';

/**
 * Signal Processor Service
 * 다양한 소스의 매매 신호를 통합 처리하는 서비스
 * 
 * 책임:
 * - 지표 기반 신호 생성
 * - AI 신호 처리
 * - 실시간 가격 이벤트 처리
 * - 신호 필터링 및 우선순위 지정
 */
@Injectable()
export class SignalProcessorService {
  private readonly logger = new Logger(SignalProcessorService.name);

  // 활성화된 종목별 신호 큐
  private signalQueue = new Map<string, TradingSignal[]>();

  // 급등락 감지 설정
  private readonly SPIKE_THRESHOLD_PERCENT = 3;  // 3% 이상 급등락
  private readonly LARGE_VOLUME_RATIO = 3;       // 평균 대비 3배 이상

  // 가격 히스토리 (급등락 감지용)
  private priceHistory = new Map<string, { price: number; timestamp: Date }[]>();
  private volumeHistory = new Map<string, number[]>();

  constructor(
    private indicatorsService: IndicatorsService,
    private auditTrailService: AuditTrailService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 지표 기반 신호 생성
   */
  async generateIndicatorSignal(
    userId: string,
    stockId: string,
    timeframe: string = '1d',
  ): Promise<TradingSignal | null> {
    try {
      const stock = await prisma.stock.findUnique({
        where: { id: stockId },
      });

      if (!stock) {
        this.logger.warn(`Stock not found: ${stockId}`);
        return null;
      }

      // 기술적 지표 기반 신호 생성
      const signalResult = await this.indicatorsService.generateTradingSignal(
        stockId,
        timeframe,
      );

      if (!signalResult || signalResult.signal === 'HOLD') {
        return null;
      }

      // Map signal to BUY/SELL (STRONG_BUY -> BUY, STRONG_SELL -> SELL)
      let side: 'BUY' | 'SELL';
      if (signalResult.signal === 'BUY' || signalResult.signal === 'STRONG_BUY') {
        side = 'BUY';
      } else if (signalResult.signal === 'SELL' || signalResult.signal === 'STRONG_SELL') {
        side = 'SELL';
      } else {
        return null;
      }

      const signal: TradingSignal = {
        id: `IND-${Date.now()}-${stockId}`,
        userId,
        stockId,
        symbol: stock.symbol,
        side,
        source: 'INDICATOR',
        strength: this.calculateStrength(signalResult.strength),
        price: Number(stock.currentPrice) || 0,
        confidence: signalResult.strength,
        reason: `RSI: ${signalResult.indicators.rsi}, MACD: ${signalResult.indicators.macd}`,
        createdAt: new Date(),
        expiresAt: this.getExpirationTime(timeframe),
      };

      this.addToQueue(stockId, signal);

      await this.auditTrailService.logStrategyEvent(
        userId,
        'INDICATOR',
        'SIGNAL_GENERATED',
        {
          symbol: stock.symbol,
          signal: signal.side,
          strength: signal.strength,
          confidence: signal.confidence,
          reason: signal.reason,
        },
      );

      return signal;
    } catch (error) {
      this.logger.error(`Failed to generate indicator signal: ${error.message}`);
      return null;
    }
  }

  /**
   * AI 예측 신호 처리
   */
  async processAISignal(
    userId: string,
    stockId: string,
    prediction: {
      side: 'BUY' | 'SELL';
      confidence: number;
      targetPrice?: number;
      stopLoss?: number;
      reason: string;
    },
  ): Promise<TradingSignal | null> {
    try {
      const stock = await prisma.stock.findUnique({
        where: { id: stockId },
      });

      if (!stock) return null;

      // AI 신호는 높은 신뢰도만 처리
      if (prediction.confidence < 70) {
        this.logger.debug(
          `AI signal for ${stock.symbol} rejected: low confidence ${prediction.confidence}`,
        );
        return null;
      }

      const signal: TradingSignal = {
        id: `AI-${Date.now()}-${stockId}`,
        userId,
        stockId,
        symbol: stock.symbol,
        side: prediction.side,
        source: 'AI',
        strength: this.calculateStrength(prediction.confidence),
        price: Number(stock.currentPrice) || 0,
        targetPrice: prediction.targetPrice,
        stopLoss: prediction.stopLoss,
        confidence: prediction.confidence,
        reason: prediction.reason,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24시간
      };

      this.addToQueue(stockId, signal);

      await this.auditTrailService.logStrategyEvent(
        userId,
        'AI',
        'AI_SIGNAL_PROCESSED',
        {
          symbol: stock.symbol,
          signal: signal.side,
          confidence: signal.confidence,
          targetPrice: signal.targetPrice,
          stopLoss: signal.stopLoss,
        },
      );

      return signal;
    } catch (error) {
      this.logger.error(`Failed to process AI signal: ${error.message}`);
      return null;
    }
  }

  /**
   * 실시간 가격 이벤트 처리
   */
  @OnEvent('realtime.price')
  async handlePriceEvent(data: RealTimePrice): Promise<void> {
    try {
      // 가격 히스토리 업데이트
      this.updatePriceHistory(data.symbol, data.price);

      // 급등락 감지
      const spikeEvent = await this.detectPriceSpike(data);
      if (spikeEvent) {
        this.eventEmitter.emit('signal.price-spike', spikeEvent);
      }

      // 대량 거래 감지
      const volumeEvent = await this.detectLargeVolume(data);
      if (volumeEvent) {
        this.eventEmitter.emit('signal.large-volume', volumeEvent);
      }
    } catch (error) {
      this.logger.error(`Error processing price event: ${error.message}`);
    }
  }

  /**
   * 급등락 감지
   */
  async detectPriceSpike(
    priceData: RealTimePrice,
  ): Promise<PriceSpikeEvent | null> {
    const history = this.priceHistory.get(priceData.symbol) || [];
    
    if (history.length < 2) return null;

    // 1분 전 가격과 비교
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const previousPrice = history.find(
      (h) => h.timestamp.getTime() <= oneMinuteAgo,
    );

    if (!previousPrice) return null;

    const changePercent =
      ((priceData.price - previousPrice.price) / previousPrice.price) * 100;

    if (Math.abs(changePercent) >= this.SPIKE_THRESHOLD_PERCENT) {
      const stock = await prisma.stock.findUnique({
        where: { symbol: priceData.symbol },
      });

      return {
        symbol: priceData.symbol,
        stockId: stock?.id || '',
        currentPrice: priceData.price,
        previousPrice: previousPrice.price,
        changePercent,
        volume: priceData.volume,
        direction: changePercent > 0 ? 'UP' : 'DOWN',
        timestamp: priceData.timestamp,
      };
    }

    return null;
  }

  /**
   * 대량 거래 감지
   */
  async detectLargeVolume(
    priceData: RealTimePrice,
  ): Promise<LargeVolumeEvent | null> {
    const history = this.volumeHistory.get(priceData.symbol) || [];
    
    if (history.length < 10) {
      // 히스토리 누적
      history.push(priceData.volume);
      if (history.length > 100) history.shift();
      this.volumeHistory.set(priceData.symbol, history);
      return null;
    }

    const avgVolume = history.reduce((a, b) => a + b, 0) / history.length;
    const volumeRatio = priceData.volume / avgVolume;

    if (volumeRatio >= this.LARGE_VOLUME_RATIO) {
      const stock = await prisma.stock.findUnique({
        where: { symbol: priceData.symbol },
      });

      return {
        symbol: priceData.symbol,
        stockId: stock?.id || '',
        volume: priceData.volume,
        avgVolume,
        volumeRatio,
        price: priceData.price,
        timestamp: priceData.timestamp,
      };
    }

    // 히스토리 업데이트
    history.push(priceData.volume);
    if (history.length > 100) history.shift();
    this.volumeHistory.set(priceData.symbol, history);

    return null;
  }

  /**
   * 신호 필터링 및 우선순위 지정
   */
  async filterAndPrioritizeSignals(
    signals: TradingSignal[],
  ): Promise<TradingSignal[]> {
    // 만료된 신호 제거
    const now = new Date();
    const validSignals = signals.filter(
      (s) => !s.expiresAt || s.expiresAt > now,
    );

    // 우선순위 점수 계산
    const scoredSignals = validSignals.map((signal) => ({
      signal,
      score: this.calculatePriorityScore(signal),
    }));

    // 점수 기준 정렬 (높은 순)
    scoredSignals.sort((a, b) => b.score - a.score);

    // 중복 제거 (같은 종목에 대해 가장 높은 점수만)
    const seen = new Set<string>();
    const prioritized: TradingSignal[] = [];

    for (const { signal } of scoredSignals) {
      const key = `${signal.stockId}-${signal.side}`;
      if (!seen.has(key)) {
        seen.add(key);
        prioritized.push(signal);
      }
    }

    return prioritized;
  }

  /**
   * 큐에 신호 추가
   */
  private addToQueue(stockId: string, signal: TradingSignal): void {
    const queue = this.signalQueue.get(stockId) || [];
    queue.push(signal);
    
    // 큐 크기 제한
    if (queue.length > 10) queue.shift();
    
    this.signalQueue.set(stockId, queue);

    // 이벤트 발행
    this.eventEmitter.emit('signal.new', signal);
  }

  /**
   * 종목별 대기 신호 조회
   */
  getPendingSignals(stockId: string): TradingSignal[] {
    const now = new Date();
    return (this.signalQueue.get(stockId) || []).filter(
      (s) => !s.expiresAt || s.expiresAt > now,
    );
  }

  /**
   * 모든 대기 신호 조회
   */
  getAllPendingSignals(): TradingSignal[] {
    const all: TradingSignal[] = [];
    const now = new Date();

    for (const signals of this.signalQueue.values()) {
      all.push(...signals.filter((s) => !s.expiresAt || s.expiresAt > now));
    }

    return all;
  }

  /**
   * 신호 강도 계산
   */
  private calculateStrength(confidence: number): SignalStrength {
    if (confidence >= 80) return 'STRONG';
    if (confidence >= 60) return 'MODERATE';
    return 'WEAK';
  }

  /**
   * 만료 시간 계산
   */
  private getExpirationTime(timeframe: string): Date {
    const now = Date.now();
    const durations: Record<string, number> = {
      '1m': 5 * 60 * 1000,       // 5분
      '5m': 15 * 60 * 1000,      // 15분
      '15m': 60 * 60 * 1000,     // 1시간
      '1h': 4 * 60 * 60 * 1000,  // 4시간
      '1d': 24 * 60 * 60 * 1000, // 24시간
    };
    return new Date(now + (durations[timeframe] || durations['1d']));
  }

  /**
   * 우선순위 점수 계산
   */
  private calculatePriorityScore(signal: TradingSignal): number {
    let score = 0;

    // 신뢰도 기반
    score += signal.confidence;

    // 소스별 가중치
    const sourceWeights: Record<SignalSource, number> = {
      AI: 20,
      INDICATOR: 15,
      CONDITION_SEARCH: 10,
      SCHEDULED: 5,
      MANUAL: 25, // 수동 신호 최우선
    };
    score += sourceWeights[signal.source] || 0;

    // 강도별 가중치
    const strengthWeights: Record<SignalStrength, number> = {
      STRONG: 15,
      MODERATE: 10,
      WEAK: 5,
    };
    score += strengthWeights[signal.strength] || 0;

    // 신선도 (최근 신호 우선)
    const ageMinutes = (Date.now() - signal.createdAt.getTime()) / 60000;
    score -= Math.min(ageMinutes, 30); // 최대 30점 감점

    return score;
  }

  /**
   * 가격 히스토리 업데이트
   */
  private updatePriceHistory(symbol: string, price: number): void {
    const history = this.priceHistory.get(symbol) || [];
    history.push({ price, timestamp: new Date() });

    // 최근 5분만 유지
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const filtered = history.filter(
      (h) => h.timestamp.getTime() > fiveMinutesAgo,
    );

    this.priceHistory.set(symbol, filtered);
  }

  /**
   * 신호 큐 클리어
   */
  clearSignalQueue(stockId?: string): void {
    if (stockId) {
      this.signalQueue.delete(stockId);
    } else {
      this.signalQueue.clear();
    }
  }
}
