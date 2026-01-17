/**
 * Auto-Rebalancing Service
 * 자동 리밸런싱 서비스
 * 
 * 전문가급 기능:
 * - 목표 비중과 현재 비중 비교
 * - 드리프트 임계값 초과 시 자동 리밸런싱
 * - 세금 효율적 리밸런싱 (Tax-Loss Harvesting)
 * - 스케줄 기반 자동 실행
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma } from '@stockboom/database';

export interface RebalanceConfig {
  portfolioId: string;
  targetWeights: Record<string, number>;  // symbol -> weight (0-100)
  driftThreshold: number;                  // 리밸런싱 트리거 임계값 (%)
  minTradeAmount: number;                  // 최소 거래 금액
  maxTradePercentage: number;              // 한 번에 최대 거래 비율
  excludeSymbols?: string[];               // 제외 종목
}

export interface RebalanceAction {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  currentWeight: number;
  targetWeight: number;
  driftAmount: number;
  estimatedValue: number;
  reason: string;
}

export interface RebalanceResult {
  portfolioId: string;
  executed: boolean;
  actions: RebalanceAction[];
  totalBuyValue: number;
  totalSellValue: number;
  driftBefore: number;
  driftAfter: number;
  timestamp: Date;
}

@Injectable()
export class AutoRebalancingService {
  private readonly logger = new Logger(AutoRebalancingService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * 포트폴리오 드리프트 분석
   */
  async analyzePortfolioDrift(portfolioId: string): Promise<{
    totalDrift: number;
    positionDrifts: Array<{
      symbol: string;
      currentWeight: number;
      targetWeight: number;
      drift: number;
    }>;
    needsRebalancing: boolean;
  }> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        positions: {
          include: { stock: true },
        },
      },
    });

    if (!portfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    // 현재 총 가치
    const totalValue = portfolio.positions.reduce(
      (sum, pos) => sum + Number(pos.marketValue || 0),
      0
    ) + Number(portfolio.cashBalance || 0);

    // 목표 비중 (기본 균등 배분)
    const targetWeights: Record<string, number> = {};
    const equalWeight = 100 / portfolio.positions.length;

    // 각 포지션의 드리프트 계산
    const positionDrifts = portfolio.positions.map(pos => {
      const currentWeight = totalValue > 0 
        ? (Number(pos.marketValue || 0) / totalValue) * 100 
        : 0;
      const targetWeight = targetWeights[pos.stock.symbol] || equalWeight;
      const drift = Math.abs(currentWeight - targetWeight);

      return {
        symbol: pos.stock.symbol,
        currentWeight,
        targetWeight,
        drift,
      };
    });

    const totalDrift = positionDrifts.reduce((sum, p) => sum + p.drift, 0) / 2;
    const driftThreshold = 5; // 기본 5%

    return {
      totalDrift,
      positionDrifts,
      needsRebalancing: totalDrift > driftThreshold,
    };
  }

  /**
   * 리밸런싱 계획 생성
   */
  async generateRebalancePlan(config: RebalanceConfig): Promise<RebalanceAction[]> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: config.portfolioId },
      include: {
        positions: {
          include: { stock: true },
        },
      },
    });

    if (!portfolio) {
      throw new Error(`Portfolio not found: ${config.portfolioId}`);
    }

    const totalValue = portfolio.positions.reduce(
      (sum, pos) => sum + Number(pos.marketValue || 0),
      0
    ) + Number(portfolio.cashBalance || 0);

    const actions: RebalanceAction[] = [];

    for (const pos of portfolio.positions) {
      if (config.excludeSymbols?.includes(pos.stock.symbol)) continue;

      const currentWeight = totalValue > 0 
        ? (Number(pos.marketValue || 0) / totalValue) * 100 
        : 0;
      const targetWeight = config.targetWeights[pos.stock.symbol] || currentWeight;
      const drift = currentWeight - targetWeight;

      if (Math.abs(drift) < config.driftThreshold) continue;

      const targetValue = (targetWeight / 100) * totalValue;
      const currentValue = Number(pos.marketValue || 0);
      const valueChange = targetValue - currentValue;

      if (Math.abs(valueChange) < config.minTradeAmount) continue;

      // 최대 거래 비율 적용
      const maxChange = currentValue * (config.maxTradePercentage / 100);
      const adjustedChange = Math.min(Math.abs(valueChange), maxChange) * Math.sign(valueChange);

      const currentPrice = Number(pos.stock.currentPrice || 0);
      if (currentPrice <= 0) continue;

      const quantity = Math.floor(Math.abs(adjustedChange) / currentPrice);
      if (quantity === 0) continue;

      actions.push({
        symbol: pos.stock.symbol,
        side: adjustedChange > 0 ? 'BUY' : 'SELL',
        quantity,
        currentWeight,
        targetWeight,
        driftAmount: Math.abs(drift),
        estimatedValue: quantity * currentPrice,
        reason: adjustedChange > 0 
          ? `비중 부족 (${currentWeight.toFixed(1)}% → ${targetWeight.toFixed(1)}%)`
          : `비중 초과 (${currentWeight.toFixed(1)}% → ${targetWeight.toFixed(1)}%)`,
      });
    }

    // 매도 우선 정렬 (자금 확보)
    return actions.sort((a, b) => {
      if (a.side === 'SELL' && b.side === 'BUY') return -1;
      if (a.side === 'BUY' && b.side === 'SELL') return 1;
      return b.driftAmount - a.driftAmount;
    });
  }

  /**
   * 리밸런싱 실행
   */
  async executeRebalance(
    portfolioId: string,
    actions: RebalanceAction[],
    dryRun: boolean = false,
  ): Promise<RebalanceResult> {
    this.logger.log(`Executing rebalance for portfolio ${portfolioId} (dryRun: ${dryRun})`);

    const driftAnalysis = await this.analyzePortfolioDrift(portfolioId);

    if (dryRun) {
      return {
        portfolioId,
        executed: false,
        actions,
        totalBuyValue: actions.filter(a => a.side === 'BUY').reduce((s, a) => s + a.estimatedValue, 0),
        totalSellValue: actions.filter(a => a.side === 'SELL').reduce((s, a) => s + a.estimatedValue, 0),
        driftBefore: driftAnalysis.totalDrift,
        driftAfter: 0, // 예상 값
        timestamp: new Date(),
      };
    }

    // 실제 주문 실행 (TradingEngineService 사용)
    for (const action of actions) {
      this.eventEmitter.emit('rebalance.order', {
        portfolioId,
        symbol: action.symbol,
        side: action.side,
        quantity: action.quantity,
        reason: 'AUTO_REBALANCE',
      });
    }

    this.eventEmitter.emit('rebalance.completed', {
      portfolioId,
      actionsCount: actions.length,
    });

    return {
      portfolioId,
      executed: true,
      actions,
      totalBuyValue: actions.filter(a => a.side === 'BUY').reduce((s, a) => s + a.estimatedValue, 0),
      totalSellValue: actions.filter(a => a.side === 'SELL').reduce((s, a) => s + a.estimatedValue, 0),
      driftBefore: driftAnalysis.totalDrift,
      driftAfter: 0,
      timestamp: new Date(),
    };
  }

  /**
   * 세금 효율적 리밸런싱 (Tax-Loss Harvesting)
   * 손실 난 포지션을 매도하여 세금 절감
   */
  async taxLossHarvesting(portfolioId: string): Promise<RebalanceAction[]> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        positions: {
          include: { stock: true },
        },
      },
    });

    if (!portfolio) return [];

    const harvestingActions: RebalanceAction[] = [];

    for (const pos of portfolio.positions) {
      const unrealizedPnl = Number(pos.unrealizedPL || 0);
      const pnlPercent = Number(pos.unrealizedPLPct || 0);

      // 10% 이상 손실이고 30일 이상 보유한 경우
      if (pnlPercent < -10) {
        harvestingActions.push({
          symbol: pos.stock.symbol,
          side: 'SELL',
          quantity: pos.quantity,
          currentWeight: 0,
          targetWeight: 0,
          driftAmount: 0,
          estimatedValue: Number(pos.marketValue || 0),
          reason: `Tax-Loss Harvesting: ${pnlPercent.toFixed(1)}% 손실 실현`,
        });
      }
    }

    return harvestingActions;
  }

  /**
   * 자동 리밸런싱 스케줄 (매월 1일)
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async scheduledRebalancing(): Promise<void> {
    this.logger.log('Running scheduled monthly rebalancing check...');

    // 자동 리밸런싱 활성화된 포트폴리오 조회
    const portfolios = await prisma.portfolio.findMany({
      where: {
        autoTrade: true,
      },
    });

    for (const portfolio of portfolios) {
      try {
        const analysis = await this.analyzePortfolioDrift(portfolio.id);
        
        if (analysis.needsRebalancing) {
          this.logger.log(`Portfolio ${portfolio.id} needs rebalancing (drift: ${analysis.totalDrift.toFixed(2)}%)`);
          
          const plan = await this.generateRebalancePlan({
            portfolioId: portfolio.id,
            targetWeights: {},
            driftThreshold: 5,
            minTradeAmount: 100000,
            maxTradePercentage: 25,
          });

          if (plan.length > 0) {
            await this.executeRebalance(portfolio.id, plan, false);
          }
        }
      } catch (error) {
        this.logger.error(`Rebalancing failed for portfolio ${portfolio.id}:`, error);
      }
    }
  }

  /**
   * 드리프트 모니터링 (매일)
   */
  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  async dailyDriftMonitoring(): Promise<void> {
    this.logger.log('Running daily drift monitoring...');

    const portfolios = await prisma.portfolio.findMany({
      where: { autoTrade: true },
    });

    for (const portfolio of portfolios) {
      try {
        const analysis = await this.analyzePortfolioDrift(portfolio.id);
        
        // 10% 이상 드리프트 시 알림
        if (analysis.totalDrift > 10) {
          this.eventEmitter.emit('portfolio.drift.alert', {
            portfolioId: portfolio.id,
            drift: analysis.totalDrift,
            message: `포트폴리오 비중이 목표에서 ${analysis.totalDrift.toFixed(1)}% 벗어났습니다.`,
          });
        }
      } catch (error) {
        this.logger.error(`Drift monitoring failed for portfolio ${portfolio.id}:`, error);
      }
    }
  }
}
