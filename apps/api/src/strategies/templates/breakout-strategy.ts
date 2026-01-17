/**
 * Breakout Strategy
 * 돌파 매매 전략
 * 
 * 지지/저항선 돌파 시 추세 방향으로 진입
 * - 가격 범위 돌파
 * - 볼린저 밴드 돌파
 * - 돈치안 채널 돌파
 * - 거래량 확인
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
 * 돌파 타입
 */
export type BreakoutType = 'RANGE' | 'BOLLINGER' | 'DONCHIAN' | 'HIGH_LOW';

/**
 * 돌파 전략 설정
 */
export interface BreakoutConfig extends BaseStrategyConfig {
  breakoutType: BreakoutType;
  
  // 범위 설정
  lookbackPeriod: number;         // 돌파 판단 기간 (기본 20)
  
  // 확인 조건
  confirmationCandles: number;    // 확인 캔들 수 (기본 1)
  breakoutMargin: number;         // 돌파 마진 % (기본 0.5%)
  
  // 거래량 필터
  volumeFilter: boolean;          // 거래량 확인 여부
  volumeMultiple: number;         // 평균 대비 거래량 배수 (기본 1.5)
  
  // 재진입 방지
  cooldownMinutes?: number;       // 재진입 대기 시간 (분)
  
  // 실패한 돌파 필터
  falseBreakoutFilter?: boolean;  // 가짜 돌파 필터
  falseBreakoutPeriod?: number;   // 가짜 돌파 판단 기간 (캔들 수)
}

interface BreakoutLevel {
  resistance: number;     // 저항선
  support: number;        // 지지선
  lastBreakout?: {
    direction: 'UP' | 'DOWN';
    price: number;
    timestamp: Date;
  };
}

@Injectable()
export class BreakoutStrategy implements IStrategy<BreakoutConfig> {
  private readonly logger = new Logger(BreakoutStrategy.name);
  
  readonly id: string;
  readonly type = 'BREAKOUT';
  readonly name: string;
  
  config: BreakoutConfig;
  state: StrategyState = 'IDLE';
  
  private breakoutLevels: Map<string, BreakoutLevel> = new Map();
  private lastBreakoutTime: Map<string, Date> = new Map();

  constructor(
    id: string,
    config: BreakoutConfig,
    private indicatorsService: IndicatorsService,
    private kisApiService: KisApiService,
    private eventEmitter: EventEmitter2,
  ) {
    this.id = id;
    this.name = config.name;
    this.config = {
      ...config,
      confirmationCandles: config.confirmationCandles ?? 1,
      breakoutMargin: config.breakoutMargin ?? 0.5,
      volumeFilter: config.volumeFilter ?? true,
      volumeMultiple: config.volumeMultiple ?? 1.5,
      cooldownMinutes: config.cooldownMinutes ?? 30,
      falseBreakoutFilter: config.falseBreakoutFilter ?? true,
      falseBreakoutPeriod: config.falseBreakoutPeriod ?? 3,
    };
  }

  async initialize(): Promise<void> {
    this.logger.log(`Initializing Breakout Strategy: ${this.name}`);
    
    // 각 종목의 돌파 레벨 초기화
    for (const symbol of this.config.symbols) {
      await this.calculateBreakoutLevels(symbol);
    }
    
    this.state = 'ACTIVE';
  }

