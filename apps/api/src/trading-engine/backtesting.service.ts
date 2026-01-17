/**
 * Backtesting Service
 * 백테스팅 서비스
 * 
 * 전문가급 기능:
 * - 과거 데이터 기반 전략 검증
 * - 다양한 성과 지표 계산
 * - 워크포워드 분석
 * - 몬테카를로 시뮬레이션
 */

import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@stockboom/database';

export interface BacktestConfig {
  strategyId: string;
  stockIds: string[];
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  commission: number;          // 수수료율 (0.015% = 0.00015)
  slippage: number;            // 슬리피지 (0.1% = 0.001)
  positionSizing: 'FIXED' | 'PERCENT' | 'KELLY';
  fixedAmount?: number;
  percentPerTrade?: number;
}

export interface BacktestTrade {
  symbol: string;
  entryDate: Date;
  entryPrice: number;
  exitDate: Date;
  exitPrice: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  pnl: number;
  pnlPercent: number;
  holdingDays: number;
  signal: string;
}

export interface BacktestResult {
  config: BacktestConfig;
  
  // 수익률
  totalReturn: number;         // 총 수익률 (%)
  annualizedReturn: number;    // 연환산 수익률 (%)
  benchmarkReturn: number;     // 벤치마크 수익률 (%)
  alpha: number;               // 초과 수익률
  
  // 리스크 지표
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number; // 일
  volatility: number;          // 연간 변동성
  
  // 거래 통계
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingPeriod: number;    // 일
  
  // 자본 추이
  equityCurve: Array<{ date: Date; equity: number }>;
  drawdownCurve: Array<{ date: Date; drawdown: number }>;
  
  // 거래 내역
  trades: BacktestTrade[];
  
  // 메타데이터
  runAt: Date;
  duration: number;            // ms
}

export interface MonteCarloResult {
  simulations: number;
  confidenceLevel: number;     // 95%
  expectedReturn: { min: number; median: number; max: number };
  maxDrawdown: { min: number; median: number; max: number };
  sharpeRatio: { min: number; median: number; max: number };
  ruinProbability: number;     // 파산 확률
}

@Injectable()
export class BacktestingService {
  private readonly logger = new Logger(BacktestingService.name);
  private readonly RISK_FREE_RATE = 0.02; // 연 2%

