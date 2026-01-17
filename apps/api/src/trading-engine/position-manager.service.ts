import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma } from '@stockboom/database';
import { KisApiService } from '../market-data/kis-api.service';
import {
  PositionInfo,
  PortfolioSummary,
  AllocationMap,
} from './trading-engine.types';

/**
 * Position Manager Service
 * 포지션 관리 서비스
 * 
 * 책임:
 * - 보유 포지션 동기화 (KIS API ↔ DB)
 * - 실시간 손익 계산
 * - 포트폴리오 비중 계산
 * - 청산 가능 수량 계산
 */
@Injectable()
export class PositionManagerService {
  private readonly logger = new Logger(PositionManagerService.name);

  // 실시간 가격 캐시 (종목코드 → 가격)
  private priceCache = new Map<string, { price: number; timestamp: Date }>();
  private readonly PRICE_CACHE_TTL = 5000; // 5초

  constructor(
    private kisApiService: KisApiService,
    private eventEmitter: EventEmitter2,
  ) {
    // 실시간 가격 이벤트 구독
    this.eventEmitter.on('realtime.price', (data) => {
      this.updatePriceCache(data.symbol, data.price);
    });
  }

  /**
   * 가격 캐시 업데이트
   */
  private updatePriceCache(symbol: string, price: number): void {
    this.priceCache.set(symbol, { price, timestamp: new Date() });
  }

  /**
   * 캐시된 가격 조회
   */
  private getCachedPrice(symbol: string): number | null {
    const cached = this.priceCache.get(symbol);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.PRICE_CACHE_TTL) return null;

