/**
 * Mean Reversion Strategy
 * 평균회귀 전략
 * 
 * 가격이 평균에서 벗어났을 때 평균으로 회귀할 것을 기대하고 역진입
 * - 볼린저 밴드 이탈 시 진입
 * - RSI 과매수/과매도 시 진입
 * - 가격이 이동평균선에서 크게 벗어날 때 진입
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
 * 평균회귀 지표 타입
 */
export type MeanReversionIndicator = 'BOLLINGER' | 'RSI' | 'DEVIATION' | 'ZSCORE';

/**
 * 평균회귀 전략 설정
 */
export interface MeanReversionConfig extends BaseStrategyConfig {
  indicator: MeanReversionIndicator;
  
  // 공통 설정
  lookbackPeriod: number;       // 평균 계산 기간 (기본 20)
  deviationThreshold: number;   // 진입 임계값 (표준편차 배수 또는 %)
  
  // 볼린저 밴드 설정
  bollingerStd?: number;        // 표준편차 배수 (기본 2)
  
  // RSI 설정
  rsiPeriod?: number;           // RSI 기간 (기본 14)
  rsiOverbought?: number;       // 과매수 임계값 (기본 70)
  rsiOversold?: number;         // 과매도 임계값 (기본 30)
  
  // Z-Score 설정
  zScoreThreshold?: number;     // Z-Score 진입 임계값 (기본 2)
  
  // 청산 조건
  exitOnMeanReversion?: boolean; // 평균 도달 시 청산
  profitTarget?: number;         // 목표 수익률 %
}

interface DeviationState {
  currentDeviation: number;     // 현재 이격도
  meanPrice: number;            // 평균가
  upperBand?: number;           // 상단 밴드
  lowerBand?: number;           // 하단 밴드
  rsi?: number;                 // RSI 값
  zScore?: number;              // Z-Score 값
  isOverbought: boolean;
  isOversold: boolean;
}

@Injectable()
export class MeanReversionStrategy implements IStrategy<MeanReversionConfig> {
  private readonly logger = new Logger(MeanReversionStrategy.name);
  
  readonly id: string;
  readonly type = 'MEAN_REVERSION';
  readonly name: string;
  
  config: MeanReversionConfig;
  state: StrategyState = 'IDLE';
  
  private deviationStates: Map<string, DeviationState> = new Map();
  private activePositions: Map<string, { side: 'BUY' | 'SELL'; entryPrice: number }> = new Map();

  constructor(
    id: string,
    config: MeanReversionConfig,
    private indicatorsService: IndicatorsService,
    private kisApiService: KisApiService,
    private eventEmitter: EventEmitter2,
  ) {
    this.id = id;
    this.name = config.name;
    this.config = {
      bollingerStd: 2,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      zScoreThreshold: 2,
      exitOnMeanReversion: true,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    this.logger.log(`Initializing Mean Reversion Strategy: ${this.name}`);
    this.state = 'ACTIVE';
  }

  async dispose(): Promise<void> {
    this.state = 'IDLE';
    this.deviationStates.clear();
    this.activePositions.clear();
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

      // 이격도 계산
      const deviation = await this.calculateDeviation(stockId, symbol);
      this.deviationStates.set(symbol, deviation);

      // 기존 포지션 확인
      const activePosition = this.activePositions.get(symbol);
      
      // 청산 조건 체크
      if (activePosition && this.config.exitOnMeanReversion) {
        const exitSignal = this.checkExitCondition(
          stockId,
          symbol,
          deviation,
          activePosition,
        );
        if (exitSignal) {
          this.activePositions.delete(symbol);
          return {
            strategyId: this.id,
            stockId,
            symbol,
            signal: exitSignal,
            reason: 'Mean reversion exit',
            metadata: { deviation: deviation.currentDeviation },
            executedAt: new Date(),
          };
        }
      }

      // 신규 진입 조건 체크
      if (!activePosition) {
        const entrySignal = await this.checkEntryCondition(
          stockId,
          symbol,
          deviation,
        );
        if (entrySignal) {
          this.activePositions.set(symbol, {
            side: entrySignal.side,
            entryPrice: entrySignal.price,
          });
          return {
            strategyId: this.id,
            stockId,
            symbol,
            signal: entrySignal,
            reason: `Mean reversion ${entrySignal.side} - deviation: ${deviation.currentDeviation.toFixed(2)}%`,
            metadata: {
              deviation: deviation.currentDeviation,
              meanPrice: deviation.meanPrice,
              rsi: deviation.rsi,
            },
            executedAt: new Date(),
          };
        }
      }

      return this.noSignal(stockId, 'No mean reversion signal');

    } catch (error) {
      this.logger.error(`Mean reversion evaluation error: ${error.message}`);
      return this.noSignal(stockId, `Error: ${error.message}`);
    }
  }

