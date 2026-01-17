/**
 * Trend Following Strategy
 * 추세추종 전략
 * 
 * 상승/하락 추세를 감지하고 추세 방향으로 진입
 * - 이동평균선 크로스 (골든크로스/데드크로스)
 * - MACD 시그널
 * - ADX 추세 강도
 */

import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@stockboom/database';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IStrategy,
  BaseStrategyConfig,
  StrategyResult,
  StrategyMetrics,
  StrategyState,
} from './strategy.interface';
import { TradingSignal } from '../../trading-engine/trading-engine.types';
import { IndicatorsService } from '../../analysis/indicators.service';
import { KisApiService } from '../../market-data/kis-api.service';

/**
 * 추세 지표 타입
 */
export type TrendIndicatorType = 'MA_CROSS' | 'MACD' | 'ADX' | 'SUPERTREND';

/**
 * 추세 방향
 */
export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';

/**
 * 추세추종 전략 설정
 */
export interface TrendFollowingConfig extends BaseStrategyConfig {
  indicator: TrendIndicatorType;
  
  // 이동평균선 설정
  fastPeriod: number;          // 단기 이평 기간
  slowPeriod: number;          // 장기 이평 기간
  signalPeriod?: number;       // 시그널 기간 (MACD용)
  
  // ADX 설정
  adxPeriod?: number;          // ADX 기간 (기본 14)
  adxThreshold?: number;       // ADX 진입 임계값 (기본 25)
  
  // 진입 조건
  confirmationCandles?: number; // 확인 캔들 수 (기본 1)
  volumeConfirmation?: boolean; // 거래량 확인
  volumeMultiple?: number;      // 평균 대비 거래량 배수
  
  // 청산 조건
  exitOnTrendChange?: boolean;  // 추세 전환 시 청산
  trailingStop?: boolean;       // 트레일링 스탑
  trailingStopPercent?: number; // 트레일링 스탑 %
}

interface TrendState {
  direction: TrendDirection;
  strength: number;         // 0-100
  duration: number;         // 추세 지속 캔들 수
  entryPrice?: number;
  highPrice?: number;
  lowPrice?: number;
}

@Injectable()
export class TrendFollowingStrategy implements IStrategy<TrendFollowingConfig> {
  private readonly logger = new Logger(TrendFollowingStrategy.name);
  
  readonly id: string;
  readonly type = 'TREND_FOLLOWING';
  readonly name: string;
  
  config: TrendFollowingConfig;
  state: StrategyState = 'IDLE';
  
  private trendStates: Map<string, TrendState> = new Map();
  private previousSignals: Map<string, TrendDirection> = new Map();

