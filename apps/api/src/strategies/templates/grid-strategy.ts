/**
 * Grid Trading Strategy
 * 그리드 매매 전략
 * 
 * 가격대를 일정 간격으로 나누어 각 그리드에서 자동 매수/매도
 * - 가격이 하락하면 정해진 가격에서 매수
 * - 가격이 상승하면 정해진 가격에서 매도
 * 박스권 장세에서 효과적
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
import { KisApiService } from '../../market-data/kis-api.service';

/**
 * 그리드 전략 설정
 */
export interface GridStrategyConfig extends BaseStrategyConfig {
  // 가격 범위
  priceRange: {
    min: number;  // 최저가
    max: number;  // 최고가
  };
  
  gridCount: number;          // 그리드 개수 (5-50)
  quantityPerGrid: number;    // 그리드당 수량
  profitMargin: number;       // 목표 수익률 % (그리드 간격 = 범위/개수)
  
  // 옵션
  trailingGrid?: boolean;     // 트레일링 그리드 (가격 범위 자동 조정)
  reinvest?: boolean;         // 수익 재투자
  onlyBuy?: boolean;          // 매수만 (축적 모드)
  onlySell?: boolean;         // 매도만 (청산 모드)
}

/**
 * 그리드 레벨 정보
 */
interface GridLevel {
  price: number;
  type: 'BUY' | 'SELL';
  triggered: boolean;
  orderId?: string;
}

@Injectable()
export class GridStrategy implements IStrategy<GridStrategyConfig> {
  private readonly logger = new Logger(GridStrategy.name);
  
  readonly id: string;
  readonly type = 'GRID';
  readonly name: string;
  
  config: GridStrategyConfig;
  state: StrategyState = 'IDLE';
  
  private gridLevels: Map<string, GridLevel[]> = new Map(); // symbol → levels
  private lastPrices: Map<string, number> = new Map();

  constructor(
    id: string,
    config: GridStrategyConfig,
    private kisApiService: KisApiService,
    private eventEmitter: EventEmitter2,
  ) {
    this.id = id;
    this.name = config.name;
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.logger.log(`Initializing Grid Strategy: ${this.name}`);
    
    // 각 종목에 대해 그리드 레벨 생성
    for (const symbol of this.config.symbols) {
      this.initializeGridLevels(symbol);
    }
    
    this.state = 'ACTIVE';
  }

  async dispose(): Promise<void> {
    this.state = 'IDLE';
    this.gridLevels.clear();
  }

  /**
   * 그리드 레벨 초기화
   */
  private initializeGridLevels(symbol: string): void {
    const { priceRange, gridCount, profitMargin } = this.config;
    const gridSpacing = (priceRange.max - priceRange.min) / gridCount;
    
    const levels: GridLevel[] = [];
    
    for (let i = 0; i <= gridCount; i++) {
      const price = priceRange.min + (gridSpacing * i);
      
      // 현재가 기준으로 아래는 매수, 위는 매도
      levels.push({
        price: Math.round(price),
        type: 'BUY', // 기본은 매수, 평가 시 현재가 기준으로 결정
        triggered: false,
      });
    }
    
    this.gridLevels.set(symbol, levels);
    this.logger.debug(`Initialized ${levels.length} grid levels for ${symbol}`);
  }

  /**
   * 전략 평가 - 현재가 기준으로 신호 생성
   */
  async evaluate(stockId: string): Promise<StrategyResult> {
    if (this.state !== 'ACTIVE') {
      return this.noSignal(stockId, 'Strategy not active');
    }

    try {
      const stock = await prisma.stock.findUnique({
        where: { id: stockId },
      });

      if (!stock) {
        return this.noSignal(stockId, 'Stock not found');
      }

      const symbol = stock.symbol;
      if (!this.config.symbols.includes(symbol)) {
        return this.noSignal(stockId, 'Symbol not in strategy');
      }

      // 현재가 조회
      const quote = await this.kisApiService.getQuote(symbol);
      const currentPrice = quote.currentPrice;

      // 이전 가격 조회
      const previousPrice = this.lastPrices.get(symbol) || currentPrice;
      this.lastPrices.set(symbol, currentPrice);

      // 그리드 레벨 체크
      const levels = this.gridLevels.get(symbol) || [];
      const signal = this.checkGridLevels(
        symbol,
        stockId,
        currentPrice,
        previousPrice,
        levels,
      );

      if (signal) {
        return {
          strategyId: this.id,
          stockId,
          symbol,
          signal,
          reason: `Grid ${signal.side} triggered at ${currentPrice}`,
          metadata: {
            gridLevel: signal.price,
            currentPrice,
            gridCount: this.config.gridCount,
          },
          executedAt: new Date(),
        };
      }

      return this.noSignal(stockId, 'No grid level triggered');

    } catch (error) {
      this.logger.error(`Grid evaluation error: ${error.message}`);
      return this.noSignal(stockId, `Error: ${error.message}`);
    }
  }