  async dispose(): Promise<void> {
    this.state = 'IDLE';
    this.breakoutLevels.clear();
    this.lastBreakoutTime.clear();
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

      // 쿨다운 체크
      if (this.isInCooldown(symbol)) {
        return this.noSignal(stockId, 'In cooldown period');
      }

      // 돌파 레벨 업데이트
      await this.calculateBreakoutLevels(symbol, stockId);
      const levels = this.breakoutLevels.get(symbol);

      if (!levels) {
        return this.noSignal(stockId, 'No breakout levels');
      }

      // 현재가 조회
      const quote = await this.kisApiService.getQuote(symbol);
      const currentPrice = quote.currentPrice;

      // 돌파 감지
      const breakout = await this.detectBreakout(
        stockId,
        symbol,
        currentPrice,
        levels,
      );

      if (breakout) {
        this.lastBreakoutTime.set(symbol, new Date());
        this.breakoutLevels.set(symbol, {
          ...levels,
          lastBreakout: {
            direction: breakout.side === 'BUY' ? 'UP' : 'DOWN',
            price: currentPrice,
            timestamp: new Date(),
          },
        });

        return {
          strategyId: this.id,
          stockId,
          symbol,
          signal: breakout,
          reason: `Breakout ${breakout.side} at ${currentPrice}`,
          metadata: {
            resistance: levels.resistance,
            support: levels.support,
            breakoutPrice: currentPrice,
          },
          executedAt: new Date(),
        };
      }

      return this.noSignal(stockId, 'No breakout detected');

    } catch (error) {
      this.logger.error(`Breakout evaluation error: ${error.message}`);
      return this.noSignal(stockId, `Error: ${error.message}`);
    }
  }

  /**
   * 돌파 레벨 계산
   */
  async calculateBreakoutLevels(symbol: string, stockId?: string): Promise<void> {
    const { breakoutType, lookbackPeriod, timeframe } = this.config;

    let queryStockId = stockId;
    if (!queryStockId) {
      const stock = await prisma.stock.findUnique({
        where: { symbol },
      });
      queryStockId = stock?.id;
    }

    if (!queryStockId) return;

    const candles = await prisma.candle.findMany({
      where: { stockId: queryStockId, timeframe },
      orderBy: { timestamp: 'desc' },
      take: lookbackPeriod,
    });

    if (candles.length < lookbackPeriod / 2) return;

    const highs = candles.map((c) => Number(c.high));
    const lows = candles.map((c) => Number(c.low));
    const closes = candles.map((c) => Number(c.close)).reverse();

    switch (breakoutType) {
      case 'DONCHIAN':
        this.breakoutLevels.set(symbol, {
          resistance: Math.max(...highs),
          support: Math.min(...lows),
        });
        break;

      case 'BOLLINGER':
        const bands = this.indicatorsService.calculateBollingerBands(closes, lookbackPeriod, 2);
        if (bands.length > 0) {
          const lastBand = bands[bands.length - 1];
          this.breakoutLevels.set(symbol, {
            resistance: lastBand.upper,
            support: lastBand.lower,
          });
        }
        break;

      case 'HIGH_LOW':
      case 'RANGE':
      default:
        this.breakoutLevels.set(symbol, {
          resistance: Math.max(...highs),
          support: Math.min(...lows),
        });
    }
  }

  /**
   * 돌파 감지
   */
  private async detectBreakout(
    stockId: string,
    symbol: string,
    currentPrice: number,
    levels: BreakoutLevel,
  ): Promise<TradingSignal | null> {
    const { breakoutMargin, volumeFilter, confirmationCandles } = this.config;

    const marginAmount = (breakoutMargin / 100) * currentPrice;

    // 상향 돌파 (저항선 돌파)
    if (currentPrice > levels.resistance + marginAmount) {
      // 거래량 확인
      if (volumeFilter && !(await this.checkVolume(stockId))) {
        return null;
      }

      // 가짜 돌파 필터
      if (this.config.falseBreakoutFilter) {
        const isFalse = await this.checkFalseBreakout(stockId, 'UP', levels.resistance);
        if (isFalse) return null;
      }

      return this.createSignal(
        stockId,
        symbol,
        'BUY',
        currentPrice,
        levels.support,
        `Resistance breakout at ${levels.resistance}`,
      );
    }

    // 하향 돌파 (지지선 이탈)
    if (currentPrice < levels.support - marginAmount) {
      // 거래량 확인
      if (volumeFilter && !(await this.checkVolume(stockId))) {
        return null;
      }

      // 가짜 돌파 필터
      if (this.config.falseBreakoutFilter) {
        const isFalse = await this.checkFalseBreakout(stockId, 'DOWN', levels.support);
        if (isFalse) return null;
      }

      return this.createSignal(
        stockId,
        symbol,
        'SELL',
        currentPrice,
        levels.resistance,
        `Support breakdown at ${levels.support}`,
      );
    }

    return null;
  }

  /**
   * 거래량 확인
   */
  private async checkVolume(stockId: string): Promise<boolean> {
    const { lookbackPeriod, volumeMultiple, timeframe } = this.config;

    const candles = await prisma.candle.findMany({
      where: { stockId, timeframe },
      orderBy: { timestamp: 'desc' },
      take: lookbackPeriod + 1,
    });

    if (candles.length < 2) return true;

    const currentVolume = Number(candles[0].volume);
    const avgVolume = candles.slice(1).reduce((sum, c) => sum + Number(c.volume), 0) / (candles.length - 1);

    return currentVolume >= avgVolume * volumeMultiple;
  }

  /**
   * 가짜 돌파 체크
   */
  private async checkFalseBreakout(
    stockId: string,
    direction: 'UP' | 'DOWN',
    breakoutLevel: number,
  ): Promise<boolean> {
    const { falseBreakoutPeriod, timeframe } = this.config;

    const recentCandles = await prisma.candle.findMany({
      where: { stockId, timeframe },
      orderBy: { timestamp: 'desc' },
      take: falseBreakoutPeriod || 3,
    });

    // 최근 캔들들이 돌파 레벨 반대편으로 되돌아갔는지 확인
    for (const candle of recentCandles) {
      if (direction === 'UP' && Number(candle.close) < breakoutLevel) {
        return true; // 가짜 돌파
      }
      if (direction === 'DOWN' && Number(candle.close) > breakoutLevel) {
        return true; // 가짜 돌파
      }
    }

    return false;
  }

  /**
   * 쿨다운 체크
   */
  private isInCooldown(symbol: string): boolean {
    const lastTime = this.lastBreakoutTime.get(symbol);
    if (!lastTime) return false;

    const cooldownMs = (this.config.cooldownMinutes || 30) * 60 * 1000;
    return Date.now() - lastTime.getTime() < cooldownMs;
  }

  private createSignal(
    stockId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    price: number,
    stopLoss: number,
    reason: string,
  ): TradingSignal {
    const takeProfit = side === 'BUY'
      ? price * (1 + (this.config.takeProfitPercent || 5) / 100)
      : price * (1 - (this.config.takeProfitPercent || 5) / 100);

    return {
      id: `BREAKOUT-${Date.now()}-${symbol}`,
      userId: '',
      stockId,
      symbol,
      side,
      source: 'INDICATOR',
      strength: 'STRONG',
      price,
      stopLoss: side === 'BUY' ? stopLoss : undefined,
      takeProfit,
      confidence: 80,
      reason,
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

  updateConfig(config: Partial<BreakoutConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async getMetrics(): Promise<StrategyMetrics> {
    const trades = await prisma.trade.findMany({
      where: { strategyId: this.id },
    });

    return {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfitLoss: 0,
      maxDrawdown: 0,
      averageReturn: 0,
      averageHoldingPeriod: 0,
    };
  }

  /**
   * 현재 돌파 레벨 조회
   */
  getBreakoutLevels(symbol: string): BreakoutLevel | undefined {
    return this.breakoutLevels.get(symbol);
  }
}