  constructor(
    id: string,
    config: TrendFollowingConfig,
    private indicatorsService: IndicatorsService,
    private kisApiService: KisApiService,
    private eventEmitter: EventEmitter2,
  ) {
    this.id = id;
    this.name = config.name;
    this.config = {
      // 기본값 설정
      confirmationCandles: 1,
      adxPeriod: 14,
      adxThreshold: 25,
      volumeMultiple: 1.5,
      trailingStopPercent: 3,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    this.logger.log(`Initializing Trend Following Strategy: ${this.name}`);
    this.state = 'ACTIVE';
  }

  async dispose(): Promise<void> {
    this.state = 'IDLE';
    this.trendStates.clear();
    this.previousSignals.clear();
  }

  /**
   * 전략 평가
   */
  async evaluate(stockId: string): Promise<StrategyResult> {
    if (this.state !== 'ACTIVE') {
      return this.noSignal(stockId, 'Strategy not active');
    }

    try {
      const stock = await prisma.stock.findUnique({
        where: { id: stockId },
      });

      if (!stock || !this.config.symbols.includes(stock.symbol)) {
        return this.noSignal(stockId, 'Stock not in strategy');
      }

      const symbol = stock.symbol;

      // 추세 감지
      const trend = await this.detectTrend(stockId, symbol);
      const previousSignal = this.previousSignals.get(symbol);

      // 추세 상태 업데이트
      this.updateTrendState(symbol, trend);

      // 신호 생성 조건 확인
      const signal = await this.generateSignalFromTrend(
        stockId,
        symbol,
        trend,
        previousSignal,
      );

      if (signal) {
        this.previousSignals.set(symbol, trend.direction);
        return {
          strategyId: this.id,
          stockId,
          symbol,
          signal,
          reason: `Trend ${trend.direction} (strength: ${trend.strength}%)`,
          metadata: {
            trendDirection: trend.direction,
            trendStrength: trend.strength,
            indicator: this.config.indicator,
          },
          executedAt: new Date(),
        };
      }

      return this.noSignal(stockId, 'No trend signal');

    } catch (error) {
      this.logger.error(`Trend evaluation error: ${error.message}`);
      return this.noSignal(stockId, `Error: ${error.message}`);
    }
  }

  /**
   * 추세 감지
   */
  async detectTrend(stockId: string, symbol: string): Promise<TrendState> {
    const { indicator, fastPeriod, slowPeriod, timeframe } = this.config;

    // 캔들 데이터 조회
    const candles = await prisma.candle.findMany({
      where: { stockId, timeframe },
      orderBy: { timestamp: 'desc' },
      take: Math.max(slowPeriod, 50) + 10,
    });

    if (candles.length < slowPeriod) {
      return { direction: 'SIDEWAYS', strength: 0, duration: 0 };
    }

    const prices = candles.map((c) => Number(c.close)).reverse();

    switch (indicator) {
      case 'MA_CROSS':
        return this.detectMACrossTrend(prices, fastPeriod, slowPeriod);
        
      case 'MACD':
        return this.detectMACDTrend(prices);
        
      case 'ADX':
        return this.detectADXTrend(stockId, symbol);
        
      default:
        return this.detectMACrossTrend(prices, fastPeriod, slowPeriod);
    }
  }

  /**
   * 이동평균선 크로스 추세 감지
   */
  private detectMACrossTrend(
    prices: number[],
    fastPeriod: number,
    slowPeriod: number,
  ): TrendState {
    const fastMA = this.indicatorsService.calculateEMA(prices, fastPeriod);
    const slowMA = this.indicatorsService.calculateEMA(prices, slowPeriod);

    if (fastMA.length < 2 || slowMA.length < 2) {
      return { direction: 'SIDEWAYS', strength: 0, duration: 0 };
    }

    const currentFast = fastMA[fastMA.length - 1];
    const currentSlow = slowMA[slowMA.length - 1];
    const previousFast = fastMA[fastMA.length - 2];
    const previousSlow = slowMA[slowMA.length - 2];

    // 크로스 감지
    const isGoldenCross = previousFast <= previousSlow && currentFast > currentSlow;
    const isDeadCross = previousFast >= previousSlow && currentFast < currentSlow;

    // 현재 방향
    let direction: TrendDirection = 'SIDEWAYS';
    if (currentFast > currentSlow) {
      direction = 'UP';
    } else if (currentFast < currentSlow) {
      direction = 'DOWN';
    }

    // 추세 강도 (이격도 기반)
    const gap = ((currentFast - currentSlow) / currentSlow) * 100;
    const strength = Math.min(100, Math.abs(gap) * 10);

    // 추세 지속 기간 계산
    let duration = 0;
    for (let i = fastMA.length - 1; i >= 0; i--) {
      const f = fastMA[i];
      const s = slowMA[i];
      if ((direction === 'UP' && f > s) || (direction === 'DOWN' && f < s)) {
        duration++;
      } else {
        break;
      }
    }

    return { direction, strength, duration };
  }

  /**
   * MACD 추세 감지
   */
  private detectMACDTrend(prices: number[]): TrendState {
    const macdResult = this.indicatorsService.calculateMACD(prices, {
      fastPeriod: this.config.fastPeriod,
      slowPeriod: this.config.slowPeriod,
      signalPeriod: this.config.signalPeriod || 9,
    });

    if (!macdResult || macdResult.length < 2) {
      return { direction: 'SIDEWAYS', strength: 0, duration: 0 };
    }

    const current = macdResult[macdResult.length - 1];
    const previous = macdResult[macdResult.length - 2];

    // 히스토그램 기반 추세
    let direction: TrendDirection = 'SIDEWAYS';
    const currentHistogram = current.histogram ?? 0;
    const previousHistogram = previous.histogram ?? 0;
    
    if (currentHistogram > 0 && currentHistogram > previousHistogram) {
      direction = 'UP';
    } else if (currentHistogram < 0 && currentHistogram < previousHistogram) {
      direction = 'DOWN';
    }

    // 강도 계산
    const strength = Math.min(100, Math.abs(currentHistogram) * 50);

    return { direction, strength, duration: 0 };
  }

  /**
   * ADX 추세 감지 (미래 구현)
   */
  private async detectADXTrend(stockId: string, symbol: string): Promise<TrendState> {
    // ADX 계산은 고가/저가/종가가 필요하므로 별도 구현
    // 현재는 간단한 구현
    return { direction: 'SIDEWAYS', strength: 0, duration: 0 };
  }

  /**
   * 추세 상태 업데이트
   */
  private updateTrendState(symbol: string, trend: TrendState): void {
    const currentState = this.trendStates.get(symbol);
    
    if (currentState && currentState.direction === trend.direction) {
      // 같은 추세 지속
      trend.duration = currentState.duration + 1;
      if (currentState.entryPrice) {
        trend.entryPrice = currentState.entryPrice;
        trend.highPrice = Math.max(currentState.highPrice || 0, trend.highPrice || 0);
        trend.lowPrice = currentState.lowPrice
          ? Math.min(currentState.lowPrice, trend.lowPrice || Infinity)
          : trend.lowPrice;
      }
    }
    
    this.trendStates.set(symbol, trend);
  }

  /**
   * 추세 기반 신호 생성
   */
  private async generateSignalFromTrend(
    stockId: string,
    symbol: string,
    trend: TrendState,
    previousSignal?: TrendDirection,
  ): Promise<TradingSignal | null> {
    const { confirmationCandles, volumeConfirmation, volumeMultiple } = this.config;

    // 약한 추세 무시
    if (trend.strength < 30) {
      return null;
    }

    // 횡보 무시
    if (trend.direction === 'SIDEWAYS') {
      return null;
    }

    // 확인 캔들 체크
    if (trend.duration < (confirmationCandles || 1)) {
      return null;
    }

    // 거래량 확인
    if (volumeConfirmation) {
      // TODO: 거래량 확인 로직
    }

    // 이전 신호와 같은 방향이면 스킵 (중복 진입 방지)
    if (previousSignal === trend.direction) {
      // 추세 전환 시 청산 체크
      return null;
    }

    // 현재가 조회
    const quote = await this.kisApiService.getQuote(symbol);
    const currentPrice = quote.currentPrice;

    // 신호 생성
    return {
      id: `TREND-${Date.now()}-${symbol}`,
      userId: '',
      stockId,
      symbol,
      side: trend.direction === 'UP' ? 'BUY' : 'SELL',
      source: 'INDICATOR',
      strength: trend.strength >= 70 ? 'STRONG' : 'MODERATE',
      price: currentPrice,
      stopLoss: this.config.stopLossPercent
        ? currentPrice * (1 - this.config.stopLossPercent / 100)
        : undefined,
      takeProfit: this.config.takeProfitPercent
        ? currentPrice * (1 + this.config.takeProfitPercent / 100)
        : undefined,
      confidence: trend.strength,
      reason: `${this.config.indicator} trend ${trend.direction} detected`,
      strategyId: this.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1시간 유효
    };
  }

  private noSignal(stockId: string, reason: string): StrategyResult {
    return {
      strategyId: this.id,
      stockId,
      symbol: '',
      signal: null,
      reason,
      executedAt: new Date(),
    };
  }

  updateConfig(config: Partial<TrendFollowingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async getMetrics(): Promise<StrategyMetrics> {
    const trades = await prisma.trade.findMany({
      where: { strategyId: this.id },
    });

    const winningTrades = trades.filter(
      (t) => t.orderSide === 'SELL' && Number(t.totalAmount || 0) > 0,
    );

    const totalPnL = trades.reduce((sum, t) => {
      const amount = Number(t.totalAmount || 0);
      return t.orderSide === 'SELL' ? sum + amount : sum - amount;
    }, 0);

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: trades.length - winningTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalProfitLoss: totalPnL,
      maxDrawdown: 0,
      averageReturn: trades.length > 0 ? totalPnL / trades.length : 0,
      averageHoldingPeriod: 0,
    };
  }

  /**
   * 현재 추세 상태 조회
   */
  getTrendState(symbol: string): TrendState | undefined {
    return this.trendStates.get(symbol);
  }
}