    return cached.price;
  }

  /**
   * 포지션 동기화 (KIS API → DB)
   */
  async syncPositions(userId: string): Promise<PositionInfo[]> {
    this.logger.log(`Syncing positions for user ${userId}`);

    try {
      // KIS API에서 보유 종목 조회
      const holdings = await this.kisApiService.getHoldings(userId);
      const accountBalance = await this.kisApiService.getAccountBalance(userId);

      // 사용자의 포트폴리오 조회 (첫 번째 포트폴리오 사용)
      let portfolio = await prisma.portfolio.findFirst({
        where: { userId },
        include: { brokerAccount: true },
      });

      if (!portfolio) {
        this.logger.warn(`No portfolio found for user ${userId}`);
        return [];
      }

      // 총 포트폴리오 가치
      const totalValue = accountBalance.totalEvaluation;

      // 포지션 업데이트/생성
      const positions: PositionInfo[] = [];

      for (const holding of holdings) {
        // 종목 조회
        let stock = await prisma.stock.findUnique({
          where: { symbol: holding.symbol },
        });

        // 종목이 없으면 생성
        if (!stock) {
          stock = await prisma.stock.create({
            data: {
              symbol: holding.symbol,
              name: holding.name,
              market: 'KRX',
            },
          });
        }

        // 포지션 비중 계산
        const weight = totalValue > 0
          ? (holding.evaluationAmount / totalValue) * 100
          : 0;

        // DB 포지션 업데이트 또는 생성
        await prisma.position.upsert({
          where: {
            portfolioId_stockId: {
              portfolioId: portfolio.id,
              stockId: stock.id,
            },
          },
          update: {
            quantity: holding.quantity,
            avgPrice: holding.avgPrice,
            currentPrice: holding.currentPrice,
            totalCost: holding.purchaseAmount,
            marketValue: holding.evaluationAmount,
            unrealizedPL: holding.profitLoss,
            unrealizedPLPct: holding.profitLossRate,
          },
          create: {
            portfolioId: portfolio.id,
            stockId: stock.id,
            quantity: holding.quantity,
            avgPrice: holding.avgPrice,
            currentPrice: holding.currentPrice,
            totalCost: holding.purchaseAmount,
            marketValue: holding.evaluationAmount,
            unrealizedPL: holding.profitLoss,
            unrealizedPLPct: holding.profitLossRate,
          },
        });

        positions.push({
          stockId: stock.id,
          symbol: holding.symbol,
          name: holding.name,
          quantity: holding.quantity,
          availableQuantity: holding.availableQuantity,
          avgPrice: holding.avgPrice,
          currentPrice: holding.currentPrice,
          purchaseAmount: holding.purchaseAmount,
          evaluationAmount: holding.evaluationAmount,
          profitLoss: holding.profitLoss,
          profitLossRate: holding.profitLossRate,
          weight,
        });
      }

      // 보유하지 않은 포지션 삭제 (0수량)
      const holdingSymbols = holdings.map((h) => h.symbol);
      const existingPositions = await prisma.position.findMany({
        where: { portfolioId: portfolio.id },
        include: { stock: true },
      });

      for (const position of existingPositions) {
        if (!holdingSymbols.includes(position.stock.symbol)) {
          await prisma.position.delete({ where: { id: position.id } });
        }
      }

      // 포트폴리오 요약 업데이트
      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: {
          cashBalance: accountBalance.cashBalance,
          totalValue: accountBalance.totalEvaluation,
          totalReturn: accountBalance.totalProfitLoss,
          totalReturnPct: accountBalance.profitLossRate,
          lastSyncedAt: new Date(),
        },
      });

      this.logger.log(
        `Synced ${positions.length} positions for user ${userId}`,
      );

      return positions;
    } catch (error) {
      this.logger.error(`Failed to sync positions: ${error.message}`);
      throw error;
    }
  }

  /**
   * 실시간 손익 계산
   */
  async calculateRealTimePnL(userId: string): Promise<{
    totalValue: number;
    totalCost: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    positions: Array<{
      symbol: string;
      currentPrice: number;
      pnl: number;
      pnlPercent: number;
    }>;
  }> {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      include: {
        positions: {
          include: { stock: true },
        },
      },
    });

    let totalValue = 0;
    let totalCost = 0;
    const positionPnL: Array<{
      symbol: string;
      currentPrice: number;
      pnl: number;
      pnlPercent: number;
    }> = [];

    for (const portfolio of portfolios) {
      totalValue += Number(portfolio.cashBalance);

      for (const position of portfolio.positions) {
        // 캐시된 가격 또는 DB 가격 사용
        let currentPrice = this.getCachedPrice(position.stock.symbol);
        if (!currentPrice) {
          currentPrice = Number(position.currentPrice);
        }

        const cost = Number(position.totalCost);
        const value = currentPrice * position.quantity;
        const pnl = value - cost;
        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

        totalValue += value;
        totalCost += cost;

        positionPnL.push({
          symbol: position.stock.symbol,
          currentPrice,
          pnl,
          pnlPercent,
        });
      }
    }

    const unrealizedPnL = totalValue - totalCost;
    const unrealizedPnLPercent =
      totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      unrealizedPnL,
      unrealizedPnLPercent,
      positions: positionPnL,
    };
  }

  /**
   * 포트폴리오 비중 조회
   */
  async getPortfolioAllocation(userId: string): Promise<AllocationMap> {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      include: {
        positions: {
          include: { stock: true },
        },
      },
    });

    const allocation: AllocationMap = {};
    let totalValue = 0;

    // 먼저 총 가치 계산
    for (const portfolio of portfolios) {
      totalValue += Number(portfolio.totalValue);
    }

    // 비중 계산
    for (const portfolio of portfolios) {
      for (const position of portfolio.positions) {
        const value = Number(position.marketValue);
        const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;

        if (allocation[position.stockId]) {
          allocation[position.stockId].amount += value;
          allocation[position.stockId].weight += weight;
        } else {
          allocation[position.stockId] = {
            symbol: position.stock.symbol,
            weight,
            amount: value,
          };
        }
      }
    }

    return allocation;
  }

  /**
   * 청산 가능 수량 계산
   */
  async getAvailableQuantity(
    userId: string,
    stockId: string,
  ): Promise<number> {
    const positions = await prisma.position.findMany({
      where: {
        portfolio: { userId },
        stockId,
      },
    });

    // 미체결 매도 주문 수량
    const pendingSells = await prisma.trade.aggregate({
      where: {
        userId,
        stockId,
        orderSide: 'SELL',
        status: { in: ['PENDING', 'SUBMITTED'] },
      },
      _sum: {
        quantity: true,
      },
    });

    const totalQuantity = positions.reduce((sum, p) => sum + p.quantity, 0);
    const pendingQuantity = pendingSells._sum.quantity || 0;

    return Math.max(0, totalQuantity - pendingQuantity);
  }

  /**
   * 포트폴리오 요약 조회
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      include: {
        positions: {
          include: { stock: true },
        },
      },
    });

    let totalValue = 0;
    let cashBalance = 0;
    let investedAmount = 0;
    let evaluationAmount = 0;
    const positions: PositionInfo[] = [];

    for (const portfolio of portfolios) {
      cashBalance += Number(portfolio.cashBalance);
      totalValue += Number(portfolio.totalValue);

      for (const position of portfolio.positions) {
        const currentPrice =
          this.getCachedPrice(position.stock.symbol) ||
          Number(position.currentPrice);

        const positionValue = currentPrice * position.quantity;
        const purchaseAmount = Number(position.totalCost);
        const profitLoss = positionValue - purchaseAmount;
        const profitLossRate =
          purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0;

        investedAmount += purchaseAmount;
        evaluationAmount += positionValue;

        positions.push({
          stockId: position.stockId,
          symbol: position.stock.symbol,
          name: position.stock.name,
          quantity: position.quantity,
          availableQuantity: position.quantity, // TODO: 미체결 주문 고려
          avgPrice: Number(position.avgPrice),
          currentPrice,
          purchaseAmount,
          evaluationAmount: positionValue,
          profitLoss,
          profitLossRate,
          weight: totalValue > 0 ? (positionValue / totalValue) * 100 : 0,
        });
      }
    }

    return {
      userId,
      totalValue,
      cashBalance,
      investedAmount,
      evaluationAmount,
      totalProfitLoss: evaluationAmount - investedAmount,
      totalProfitLossRate:
        investedAmount > 0
          ? ((evaluationAmount - investedAmount) / investedAmount) * 100
          : 0,
      positions,
      lastUpdated: new Date(),
    };
  }

  /**
   * 특정 종목 보유 수량 조회
   */
  async getHoldingQuantity(userId: string, symbol: string): Promise<number> {
    const stock = await prisma.stock.findUnique({
      where: { symbol },
    });

    if (!stock) return 0;

    const positions = await prisma.position.findMany({
      where: {
        portfolio: { userId },
        stockId: stock.id,
      },
    });

    return positions.reduce((sum, p) => sum + p.quantity, 0);
  }
}
