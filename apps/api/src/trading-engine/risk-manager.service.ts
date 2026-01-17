import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma } from '@stockboom/database';
import { KisApiService } from '../market-data/kis-api.service';
import { AuditTrailService } from './audit-trail.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import {
  OrderRequest,
  RiskCheckResult,
  RiskLimits,
  RiskStatus,
  LiquidationResult,
} from './trading-engine.types';

/**
 * Risk Manager Service
 * 거래 리스크 관리 서비스
 * 
 * 책임:
 * - 주문 전 리스크 검증
 * - 일일 손실 한도 관리
 * - 포지션 비중 제한
 * - 일일 거래 횟수 제한
 * - 긴급 청산 기능
 */
@Injectable()
export class RiskManagerService {
  private readonly logger = new Logger(RiskManagerService.name);

  // 기본 리스크 한도 (사용자 설정이 없을 경우)
  private readonly DEFAULT_LIMITS: RiskLimits = {
    dailyMaxLoss: 1000000,          // 100만원
    dailyMaxLossPercent: 3,         // 3%
    maxPositionPercent: 30,         // 30%
    maxDailyTrades: 50,             // 50회
    maxOrderValue: 10000000,        // 1천만원
  };

  constructor(
    private kisApiService: KisApiService,
    private auditTrailService: AuditTrailService,
    private circuitBreakerService: CircuitBreakerService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 사용자별 리스크 한도 조회
   */
  async getRiskLimits(userId: string): Promise<RiskLimits> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        dailyMaxLoss: true,
        maxPositionPercent: true,
        maxDailyTrades: true,
      },
    });

    return {
      dailyMaxLoss: user?.dailyMaxLoss
        ? Number(user.dailyMaxLoss)
        : this.DEFAULT_LIMITS.dailyMaxLoss,
      dailyMaxLossPercent: this.DEFAULT_LIMITS.dailyMaxLossPercent,
      maxPositionPercent: user?.maxPositionPercent
        ? Number(user.maxPositionPercent)
        : this.DEFAULT_LIMITS.maxPositionPercent,
      maxDailyTrades: user?.maxDailyTrades || this.DEFAULT_LIMITS.maxDailyTrades,
      maxOrderValue: this.DEFAULT_LIMITS.maxOrderValue,
    };
  }

  /**
   * 주문 전 리스크 검증
   */
  async validateOrder(order: OrderRequest): Promise<RiskCheckResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let riskScore = 0;

    const limits = await this.getRiskLimits(order.userId);

    // 1. 서킷 브레이커 체크
    if (!this.circuitBreakerService.canPlaceOrder(order.userId)) {
      errors.push('서킷 브레이커 활성화 상태입니다. 거래가 차단되었습니다.');
      return {
        approved: false,
        warnings,
        errors,
        riskScore: 100,
      };
    }

    // 2. 일일 손실 한도 체크
    const dailyLossCheck = await this.checkDailyLossLimit(order.userId, limits);
    if (!dailyLossCheck.passed) {
      if (dailyLossCheck.remaining <= 0) {
        errors.push(`일일 손실 한도 초과: ${dailyLossCheck.message}`);
      } else {
        warnings.push(`일일 손실 경고: ${dailyLossCheck.message}`);
        riskScore += 30;
      }
    }

    // 3. 포지션 비중 제한 체크
    const orderValue = order.quantity * (order.price || 0);
    const positionCheck = await this.checkPositionLimit(
      order.userId,
      order.stockId,
      orderValue,
      limits,
    );
    if (!positionCheck.passed) {
      if (positionCheck.exceeds) {
        errors.push(`포지션 비중 한도 초과: ${positionCheck.message}`);
      } else {
        warnings.push(`포지션 비중 경고: ${positionCheck.message}`);
        riskScore += 20;
      }
    }

    // 4. 일일 거래 횟수 체크
    const tradeCountCheck = await this.checkDailyTradeLimit(order.userId, limits);
    if (!tradeCountCheck.passed) {
      errors.push(`일일 거래 횟수 한도 초과: ${tradeCountCheck.message}`);
    }

    // 5. 주문 금액 체크
    if (orderValue > limits.maxOrderValue) {
      errors.push(
        `주문 금액 한도 초과: ${orderValue.toLocaleString()}원 > 한도 ${limits.maxOrderValue.toLocaleString()}원`,
      );
    } else if (orderValue > limits.maxOrderValue * 0.8) {
      warnings.push(`주문 금액이 한도의 80%를 초과합니다.`);
      riskScore += 10;
    }

    // 6. 자동매매 특별 검사 (자동매매인 경우 더 엄격)
    if (order.isAutoTrade) {
      riskScore += 10;
      if (orderValue > limits.maxOrderValue * 0.5) {
        warnings.push('자동매매 주문이 한도의 50%를 초과합니다.');
      }
    }

    // 결과 계산
    const approved = errors.length === 0;
    
    // 감사 로그
    if (!approved || warnings.length > 0) {
      await this.auditTrailService.logRiskEvent(
        order.userId,
        approved ? 'ORDER_VALIDATED_WITH_WARNINGS' : 'ORDER_BLOCKED',
        {
          orderId: order.signalId,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          price: order.price,
          warnings,
          errors,
          riskScore,
        },
        approved ? 'WARNING' : 'ERROR',
      );
    }

    return {
      approved,
      warnings,
      errors,
      riskScore,
      suggestedQuantity: this.calculateSuggestedQuantity(order, limits),
    };
  }

  /**
   * 일일 손실 한도 체크
   */
  async checkDailyLossLimit(
    userId: string,
    limits?: RiskLimits,
  ): Promise<{ passed: boolean; remaining: number; message: string }> {
    const riskLimits = limits || (await this.getRiskLimits(userId));
    const dailyPnL = await this.getDailyProfitLoss(userId);

    const remaining = riskLimits.dailyMaxLoss + dailyPnL; // dailyPnL is negative for loss

    if (dailyPnL <= -riskLimits.dailyMaxLoss) {
      return {
        passed: false,
        remaining: 0,
        message: `오늘 손실 ${Math.abs(dailyPnL).toLocaleString()}원 (한도: ${riskLimits.dailyMaxLoss.toLocaleString()}원)`,
      };
    }

    if (dailyPnL <= -riskLimits.dailyMaxLoss * 0.8) {
      return {
        passed: true,
        remaining,
        message: `손실이 한도의 80%에 도달했습니다 (${Math.abs(dailyPnL).toLocaleString()}원)`,
      };
    }

    return {
      passed: true,
      remaining,
      message: '',
    };
  }

  /**
   * 포지션 비중 제한 체크
   */
  async checkPositionLimit(
    userId: string,
    stockId: string,
    additionalAmount: number,
    limits?: RiskLimits,
  ): Promise<{ passed: boolean; exceeds: boolean; message: string }> {
    const riskLimits = limits || (await this.getRiskLimits(userId));

    // 총 포트폴리오 가치 계산
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      select: { totalValue: true },
    });
    const totalPortfolioValue = portfolios.reduce(
      (sum, p) => sum + Number(p.totalValue),
      0,
    );

    if (totalPortfolioValue === 0) {
      return { passed: true, exceeds: false, message: '' };
    }

    // 현재 해당 종목 포지션
    const positions = await prisma.position.findMany({
      where: {
        portfolio: { userId },
        stockId,
      },
      select: { marketValue: true },
    });
    const currentPosition = positions.reduce(
      (sum, p) => sum + Number(p.marketValue),
      0,
    );

    // 새 비중 계산
    const newPosition = currentPosition + additionalAmount;
    const newWeight = (newPosition / totalPortfolioValue) * 100;

    if (newWeight > riskLimits.maxPositionPercent) {
      return {
        passed: false,
        exceeds: true,
        message: `포지션 비중 ${newWeight.toFixed(1)}%가 한도 ${riskLimits.maxPositionPercent}%를 초과합니다`,
      };
    }

    if (newWeight > riskLimits.maxPositionPercent * 0.8) {
      return {
        passed: true,
        exceeds: false,
        message: `포지션 비중이 한도의 80%에 도달했습니다 (${newWeight.toFixed(1)}%)`,
      };
    }

    return { passed: true, exceeds: false, message: '' };
  }

  /**
   * 일일 거래 횟수 제한 체크
   */
  async checkDailyTradeLimit(
    userId: string,
    limits?: RiskLimits,
  ): Promise<{ passed: boolean; remaining: number; message: string }> {
    const riskLimits = limits || (await this.getRiskLimits(userId));
    const todayCount = await this.getTodayTradeCount(userId);
    const remaining = riskLimits.maxDailyTrades - todayCount;

    if (remaining <= 0) {
      return {
        passed: false,
        remaining: 0,
        message: `오늘 거래 횟수 ${todayCount}회 (한도: ${riskLimits.maxDailyTrades}회)`,
      };
    }

    return { passed: true, remaining, message: '' };
  }

  /**
   * 오늘 거래 횟수 조회
   */
  async getTodayTradeCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.trade.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });
  }

  /**
   * 오늘 손익 조회
   */
  async getDailyProfitLoss(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const trades = await prisma.trade.findMany({
      where: {
        userId,
        status: 'FILLED',
        filledAt: { gte: today },
      },
      select: {
        orderSide: true,
        totalAmount: true,
        commission: true,
        tax: true,
      },
    });

    // 간단한 실현 손익 계산 (매도 금액 - 매수 금액 - 수수료/세금)
    let profitLoss = 0;
    for (const trade of trades) {
      const amount = Number(trade.totalAmount || 0);
      const cost = Number(trade.commission || 0) + Number(trade.tax || 0);
      if (trade.orderSide === 'SELL') {
        profitLoss += amount - cost;
      } else {
        profitLoss -= amount + cost;
      }
    }

    return profitLoss;
  }

  /**
   * 권장 수량 계산
   */
  private calculateSuggestedQuantity(
    order: OrderRequest,
    limits: RiskLimits,
  ): number | undefined {
    if (!order.price || order.price <= 0) {
      return undefined;
    }

    // 최대 주문 금액 기준으로 수량 계산
    const maxQuantityByValue = Math.floor(limits.maxOrderValue / order.price);

    // 요청 수량이 한도를 초과하는 경우에만 제안
    if (order.quantity > maxQuantityByValue) {
      return maxQuantityByValue;
    }

    return undefined;
  }

  /**
   * 리스크 현황 조회
   */
  async getRiskStatus(userId: string): Promise<RiskStatus> {
    const limits = await this.getRiskLimits(userId);
    const dailyPnL = await this.getDailyProfitLoss(userId);
    const dailyTradeCount = await this.getTodayTradeCount(userId);

    // 최대 포지션 비중 계산
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      include: { positions: true },
    });

    let totalValue = 0;
    let largestPositionValue = 0;

    for (const portfolio of portfolios) {
      totalValue += Number(portfolio.totalValue);
      for (const position of portfolio.positions) {
        const positionValue = Number(position.marketValue);
        if (positionValue > largestPositionValue) {
          largestPositionValue = positionValue;
        }
      }
    }

    const largestPositionPercent =
      totalValue > 0 ? (largestPositionValue / totalValue) * 100 : 0;

    const circuitBreakerStatus =
      this.circuitBreakerService.getStatus(userId);

    return {
      userId,
      dailyProfitLoss: dailyPnL,
      dailyProfitLossPercent:
        totalValue > 0 ? (dailyPnL / totalValue) * 100 : 0,
      dailyTradeCount,
      largestPositionPercent,
      riskLimits: limits,
      isCircuitBreakerActive: circuitBreakerStatus.state !== 'CLOSED',
      circuitBreakerReason: circuitBreakerStatus.reason,
    };
  }

  /**
   * 긴급 청산
   */
  async emergencyLiquidation(
    userId: string,
    reason: string,
  ): Promise<LiquidationResult> {
    this.logger.warn(`🚨 Emergency liquidation triggered for user ${userId}: ${reason}`);

    const tradeIds: string[] = [];
    const errors: string[] = [];
    let totalAmount = 0;
    let liquidatedPositions = 0;

    try {
      // 1. 서킷 브레이커 트리거
      await this.circuitBreakerService.trip(userId, reason, 'CRITICAL');

      // 2. 미체결 주문 취소
      const pendingTrades = await prisma.trade.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'SUBMITTED'] },
        },
      });

      for (const trade of pendingTrades) {
        try {
          if (trade.brokerOrderId) {
            await this.kisApiService.cancelOrder(
              trade.brokerOrderId,
              trade.quantity - trade.filledQuantity,
              userId,
            );
          }
          await prisma.trade.update({
            where: { id: trade.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
        } catch (error) {
          errors.push(`주문 취소 실패 (${trade.id}): ${error.message}`);
        }
      }

      // 3. 보유 포지션 시장가 청산
      const holdings = await this.kisApiService.getHoldings(userId);

      for (const holding of holdings) {
        if (holding.quantity > 0) {
          try {
            // 시장가 매도 주문
            const result = await this.kisApiService.placeOrder(
              {
                symbol: holding.symbol,
                side: 'SELL',
                orderType: 'MARKET',
                quantity: holding.quantity,
              },
              userId,
            );

            if (result.status === 'SUCCESS') {
              liquidatedPositions++;
              totalAmount += holding.evaluationAmount;
              tradeIds.push(result.orderId || '');
            } else {
              errors.push(
                `청산 실패 (${holding.symbol}): ${result.message || 'Unknown error'}`,
              );
            }
          } catch (error) {
            errors.push(`청산 실패 (${holding.symbol}): ${error.message}`);
          }
        }
      }

      // 감사 로그
      await this.auditTrailService.logRiskEvent(
        userId,
        'EMERGENCY_LIQUIDATION',
        {
          reason,
          liquidatedPositions,
          totalAmount,
          cancelledOrders: pendingTrades.length,
          errors,
        },
        'CRITICAL',
      );

      // 이벤트 발행
      this.eventEmitter.emit('risk.emergency-liquidation', {
        userId,
        reason,
        result: { liquidatedPositions, totalAmount },
      });

    } catch (error) {
      errors.push(`긴급 청산 중 오류: ${error.message}`);
    }

    return {
      success: errors.length === 0,
      liquidatedPositions,
      totalAmount,
      tradeIds,
      errors,
    };
  }
}