  /**
   * 이격도 계산
   */
  async calculateDeviation(stockId: string, symbol: string): Promise<DeviationState> {
    const { indicator, lookbackPeriod, timeframe } = this.config;

    // 캔들 데이터 조회
    const candles = await prisma.candle.findMany({
      where: { stockId, timeframe },
      orderBy: { timestamp: 'desc' },
      take: lookbackPeriod + 10,
    });

    if (candles.length < lookbackPeriod) {
      return {
        currentDeviation: 0,
        meanPrice: 0,
        isOverbought: false,
        isOversold: false,
      };
    }

    const prices = candles.map((c) => Number(c.close)).reverse();
    const currentPrice = prices[prices.length - 1];

    switch (indicator) {
      case 'BOLLINGER':
        return this.calculateBollingerDeviation(prices, currentPrice);
        
      case 'RSI':
        return this.calculateRSIDeviation(prices, currentPrice);
        
      case 'ZSCORE':
        return this.calculateZScoreDeviation(prices, currentPrice);
        
      default:
        return this.calculateSimpleDeviation(prices, currentPrice);
    }
  }

  /**
   * 볼린저 밴드 이격도 계산
   */
  private calculateBollingerDeviation(
    prices: number[],
    currentPrice: number,
  ): DeviationState {
    const { lookbackPeriod, bollingerStd } = this.config;
    
    const bands = this.indicatorsService.calculateBollingerBands(
      prices,
      lookbackPeriod,
      bollingerStd || 2,
    );

    if (bands.length === 0) {
      return {
        currentDeviation: 0,
        meanPrice: currentPrice,
        isOverbought: false,
        isOversold: false,
      };
    }

    const lastBand = bands[bands.length - 1];
    const bandWidth = lastBand.upper - lastBand.lower;
    const deviationFromMiddle = ((currentPrice - lastBand.middle) / lastBand.middle) * 100;

    return {
      currentDeviation: deviationFromMiddle,
      meanPrice: lastBand.middle,
      upperBand: lastBand.upper,
      lowerBand: lastBand.lower,
      isOverbought: currentPrice > lastBand.upper,
      isOversold: currentPrice < lastBand.lower,
    };
  }

