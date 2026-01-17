import {
  Controller,
  Get,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PositionManagerService } from './position-manager.service';
import { RiskManagerService } from './risk-manager.service';
import { SignalProcessorService } from './signal-processor.service';
import { TradingEngineService } from './trading-engine.service';
import { prisma } from '@stockboom/database';
import { TodayStats, StrategyPerformance } from './trading-engine.types';

/**
 * Dashboard Controller
 * 실시간 대시보드 API
 */
@Controller('trading/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private positionManagerService: PositionManagerService,
    private riskManagerService: RiskManagerService,
    private signalProcessorService: SignalProcessorService,
    private tradingEngineService: TradingEngineService,
  ) {}

  /**
   * 대시보드 요약
   */
  @Get()
  async getDashboardSummary(@Request() req) {
    const userId = req.user.id;

    const [
      portfolioSummary,
      riskStatus,
      autoTradingStatus,
      todayStats,
      pendingSignals,
    ] = await Promise.all([
      this.positionManagerService.getPortfolioSummary(userId),
      this.riskManagerService.getRiskStatus(userId),
      this.tradingEngineService.getAutoTradingStatus(userId),
      this.getTodayStats(userId),
      this.signalProcessorService.getAllPendingSignals(),
    ]);

    return {
      portfolio: portfolioSummary,
      risk: riskStatus,
      autoTrading: autoTradingStatus,
      todayStats,
      pendingSignals: pendingSignals.filter((s) => s.userId === userId).length,
    };
  }

  /**
   * 실시간 포지션 및 손익
   */
  @Get('positions')
  async getPositions(@Request() req) {
    return this.positionManagerService.getPortfolioSummary(req.user.id);
  }

  /**
   * 포지션 동기화
   */
  @Get('positions/sync')
  async syncPositions(@Request() req) {
    const positions = await this.positionManagerService.syncPositions(req.user.id);
    return {
      success: true,
      positions,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * 실시간 손익
   */
  @Get('realtime-pnl')
  async getRealTimePnL(@Request() req) {
    return this.positionManagerService.calculateRealTimePnL(req.user.id);
  }

  /**
   * 포트폴리오 비중
   */
  @Get('allocation')
  async getAllocation(@Request() req) {
    return this.positionManagerService.getPortfolioAllocation(req.user.id);
  }

  /**
   * 금일 거래 통계
   */
  @Get('today-stats')
  async getTodayStatsEndpoint(@Request() req): Promise<TodayStats> {
    return this.getTodayStats(req.user.id);
  }

  /**
   * 전략별 성과
   */
  @Get('strategy-performance')
  async getStrategyPerformance(@Request() req): Promise<StrategyPerformance[]> {
    const userId = req.user.id;

    const strategies = await prisma.strategy.findMany({
      where: { userId },
      include: {
        trades: {
          where: { status: 'FILLED' },
        },
      },
    });

    return strategies.map((strategy) => {
      const trades = strategy.trades;
      const totalTrades = trades.length;

      if (totalTrades === 0) {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          trades: 0,
          winRate: 0,
          profitLoss: 0,
          avgReturn: 0,
        };
      }

      // 승률 계산 (간단 버전: 매도 거래 기준)
      const sellTrades = trades.filter((t) => t.orderSide === 'SELL');
      const winningTrades = sellTrades.filter((t) => {
        const amount = Number(t.totalAmount || 0);
        const cost =
          Number(t.commission || 0) + Number(t.tax || 0);
        return amount > cost;
      });

      const winRate =
        sellTrades.length > 0
          ? (winningTrades.length / sellTrades.length) * 100
          : 0;

      // 총 손익
      let profitLoss = 0;
      for (const trade of trades) {
        const amount = Number(trade.totalAmount || 0);
        const cost =
          Number(trade.commission || 0) + Number(trade.tax || 0);
        if (trade.orderSide === 'SELL') {
          profitLoss += amount - cost;
        } else {
          profitLoss -= amount + cost;
        }
      }

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        trades: totalTrades,
        winRate,
        profitLoss,
        avgReturn: totalTrades > 0 ? profitLoss / totalTrades : 0,
      };
    });
  }

  /**
   * 리스크 현황
   */
  @Get('risk-status')
  async getRiskStatus(@Request() req) {
    return this.riskManagerService.getRiskStatus(req.user.id);
  }

  /**
   * 대기 중인 신호
   */
  @Get('pending-signals')
  async getPendingSignals(@Request() req) {
    const allSignals = this.signalProcessorService.getAllPendingSignals();
    return allSignals.filter((s) => s.userId === req.user.id);
  }

  /**
   * 거래 히스토리 (최근)
   */
  @Get('trade-history')
  async getTradeHistory(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const userId = req.user.id;

    const trades = await prisma.trade.findMany({
      where: {
        userId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit || '20'),
      include: {
        stock: {
          select: {
            symbol: true,
            name: true,
          },
        },
        strategy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return trades.map((trade) => ({
      id: trade.id,
      symbol: trade.stock.symbol,
      name: trade.stock.name,
      side: trade.orderSide,
      type: trade.orderType,
      quantity: trade.quantity,
      filledQuantity: trade.filledQuantity,
      price: trade.limitPrice || trade.avgFillPrice,
      status: trade.status,
      isAutoTrade: trade.isAutoTrade,
      strategyName: trade.strategy?.name,
      createdAt: trade.createdAt,
      filledAt: trade.filledAt,
    }));
  }

  // ============================================
  // 내부 메서드
  // ============================================

  private async getTodayStats(userId: string): Promise<TodayStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const trades = await prisma.trade.findMany({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    let realizedProfitLoss = 0;
    let totalVolume = 0;
    let totalAmount = 0;
    let buyOrders = 0;
    let sellOrders = 0;
    let successfulTrades = 0;
    let failedTrades = 0;

    for (const trade of trades) {
      totalVolume += trade.quantity;
      totalAmount += Number(trade.totalAmount || 0);

      if (trade.orderSide === 'BUY') {
        buyOrders++;
      } else {
        sellOrders++;
      }

      if (trade.status === 'FILLED') {
        successfulTrades++;
        const amount = Number(trade.totalAmount || 0);
        const cost =
          Number(trade.commission || 0) + Number(trade.tax || 0);
        if (trade.orderSide === 'SELL') {
          realizedProfitLoss += amount - cost;
        } else {
          realizedProfitLoss -= amount + cost;
        }
      } else if (
        trade.status === 'CANCELLED' ||
        trade.status === 'REJECTED'
      ) {
        failedTrades++;
      }
    }

    // 미실현 손익 계산
    const pnlResult = await this.positionManagerService.calculateRealTimePnL(
      userId,
    );

    return {
      totalTrades: trades.length,
      successfulTrades,
      failedTrades,
      buyOrders,
      sellOrders,
      totalVolume,
      totalAmount,
      realizedProfitLoss,
      unrealizedProfitLoss: pnlResult.unrealizedPnL,
    };
  }
}