  /**
   * 그리드 레벨 체크
   */
  private checkGridLevels(
    symbol: string,
    stockId: string,
    currentPrice: number,
    previousPrice: number,
    levels: GridLevel[],
  ): TradingSignal | null {
    const { priceRange, quantityPerGrid } = this.config;

    // 가격이 범위를 벗어나면 스킵
    if (currentPrice < priceRange.min || currentPrice > priceRange.max) {
      return null;
    }

    // 가격 이동 방향
    const isMovingDown = currentPrice < previousPrice;
    const isMovingUp = currentPrice > previousPrice;

    // 크로스한 그리드 레벨 찾기
    for (const level of levels) {
      // 이미 트리거된 레벨 스킵
      if (level.triggered) continue;

      // 하락 시 매수 레벨 체크
      if (isMovingDown && !this.config.onlySell) {
        if (previousPrice > level.price && currentPrice <= level.price) {
          level.triggered = true;
          return this.createSignal(
            stockId,
            symbol,
            'BUY',
            level.price,
            quantityPerGrid,
            `Grid buy at ${level.price}`,
          );
        }
      }

      // 상승 시 매도 레벨 체크
      if (isMovingUp && !this.config.onlyBuy) {
        if (previousPrice < level.price && currentPrice >= level.price) {
          level.triggered = true;
          return this.createSignal(
            stockId,
            symbol,
            'SELL',
            level.price,
            quantityPerGrid,
            `Grid sell at ${level.price}`,
          );
        }
      }
    }

    // 레벨 트리거 리셋 (반대 방향 이동 시)
    this.resetTriggeredLevels(symbol, currentPrice);

    return null;
  }

  /**
   * 트리거된 레벨 리셋
   */
  private resetTriggeredLevels(symbol: string, currentPrice: number): void {
    const levels = this.gridLevels.get(symbol) || [];
    
    for (const level of levels) {
      if (level.triggered) {
        // 충분히 멀어지면 리셋
        const distance = Math.abs(currentPrice - level.price);
        const gridSpacing = (this.config.priceRange.max - this.config.priceRange.min) / this.config.gridCount;
        
        if (distance > gridSpacing * 1.5) {
          level.triggered = false;
        }
      }
    }
  }

  /**
   * 신호 생성
   */
  private createSignal(
    stockId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    price: number,
    quantity: number,
    reason: string,
  ): TradingSignal {
    return {
      id: `GRID-${Date.now()}-${symbol}`,
      userId: '', // 전략 실행 시 설정
      stockId,
      symbol,
      side,
      source: 'INDICATOR',
      strength: 'MODERATE',
      price,
      quantity,
      confidence: 75,
      reason,
      strategyId: this.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5분 유효
    };
  }

  /**
   * 신호 없음 결과
   */
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

  updateConfig(config: Partial<GridStrategyConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 가격 범위가 변경되면 그리드 재초기화
    if (config.priceRange || config.gridCount) {
      for (const symbol of this.config.symbols) {
        this.initializeGridLevels(symbol);
      }
    }
  }

  async getMetrics(): Promise<StrategyMetrics> {
    // DB에서 이 전략의 거래 기록 조회
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
      maxDrawdown: 0, // TODO: 계산 필요
      averageReturn: trades.length > 0 ? totalPnL / trades.length : 0,
      averageHoldingPeriod: 0, // TODO: 계산 필요
    };
  }

  /**
   * 현재 그리드 상태 조회
   */
  getGridStatus(symbol: string): { levels: GridLevel[]; currentPrice: number } {
    return {
      levels: this.gridLevels.get(symbol) || [],
      currentPrice: this.lastPrices.get(symbol) || 0,
    };
  }

  /**
   * 그리드 범위 자동 조정 (트레일링)
   */
  async adjustGridRange(symbol: string): Promise<void> {
    if (!this.config.trailingGrid) return;

    const currentPrice = this.lastPrices.get(symbol);
    if (!currentPrice) return;

    const { priceRange, gridCount } = this.config;
    const rangeSize = priceRange.max - priceRange.min;
    const halfRange = rangeSize / 2;

    // 현재가를 중심으로 범위 조정
    const newMin = Math.round(currentPrice - halfRange);
    const newMax = Math.round(currentPrice + halfRange);

    if (newMin !== priceRange.min || newMax !== priceRange.max) {
      this.config.priceRange = { min: newMin, max: newMax };
      this.initializeGridLevels(symbol);
      this.logger.log(`Grid range adjusted for ${symbol}: ${newMin} - ${newMax}`);
    }
  }
}