  /**
   * RSI 기반 이격도 계산
   */
  private calculateRSIDeviation(
    prices: number[],
    currentPrice: number,
  ): DeviationState {
    const { rsiPeriod, rsiOverbought, rsiOversold, lookbackPeriod } = this.config;
    
    const rsiValues = this.indicatorsService.calculateRSI(prices, rsiPeriod || 14);
    const sma = this.indicatorsService.calculateSMA(prices, lookbackPeriod);

    if (rsiValues.length === 0 || sma.length === 0) {
      return {
        currentDeviation: 0,
        meanPrice: currentPrice,
        isOverbought: false,
        isOversold: false,
      };
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    const meanPrice = sma[sma.length - 1];
    const deviationFromMean = ((currentPrice - meanPrice) / meanPrice) * 100;

    return {
      currentDeviation: deviationFromMean,
      meanPrice,
      rsi: currentRSI,
      isOverbought: currentRSI > (rsiOverbought || 70),
      isOversold: currentRSI < (rsiOversold || 30),
    };
  }

  /**
   * Z-Score 기반 이격도 계산
   */
  private calculateZScoreDeviation(
    prices: number[],
    currentPrice: number,
  ): DeviationState {
    const { lookbackPeriod } = this.config;
    
    const recentPrices = prices.slice(-lookbackPeriod);
    const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / recentPrices.length;
    const stdDev = Math.sqrt(variance);

    const zScore = stdDev > 0 ? (currentPrice - mean) / stdDev : 0;
    const { zScoreThreshold } = this.config;

    return {
      currentDeviation: ((currentPrice - mean) / mean) * 100,
      meanPrice: mean,
      zScore,
      isOverbought: zScore > (zScoreThreshold || 2),
      isOversold: zScore < -(zScoreThreshold || 2),
    };
  }

  /**
   * 단순 이격도 계산
   */
  private calculateSimpleDeviation(
    prices: number[],
    currentPrice: number,
  ): DeviationState {
    const { lookbackPeriod, deviationThreshold } = this.config;
    
    const sma = this.indicatorsService.calculateSMA(prices, lookbackPeriod);
    const meanPrice = sma[sma.length - 1];
    const deviation = ((currentPrice - meanPrice) / meanPrice) * 100;

    return {
      currentDeviation: deviation,
      meanPrice,
      isOverbought: deviation > deviationThreshold,
      isOversold: deviation < -deviationThreshold,
    };
  }

  /**
   * 진입 조건 체크
   */
  private async checkEntryCondition(
    stockId: string,
    symbol: string,
    deviation: DeviationState,
  ): Promise<TradingSignal | null> {
    const { deviationThreshold } = this.config;

    // 과매도 시 매수 (상승 기대)
    if (deviation.isOversold) {
      const quote = await this.kisApiService.getQuote(symbol);
      return this.createSignal(
        stockId,
        symbol,
        'BUY',
        quote.currentPrice,
        `Oversold condition (deviation: ${deviation.currentDeviation.toFixed(2)}%)`,
      );
    }

    // 과매수 시 매도 (하락 기대)
    if (deviation.isOverbought) {
      const quote = await this.kisApiService.getQuote(symbol);
      return this.createSignal(
        stockId,
        symbol,
        'SELL',
        quote.currentPrice,
        `Overbought condition (deviation: ${deviation.currentDeviation.toFixed(2)}%)`,
      );
    }

    return null;
  }

  /**
   * 청산 조건 체크
   */
  private checkExitCondition(
    stockId: string,
    symbol: string,
    deviation: DeviationState,
    position: { side: 'BUY' | 'SELL'; entryPrice: number },
  ): TradingSignal | null {
    // 평균 도달 시 청산
    if (Math.abs(deviation.currentDeviation) < 0.5) {
      return this.createSignal(
        stockId,
        symbol,
        position.side === 'BUY' ? 'SELL' : 'BUY',
        deviation.meanPrice,
        'Mean reversion complete',
      );
    }

    // 목표 수익률 도달 시 청산
    if (this.config.profitTarget) {
      const currentPnL = position.side === 'BUY'
        ? ((deviation.meanPrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - deviation.meanPrice) / position.entryPrice) * 100;

      if (currentPnL >= this.config.profitTarget) {
        return this.createSignal(
          stockId,
          symbol,
          position.side === 'BUY' ? 'SELL' : 'BUY',
          deviation.meanPrice,
          `Profit target reached (${currentPnL.toFixed(2)}%)`,
        );
      }
    }

    return null;
  }

  private createSignal(
    stockId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    price: number,
    reason: string,
  ): TradingSignal {
    return {
      id: `MR-${Date.now()}-${symbol}`,
      userId: '',
      stockId,
      symbol,
      side,
      source: 'INDICATOR',
      strength: 'MODERATE',
      price,
      confidence: 70,
      reason,
      strategyId: this.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30분 유효
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

  updateConfig(config: Partial<MeanReversionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async getMetrics(): Promise<StrategyMetrics> {
    const trades = await prisma.trade.findMany({
      where: { strategyId: this.id },
    });

    const totalPnL = trades.reduce((sum, t) => {
      const amount = Number(t.totalAmount || 0);
      return t.orderSide === 'SELL' ? sum + amount : sum - amount;
    }, 0);

    return {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfitLoss: totalPnL,
      maxDrawdown: 0,
      averageReturn: 0,
      averageHoldingPeriod: 0,
    };
  }

  /**
   * 현재 이격도 상태 조회
   */
  getDeviationState(symbol: string): DeviationState | undefined {
    return this.deviationStates.get(symbol);
  }
}
