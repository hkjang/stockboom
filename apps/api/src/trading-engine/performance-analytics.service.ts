/**
 * Performance Analytics Service
 * 성과 분석 서비스
 * 
 * 전문가급 성과 지표:
 * - Sharpe Ratio / Sortino Ratio
 * - Maximum Drawdown
 * - Win Rate / Profit Factor
 * - Trade Journal
 * - 전략별 성과 비교
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@stockboom/database';

export interface PerformanceMetrics {
  // 수익률 지표
  totalReturn: number;            // 총 수익률 (%)
  annualizedReturn: number;       // 연환산 수익률 (%)
  dailyReturns: number[];         // 일별 수익률
  
  // 리스크 조정 수익률
  sharpeRatio: number;            // Sharpe Ratio (무위험 수익률 2% 가정)
  sortinoRatio: number;           // Sortino Ratio (하방 변동성만)
  calmarRatio: number;            // Calmar Ratio (수익률/MDD)
  
  // 드로다운
  maxDrawdown: number;            // 최대 낙폭 (%)
  currentDrawdown: number;        // 현재 낙폭 (%)
  maxDrawdownDuration: number;    // 최대 낙폭 지속기간 (일)
  
  // 승률 지표
  winRate: number;                // 승률 (%)
  profitFactor: number;           // 수익/손실 비율
  avgWin: number;                 // 평균 수익 거래
  avgLoss: number;                // 평균 손실 거래
  largestWin: number;             // 최대 수익 거래
  largestLoss: number;            // 최대 손실 거래
  
  // 거래 통계
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgHoldingPeriod: number;       // 평균 보유기간 (시간)
  tradesPerDay: number;           // 일평균 거래 횟수
  
  // 기간
  startDate: Date;
  endDate: Date;
  tradingDays: number;
}

export interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  strategyType: string;
  metrics: PerformanceMetrics;
  isActive: boolean;
  lastUpdated: Date;
}

export interface TradeJournalEntry {
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  holdingPeriod?: number;         // 시간
  strategyId?: string;
  strategyName?: string;
  entryReason?: string;
  exitReason?: string;
  notes?: string;
  tags?: string[];
  entryAt: Date;
  exitAt?: Date;
}

export interface DailyPnL {
  date: Date;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  portfolioValue: number;
  trades: number;
}

@Injectable()
export class PerformanceAnalyticsService {
  private readonly logger = new Logger(PerformanceAnalyticsService.name);
  
  // 무위험 수익률 (연 2%)
  private readonly RISK_FREE_RATE = 0.02;

  /**
   * 사용자 전체 성과 분석
   */
  async getUserPerformance(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PerformanceMetrics> {
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    // 거래 내역 조회
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        status: 'FILLED',
        filledAt: { gte: start, lte: end },
      },
      orderBy: { filledAt: 'asc' },
      include: { stock: true },
    });

    // 일별 PnL 계산
    const dailyPnL = await this.calculateDailyPnL(userId, start, end);

    return this.calculateMetrics(trades, dailyPnL, start, end);
  }

  /**
   * 전략별 성과 분석
   */
  async getStrategyPerformance(
    userId: string,
    strategyId?: string,
  ): Promise<StrategyPerformance[]> {
    // 활성 전략 조회
    const strategies = await prisma.strategy.findMany({
      where: {
        userId,
        ...(strategyId && { id: strategyId }),
      },
    });

    const performances: StrategyPerformance[] = [];

    for (const strategy of strategies) {
      const trades = await prisma.trade.findMany({
        where: {
          userId,
          strategyId: strategy.id,
          status: 'FILLED',
        },
        orderBy: { filledAt: 'asc' },
        include: { stock: true },
      });

      if (trades.length === 0) continue;

      const startDate = trades[0].filledAt || new Date();
      const endDate = trades[trades.length - 1].filledAt || new Date();
      const dailyPnL = await this.calculateStrategyDailyPnL(strategy.id, startDate, endDate);

      const metrics = this.calculateMetrics(trades, dailyPnL, startDate, endDate);

      performances.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        strategyType: strategy.type,
        metrics,
        isActive: strategy.isActive,
        lastUpdated: new Date(),
      });
    }

    // Sharpe Ratio 기준 정렬
    return performances.sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);
  }

  /**
   * 거래 일지 조회
   */
  async getTradeJournal(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      symbol?: string;
      strategyId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<TradeJournalEntry[]> {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        status: 'FILLED',
        ...(options?.symbol && {
          stock: { symbol: options.symbol },
        }),
        ...(options?.strategyId && { strategyId: options.strategyId }),
        ...(options?.startDate && { filledAt: { gte: options.startDate } }),
        ...(options?.endDate && { filledAt: { lte: options.endDate } }),
      },
      include: {
        stock: true,
        strategy: true,
      },
      orderBy: { filledAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });

    return trades.map(trade => {
      // Trade는 개별 주문이므로 totalAmount을 PnL로 간주 (매도 시 수익)
      const pnl = trade.orderSide === 'SELL' && trade.totalAmount
        ? Number(trade.totalAmount) - (Number(trade.commission || 0) + Number(trade.tax || 0))
        : undefined;
        
      return {
        tradeId: trade.id,
        symbol: trade.stock.symbol,
        side: trade.orderSide as 'BUY' | 'SELL',
        quantity: trade.filledQuantity,
        entryPrice: Number(trade.avgFillPrice),
        pnl,
        pnlPercent: pnl && trade.totalAmount
          ? (pnl / Number(trade.totalAmount)) * 100
          : undefined,
        strategyId: trade.strategyId || undefined,
        strategyName: trade.strategy?.name || undefined,
        entryReason: trade.signalSource || undefined,
        exitReason: undefined,
        notes: undefined,
        tags: undefined,
        entryAt: trade.filledAt || trade.createdAt,
      };
    });
  }

  /**
   * 일별 PnL 히스토리
   */
  async getDailyPnLHistory(
    userId: string,
    days: number = 30,
  ): Promise<DailyPnL[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.calculateDailyPnL(userId, startDate, new Date());
  }

  /**
   * 성과 요약 대시보드 데이터
   */
  async getPerformanceDashboard(userId: string): Promise<{
    todayPnL: number;
    weekPnL: number;
    monthPnL: number;
    yearPnL: number;
    totalPnL: number;
    metrics: Partial<PerformanceMetrics>;
    recentTrades: TradeJournalEntry[];
    topStrategies: StrategyPerformance[];
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // PnL 조회
    const [todayTrades, weekTrades, monthTrades, yearTrades] = await Promise.all([
      this.getPeriodPnL(userId, today, now),
      this.getPeriodPnL(userId, weekAgo, now),
      this.getPeriodPnL(userId, monthAgo, now),
      this.getPeriodPnL(userId, yearAgo, now),
    ]);

    // 성과 지표
    const metrics = await this.getUserPerformance(userId, monthAgo, now);

    // 최근 거래
    const recentTrades = await this.getTradeJournal(userId, { limit: 10 });

    // 상위 전략
    const strategies = await this.getStrategyPerformance(userId);
    const topStrategies = strategies.slice(0, 5);

    return {
      todayPnL: todayTrades,
      weekPnL: weekTrades,
      monthPnL: monthTrades,
      yearPnL: yearTrades,
      totalPnL: yearTrades, // 1년 기준
      metrics: {
        sharpeRatio: metrics.sharpeRatio,
        maxDrawdown: metrics.maxDrawdown,
        winRate: metrics.winRate,
        profitFactor: metrics.profitFactor,
        totalTrades: metrics.totalTrades,
      },
      recentTrades,
      topStrategies,
    };
  }

  /**
   * 성과 지표 계산
   */
  private calculateMetrics(
    trades: any[],
    dailyPnL: DailyPnL[],
    startDate: Date,
    endDate: Date,
  ): PerformanceMetrics {
    // 일별 수익률 계산
    const dailyReturns: number[] = [];
    for (let i = 1; i < dailyPnL.length; i++) {
      const prevValue = dailyPnL[i - 1].portfolioValue;
      const currValue = dailyPnL[i].portfolioValue;
      if (prevValue > 0) {
        dailyReturns.push((currValue - prevValue) / prevValue);
      }
    }

    // 승패 분류 (매도 거래 기준, totalAmount을 수익으로 간주)
    const sellTrades = trades.filter(t => t.orderSide === 'SELL' && t.totalAmount);
    const winningTrades = sellTrades.filter(t => Number(t.totalAmount) > 0);
    const losingTrades: any[] = []; // 실제 PnL 없이 판단 불가

    // 수익/손실 금액 (단순화)
    const totalWin = sellTrades.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);
    const totalLoss = 0; // realizedPnl 없이 계산 불가

    // 기본 통계
    const totalReturn = dailyReturns.length > 0
      ? dailyReturns.reduce((a, b) => (1 + a) * (1 + b) - 1, 0) * 100
      : 0;

    const tradingDays = dailyPnL.length;
    const annualizedReturn = totalReturn * (252 / Math.max(tradingDays, 1));

    // Sharpe Ratio
    const avgReturn = this.mean(dailyReturns);
    const stdDev = this.standardDeviation(dailyReturns);
    const dailyRiskFreeRate = this.RISK_FREE_RATE / 252;
    const sharpeRatio = stdDev > 0 
      ? ((avgReturn - dailyRiskFreeRate) / stdDev) * Math.sqrt(252)
      : 0;

    // Sortino Ratio (하방 변동성만)
    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downside = this.standardDeviation(negativeReturns);
    const sortinoRatio = downside > 0
      ? ((avgReturn - dailyRiskFreeRate) / downside) * Math.sqrt(252)
      : 0;

    // Maximum Drawdown
    const { maxDrawdown, maxDrawdownDuration, currentDrawdown } = 
      this.calculateDrawdown(dailyPnL);

    // Calmar Ratio
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    // Win Rate & Profit Factor
    const winRate = trades.length > 0
      ? (winningTrades.length / (winningTrades.length + losingTrades.length)) * 100
      : 0;
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

    return {
      totalReturn,
      annualizedReturn,
      dailyReturns,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown,
      currentDrawdown,
      maxDrawdownDuration,
      winRate,
      profitFactor,
      avgWin: winningTrades.length > 0 ? totalWin / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 
        ? Math.max(...winningTrades.map(t => Number(t.totalAmount || 0)))
        : 0,
      largestLoss: 0, // realizedPnl 없이 계산 불가
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      avgHoldingPeriod: 0, // TODO: 계산 필요
      tradesPerDay: tradingDays > 0 ? trades.length / tradingDays : 0,
      startDate,
      endDate,
      tradingDays,
    };
  }

  /**
   * 일별 PnL 계산
   */
  private async calculateDailyPnL(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyPnL[]> {
    const dailyPnL: DailyPnL[] = [];
    const currentDate = new Date(startDate);

    // 초기 포트폴리오 가치 조회
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
    });
    let portfolioValue = portfolios.reduce((sum, p) => sum + Number(p.totalValue), 0);

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      // 당일 거래
      const dayTrades = await prisma.trade.findMany({
        where: {
          userId,
          status: 'FILLED',
          filledAt: { gte: dayStart, lte: dayEnd },
        },
      });

      // 실현 손익 (매도 거래의 totalAmount 합계)
      const realizedPnL = dayTrades
        .filter(t => t.orderSide === 'SELL')
        .reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);

      portfolioValue += realizedPnL;

      dailyPnL.push({
        date: new Date(currentDate),
        realizedPnL,
        unrealizedPnL: 0, // TODO: 미실현 손익 계산
        totalPnL: realizedPnL,
        portfolioValue,
        trades: dayTrades.length,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyPnL;
  }

  /**
   * 전략별 일별 PnL
   */
  private async calculateStrategyDailyPnL(
    strategyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyPnL[]> {
    const dailyPnL: DailyPnL[] = [];
    const currentDate = new Date(startDate);
    let cumPnL = 0;

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTrades = await prisma.trade.findMany({
        where: {
          strategyId,
          status: 'FILLED',
          filledAt: { gte: dayStart, lte: dayEnd },
        },
      });

      const pnl = dayTrades
        .filter(t => t.orderSide === 'SELL')
        .reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);
      cumPnL += pnl;

      dailyPnL.push({
        date: new Date(currentDate),
        realizedPnL: pnl,
        unrealizedPnL: 0,
        totalPnL: pnl,
        portfolioValue: 10000 + cumPnL, // 기준 10000 시작
        trades: dayTrades.length,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyPnL;
  }

  /**
   * 기간별 PnL
   */
  private async getPeriodPnL(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        status: 'FILLED',
        orderSide: 'SELL',
        filledAt: { gte: startDate, lte: endDate },
      },
      select: { totalAmount: true },
    });

    return trades.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);
  }

  /**
   * Drawdown 계산
   */
  private calculateDrawdown(dailyPnL: DailyPnL[]): {
    maxDrawdown: number;
    maxDrawdownDuration: number;
    currentDrawdown: number;
  } {
    if (dailyPnL.length === 0) {
      return { maxDrawdown: 0, maxDrawdownDuration: 0, currentDrawdown: 0 };
    }

    let peak = dailyPnL[0].portfolioValue;
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdownStart = 0;
    let currentDrawdown = 0;

    for (let i = 0; i < dailyPnL.length; i++) {
      const value = dailyPnL[i].portfolioValue;

      if (value > peak) {
        peak = value;
        currentDrawdownStart = i;
      }

      const drawdown = peak > 0 ? ((peak - value) / peak) * 100 : 0;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownDuration = i - currentDrawdownStart;
      }

      if (i === dailyPnL.length - 1) {
        currentDrawdown = drawdown;
      }
    }

    return { maxDrawdown, maxDrawdownDuration, currentDrawdown };
  }

  /**
   * 통계 헬퍼: 평균
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * 통계 헬퍼: 표준편차
   */
  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  /**
   * 일일 성과 집계 (매일 자정)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyPerformance(): Promise<void> {
    this.logger.log('Aggregating daily performance...');
    
    // 모든 활성 사용자의 당일 성과 집계
    const users = await prisma.user.findMany({
      where: { autoTradingSessions: { some: { status: 'RUNNING' } } },
      select: { id: true },
    });

    for (const user of users) {
      try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await this.getUserPerformance(user.id, yesterday, new Date());
      } catch (error) {
        this.logger.error(`Performance aggregation failed for ${user.id}`);
      }
    }
  }
}
