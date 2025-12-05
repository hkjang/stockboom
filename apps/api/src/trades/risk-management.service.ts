import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { prisma, OrderSide, Prisma } from '@stockboom/database';

export interface TradeValidationData {
    stockId: string;
    quantity: number;
    orderSide: OrderSide;
    limitPrice?: number;
    portfolioId?: string;
}

export interface RiskCheckResult {
    allowed: boolean;
    reason?: string;
    warnings?: string[];
}

/**
 * Risk Management Service
 * Validates trades against user-defined risk limits
 */
@Injectable()
export class RiskManagementService {
    private readonly logger = new Logger(RiskManagementService.name);

    /**
     * Validate a trade against all risk limits
     */
    async validateTrade(userId: string, data: TradeValidationData): Promise<RiskCheckResult> {
        const warnings: string[] = [];

        // Get user's risk settings
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                dailyMaxLoss: true,
                maxPositionPercent: true,
                maxDailyTrades: true,
            },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Check daily trade limit
        if (user.maxDailyTrades) {
            const todayTradesCount = await this.getTodayTradesCount(userId);
            if (todayTradesCount >= user.maxDailyTrades) {
                return {
                    allowed: false,
                    reason: `일일 최대 거래 횟수(${user.maxDailyTrades}회)에 도달했습니다.`,
                };
            }
            if (todayTradesCount >= user.maxDailyTrades - 2) {
                warnings.push(`오늘 ${user.maxDailyTrades - todayTradesCount}회의 거래만 더 가능합니다.`);
            }
        }

        // Check daily loss limit
        if (user.dailyMaxLoss) {
            const todayLoss = await this.getTodayLoss(userId);
            const maxLoss = Number(user.dailyMaxLoss);

            if (todayLoss >= maxLoss) {
                return {
                    allowed: false,
                    reason: `일일 최대 손실 한도(${maxLoss.toLocaleString()}원)에 도달했습니다. 내일 다시 시도해주세요.`,
                };
            }

            const lossPercentage = (todayLoss / maxLoss) * 100;
            if (lossPercentage >= 80) {
                warnings.push(`일일 손실 한도의 ${lossPercentage.toFixed(0)}%에 도달했습니다.`);
            }
        }

        // Check max position size (only for BUY orders)
        if (user.maxPositionPercent && data.orderSide === 'BUY' && data.portfolioId) {
            const positionCheck = await this.checkPositionSize(
                userId,
                data.portfolioId,
                data.stockId,
                data.quantity,
                data.limitPrice,
                Number(user.maxPositionPercent),
            );

            if (!positionCheck.allowed) {
                return positionCheck;
            }
            if (positionCheck.warnings) {
                warnings.push(...positionCheck.warnings);
            }
        }

        return {
            allowed: true,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }

    /**
     * Get the count of trades made today
     */
    private async getTodayTradesCount(userId: string): Promise<number> {
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
     * Calculate realized loss for today
     */
    private async getTodayLoss(userId: string): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const trades = await prisma.trade.findMany({
            where: {
                userId,
                status: 'FILLED',
                orderSide: 'SELL',
                filledAt: { gte: today },
            },
            include: {
                stock: true,
            },
        });

        let totalLoss = 0;

        for (const trade of trades) {
            const sellAmount = Number(trade.totalAmount || 0);
            const avgCost = Number(trade.avgFillPrice || 0) * trade.filledQuantity;
            const profitLoss = sellAmount - avgCost;

            if (profitLoss < 0) {
                totalLoss += Math.abs(profitLoss);
            }
        }

        return totalLoss;
    }

    /**
     * Check if buying this position would exceed max position size
     */
    private async checkPositionSize(
        userId: string,
        portfolioId: string,
        stockId: string,
        quantity: number,
        price: number | undefined,
        maxPercent: number,
    ): Promise<RiskCheckResult> {
        const portfolio = await prisma.portfolio.findFirst({
            where: { id: portfolioId, userId },
            include: {
                positions: { where: { stockId } },
            },
        });

        if (!portfolio) {
            return { allowed: true }; // Can't check, allow
        }

        const portfolioValue = Number(portfolio.totalValue);
        if (portfolioValue <= 0) {
            return { allowed: true }; // No portfolio value, allow
        }

        // Get current price if not provided
        let currentPrice = price;
        if (!currentPrice) {
            const stock = await prisma.stock.findUnique({
                where: { id: stockId },
                select: { currentPrice: true },
            });
            currentPrice = stock?.currentPrice ? Number(stock.currentPrice) : 0;
        }

        if (!currentPrice) {
            return { allowed: true }; // Can't determine price, allow
        }

        // Calculate new position value
        const existingPosition = portfolio.positions[0];
        const existingValue = existingPosition
            ? Number(existingPosition.marketValue)
            : 0;
        const newOrderValue = quantity * currentPrice;
        const totalPositionValue = existingValue + newOrderValue;

        const positionPercent = (totalPositionValue / portfolioValue) * 100;

        if (positionPercent > maxPercent) {
            return {
                allowed: false,
                reason: `이 거래를 실행하면 해당 종목 비중이 ${positionPercent.toFixed(1)}%가 되어 ` +
                    `최대 허용 비중(${maxPercent}%)을 초과합니다.`,
            };
        }

        const warnings: string[] = [];
        if (positionPercent > maxPercent * 0.8) {
            warnings.push(
                `이 거래 후 해당 종목 비중이 ${positionPercent.toFixed(1)}%가 됩니다 ` +
                `(한도: ${maxPercent}%).`,
            );
        }

        return {
            allowed: true,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }

    /**
     * Get user's current risk status
     */
    async getRiskStatus(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                dailyMaxLoss: true,
                maxPositionPercent: true,
                maxDailyTrades: true,
            },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        const todayTradesCount = await this.getTodayTradesCount(userId);
        const todayLoss = await this.getTodayLoss(userId);

        return {
            dailyMaxLoss: user.dailyMaxLoss ? Number(user.dailyMaxLoss) : null,
            maxPositionPercent: user.maxPositionPercent ? Number(user.maxPositionPercent) : null,
            maxDailyTrades: user.maxDailyTrades,
            currentDayTrades: todayTradesCount,
            currentDayLoss: todayLoss,
            remainingTrades: user.maxDailyTrades ? user.maxDailyTrades - todayTradesCount : null,
            remainingLossAllowance: user.dailyMaxLoss
                ? Math.max(0, Number(user.dailyMaxLoss) - todayLoss)
                : null,
        };
    }
}