  /**
   * 백테스트 실행
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const startTime = Date.now();
    this.logger.log(`Starting backtest for strategy ${config.strategyId}`);

    // 전략 로드
    const strategy = await prisma.strategy.findUnique({
      where: { id: config.strategyId },
    });

    if (!strategy) {
      throw new Error(`Strategy not found: ${config.strategyId}`);
    }

    // 과거 가격 데이터 로드
    const priceData = await this.loadHistoricalData(config.stockIds, config.startDate, config.endDate);

    // 지표 계산
    const indicators = await this.calculateIndicators(config.stockIds, config.startDate, config.endDate);

    // 전략 조건 파싱 (config 필드 사용)
    const strategyConfig = strategy.config as any || {};
    const conditions = strategyConfig.entryConditions || {};
    const exitConditions = strategyConfig.exitConditions || {};

    // 시뮬레이션 실행
    const trades: BacktestTrade[] = [];
    let capital = config.initialCapital;
    const equityCurve: Array<{ date: Date; equity: number }> = [];
    let position: { symbol: string; quantity: number; entryPrice: number; entryDate: Date } | null = null;

    const allDates = this.getUniqueDates(priceData);

    for (const date of allDates) {
      let dailyEquity = capital;

      for (const stockId of config.stockIds) {
        const price = priceData.get(`${stockId}_${date.toISOString()}`);
        if (!price) continue;

        const stockIndicators = indicators.get(stockId);

        // 포지션 있을 때 청산 조건 체크
        if (position && position.symbol === stockId) {
          const shouldExit = this.checkExitConditions(exitConditions, price, stockIndicators, position);
          
          if (shouldExit) {
            const exitPrice = price.close * (1 - config.slippage);
            const pnl = (exitPrice - position.entryPrice) * position.quantity;
            const commission = (position.entryPrice + exitPrice) * position.quantity * config.commission;
            const netPnl = pnl - commission;

            trades.push({
              symbol: stockId,
              entryDate: position.entryDate,
              entryPrice: position.entryPrice,
              exitDate: date,
              exitPrice,
              quantity: position.quantity,
              side: 'LONG',
              pnl: netPnl,
              pnlPercent: (netPnl / (position.entryPrice * position.quantity)) * 100,
              holdingDays: Math.floor((date.getTime() - position.entryDate.getTime()) / (24 * 60 * 60 * 1000)),
              signal: 'EXIT',
            });

            capital += position.entryPrice * position.quantity + netPnl;
            position = null;
          } else {
            dailyEquity = capital + (price.close - position.entryPrice) * position.quantity;
          }
        }

        // 포지션 없을 때 진입 조건 체크
        if (!position) {
          const shouldEnter = this.checkEntryConditions(conditions, price, stockIndicators);
          
          if (shouldEnter) {
            const entryPrice = price.close * (1 + config.slippage);
            const quantity = this.calculatePositionSize(config, capital, entryPrice);
            
            if (quantity > 0) {
              position = {
                symbol: stockId,
                quantity,
                entryPrice,
                entryDate: date,
              };
              capital -= entryPrice * quantity;
            }
          }
        }
      }

      equityCurve.push({ date: new Date(date), equity: dailyEquity });
    }

    // 미청산 포지션 처리
    if (position) {
      const lastPrice = Array.from(priceData.values()).pop();
      if (lastPrice) {
        trades.push({
          symbol: position.symbol,
          entryDate: position.entryDate,
          entryPrice: position.entryPrice,
          exitDate: config.endDate,
          exitPrice: lastPrice.close,
          quantity: position.quantity,
          side: 'LONG',
          pnl: (lastPrice.close - position.entryPrice) * position.quantity,
          pnlPercent: ((lastPrice.close - position.entryPrice) / position.entryPrice) * 100,
          holdingDays: Math.floor((config.endDate.getTime() - position.entryDate.getTime()) / (24 * 60 * 60 * 1000)),
          signal: 'OPEN',
        });
      }
    }

    // 성과 지표 계산
    const metrics = this.calculateMetrics(trades, equityCurve, config);
    const drawdownCurve = this.calculateDrawdownCurve(equityCurve);

    const result: BacktestResult = {
      config,
      totalReturn: metrics.totalReturn,
      annualizedReturn: metrics.annualizedReturn,
      benchmarkReturn: 0, // TODO: 벤치마크 계산
      alpha: metrics.annualizedReturn, // 단순화
      sharpeRatio: metrics.sharpeRatio,
      sortinoRatio: metrics.sortinoRatio,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownDuration: metrics.maxDrawdownDuration,
      volatility: metrics.volatility,
      totalTrades: trades.length,
      winningTrades: trades.filter(t => t.pnl > 0).length,
      losingTrades: trades.filter(t => t.pnl < 0).length,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      avgWin: metrics.avgWin,
      avgLoss: metrics.avgLoss,
      largestWin: metrics.largestWin,
      largestLoss: metrics.largestLoss,
      avgHoldingPeriod: metrics.avgHoldingPeriod,
      equityCurve,
      drawdownCurve,
      trades,
      runAt: new Date(),
      duration: Date.now() - startTime,
    };

    this.logger.log(`Backtest completed in ${result.duration}ms`);
    return result;
  }

  /**
   * 몬테카를로 시뮬레이션
   */
  async runMonteCarloSimulation(
    config: BacktestConfig,
    simulations: number = 1000,
  ): Promise<MonteCarloResult> {
    this.logger.log(`Running Monte Carlo simulation with ${simulations} iterations`);

    const baseResult = await this.runBacktest(config);
    const tradeReturns = baseResult.trades.map(t => t.pnlPercent);

    const results: Array<{
      totalReturn: number;
      maxDrawdown: number;
      sharpeRatio: number;
    }> = [];

    for (let i = 0; i < simulations; i++) {
      // 거래 순서 섞기 (Bootstrap)
      const shuffledReturns = this.shuffleArray([...tradeReturns]);
      
      // 수익 곡선 계산
      let equity = config.initialCapital;
      let peak = equity;
      let maxDrawdown = 0;
      const equityHistory: number[] = [equity];

      for (const ret of shuffledReturns) {
        equity *= (1 + ret / 100);
        equityHistory.push(equity);
        
        if (equity > peak) peak = equity;
        const dd = (peak - equity) / peak * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      const totalReturn = ((equity - config.initialCapital) / config.initialCapital) * 100;
      const dailyReturns = equityHistory.slice(1).map((e, i) => 
        (e - equityHistory[i]) / equityHistory[i]
      );
      const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const stdDev = Math.sqrt(
        dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
      );
      const sharpeRatio = stdDev > 0 ? (avgReturn * 252 - this.RISK_FREE_RATE) / (stdDev * Math.sqrt(252)) : 0;

      results.push({ totalReturn, maxDrawdown, sharpeRatio });
    }

    // 결과 정렬
    results.sort((a, b) => a.totalReturn - b.totalReturn);
    const ruinThreshold = -50; // 50% 손실 = 파산

    return {
      simulations,
      confidenceLevel: 0.95,
      expectedReturn: {
        min: results[Math.floor(simulations * 0.05)].totalReturn,
        median: results[Math.floor(simulations * 0.5)].totalReturn,
        max: results[Math.floor(simulations * 0.95)].totalReturn,
      },
      maxDrawdown: {
        min: Math.min(...results.map(r => r.maxDrawdown)),
        median: results.sort((a, b) => a.maxDrawdown - b.maxDrawdown)[Math.floor(simulations / 2)].maxDrawdown,
        max: Math.max(...results.map(r => r.maxDrawdown)),
      },
      sharpeRatio: {
        min: Math.min(...results.map(r => r.sharpeRatio)),
        median: results.sort((a, b) => a.sharpeRatio - b.sharpeRatio)[Math.floor(simulations / 2)].sharpeRatio,
        max: Math.max(...results.map(r => r.sharpeRatio)),
      },
      ruinProbability: results.filter(r => r.totalReturn < ruinThreshold).length / simulations,
    };
  }

  // ========== Private Methods ==========

  private async loadHistoricalData(
    stockIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, { close: number; high: number; low: number; volume: number }>> {
    const priceData = new Map<string, any>();

    // Candle 모델 사용 (일보 데이터)
    for (const stockId of stockIds) {
      const candles = await prisma.candle.findMany({
        where: {
          stockId,
          timeframe: '1d',
          timestamp: { gte: startDate, lte: endDate },
        },
        orderBy: { timestamp: 'asc' },
      });

      for (const candle of candles) {
        priceData.set(`${stockId}_${candle.timestamp.toISOString()}`, {
          close: Number(candle.close),
          high: Number(candle.high),
          low: Number(candle.low),
          volume: Number(candle.volume),
        });
      }
    }

    return priceData;
  }

  private async calculateIndicators(
    stockIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, any>> {
    const indicators = new Map<string, any>();

    for (const stockId of stockIds) {
      const dbIndicators = await prisma.indicator.findMany({
        where: {
          stockId,
          timestamp: { gte: startDate, lte: endDate },
        },
      });

      const stockIndicators: any = {};
      for (const ind of dbIndicators) {
        stockIndicators[ind.type] = ind.values;
      }
      indicators.set(stockId, stockIndicators);
    }

    return indicators;
  }

  private getUniqueDates(priceData: Map<string, any>): Date[] {
    const dates = new Set<string>();
    for (const key of priceData.keys()) {
      const date = key.split('_')[1];
      dates.add(date);
    }
    return Array.from(dates).map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  }

  private checkEntryConditions(conditions: any, price: any, indicators: any): boolean {
    if (!conditions) return false;
    
    // RSI 조건
    if (conditions.rsiBelow && indicators?.RSI?.value > conditions.rsiBelow) return false;
    if (conditions.rsiAbove && indicators?.RSI?.value < conditions.rsiAbove) return false;
    
    // MACD 조건
    if (conditions.macdCross === 'GOLDEN' && !indicators?.MACD?.goldenCross) return false;
    
    return true;
  }

  private checkExitConditions(conditions: any, price: any, indicators: any, position: any): boolean {
    if (!conditions) return false;

    // 손절
    if (conditions.stopLoss) {
      const loss = (price.close - position.entryPrice) / position.entryPrice * 100;
      if (loss <= -conditions.stopLoss) return true;
    }

    // 익절
    if (conditions.takeProfit) {
      const gain = (price.close - position.entryPrice) / position.entryPrice * 100;
      if (gain >= conditions.takeProfit) return true;
    }

    // RSI 과매수
    if (conditions.rsiAbove && indicators?.RSI?.value >= conditions.rsiAbove) return true;

    return false;
  }

  private calculatePositionSize(config: BacktestConfig, capital: number, price: number): number {
    switch (config.positionSizing) {
      case 'FIXED':
        return Math.floor((config.fixedAmount || 1000000) / price);
      case 'PERCENT':
        return Math.floor((capital * (config.percentPerTrade || 10) / 100) / price);
      case 'KELLY':
        // 간단화된 Kelly 공식
        return Math.floor((capital * 0.25) / price);
      default:
        return Math.floor((capital * 0.1) / price);
    }
  }

  private calculateMetrics(
    trades: BacktestTrade[],
    equityCurve: Array<{ date: Date; equity: number }>,
    config: BacktestConfig,
  ): any {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalReturn = (totalPnl / config.initialCapital) * 100;

    const tradingDays = equityCurve.length;
    const years = tradingDays / 252;
    const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn / 100, 1 / years) - 1 : 0;

    // 일별 수익률
    const dailyReturns = equityCurve.slice(1).map((e, i) => 
      (e.equity - equityCurve[i].equity) / equityCurve[i].equity
    );
    const avgDailyReturn = dailyReturns.length > 0 
      ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length 
      : 0;
    const stdDev = dailyReturns.length > 1
      ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length)
      : 0;

    const volatility = stdDev * Math.sqrt(252) * 100;
    const sharpeRatio = stdDev > 0 
      ? ((avgDailyReturn * 252) - this.RISK_FREE_RATE) / (stdDev * Math.sqrt(252))
      : 0;

    // Sortino (하방 변동성)
    const negReturns = dailyReturns.filter(r => r < 0);
    const downside = negReturns.length > 0
      ? Math.sqrt(negReturns.reduce((sum, r) => sum + r * r, 0) / negReturns.length)
      : 0;
    const sortinoRatio = downside > 0 
      ? ((avgDailyReturn * 252) - this.RISK_FREE_RATE) / (downside * Math.sqrt(252))
      : 0;

    // MDD
    let peak = config.initialCapital;
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let ddStart = 0;

    for (let i = 0; i < equityCurve.length; i++) {
      if (equityCurve[i].equity > peak) {
        peak = equityCurve[i].equity;
        ddStart = i;
      }
      const dd = (peak - equityCurve[i].equity) / peak * 100;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
        maxDrawdownDuration = i - ddStart;
      }
    }

    const totalWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    return {
      totalReturn,
      annualizedReturn: annualizedReturn * 100,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownDuration,
      volatility,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
      avgWin: winningTrades.length > 0 ? totalWin / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.abs(Math.min(...losingTrades.map(t => t.pnl))) : 0,
      avgHoldingPeriod: trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length : 0,
    };
  }

  private calculateDrawdownCurve(equityCurve: Array<{ date: Date; equity: number }>): Array<{ date: Date; drawdown: number }> {
    let peak = equityCurve[0]?.equity || 0;
    
    return equityCurve.map(e => {
      if (e.equity > peak) peak = e.equity;
      const drawdown = peak > 0 ? ((peak - e.equity) / peak) * 100 : 0;
      return { date: e.date, drawdown };
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
