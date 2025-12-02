import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { prisma, Trade, OrderStatus, OrderType, OrderSide, Prisma } from '@stockboom/database';
import { KisApiService } from '../market-data/kis-api.service';
import { TradeExecutionJob } from '@stockboom/types';

@Injectable()
export class TradesService {
    constructor(
        @InjectQueue('trading') private tradingQueue: Queue,
        private kisApiService: KisApiService,
    ) { }

    async findAll(userId: string, params?: {
        skip?: number;
        take?: number;
        status?: OrderStatus;
    }): Promise<Trade[]> {
        const { skip, take, status } = params || {};

        return prisma.trade.findMany({
            where: {
                userId,
                ...(status && { status }),
            },
            include: {
                stock: true,
                strategy: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: take || 50,
        });
    }

    async findOne(id: string, userId: string): Promise<Trade> {
        const trade = await prisma.trade.findFirst({
            where: { id, userId },
            include: {
                stock: true,
                brokerAccount: true,
                strategy: true,
            },
        });

        if (!trade) {
            throw new NotFoundException('Trade not found');
        }

        return trade;
    }

    async create(userId: string, data: {
        brokerAccountId: string;
        stockId: string;
        orderType: OrderType;
        orderSide: OrderSide;
        quantity: number;
        limitPrice?: number;
        stopPrice?: number;
        strategyId?: string;
        isAutoTrade?: boolean;
    }): Promise<Trade> {
        // Verify broker account
        const brokerAccount = await prisma.brokerAccount.findFirst({
            where: { id: data.brokerAccountId, userId },
        });

        if (!brokerAccount) {
            throw new BadRequestException('Invalid broker account');
        }

        // Verify stock
        const stock = await prisma.stock.findUnique({
            where: { id: data.stockId },
        });

        if (!stock) {
            throw new NotFoundException('Stock not found');
        }

        // Validate order
        if (data.orderType === 'LIMIT' && !data.limitPrice) {
            throw new BadRequestException('Limit price required for limit orders');
        }

        if (data.orderType === 'STOP_LOSS' && !data.stopPrice) {
            throw new BadRequestException('Stop price required for stop loss orders');
        }

        // Create trade
        const trade = await prisma.trade.create({
            data: {
                userId,
                brokerAccountId: data.brokerAccountId,
                stockId: data.stockId,
                orderType: data.orderType,
                orderSide: data.orderSide,
                quantity: data.quantity,
                limitPrice: data.limitPrice,
                stopPrice: data.stopPrice,
                strategyId: data.strategyId,
                isAutoTrade: data.isAutoTrade || false,
                status: 'PENDING',
            },
            include: {
                stock: true,
            },
        });

        // Queue for execution
        await this.tradingQueue.add('execute-trade', {
            tradeId: trade.id,
        } as TradeExecutionJob);

        return trade;
    }

    async executeTrade(tradeId: string): Promise<Trade> {
        const trade = await prisma.trade.findUnique({
            where: { id: tradeId },
            include: {
                stock: true,
                brokerAccount: true,
            },
        });

        if (!trade) {
            throw new NotFoundException('Trade not found');
        }

        if (trade.status !== 'PENDING') {
            throw new BadRequestException('Trade is not in pending status');
        }

        try {
            // Update status to submitted
            await prisma.trade.update({
                where: { id: tradeId },
                data: {
                    status: 'SUBMITTED',
                    submittedAt: new Date(),
                },
            });

            // Execute via KIS API
            const orderResult = await this.kisApiService.placeOrder({
                symbol: trade.stock.symbol,
                side: trade.orderSide,
                quantity: trade.quantity,
                orderType: trade.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
                price: trade.limitPrice,
            });

            if (orderResult.status === 'SUCCESS') {
                // Update trade as filled (simplified - in reality would need to track partial fills)
                return prisma.trade.update({
                    where: { id: tradeId },
                    data: {
                        status: 'FILLED',
                        filledQuantity: trade.quantity,
                        avgFillPrice: trade.limitPrice || 0, // Should come from orderResult
                        brokerOrderId: orderResult.orderId,
                        filledAt: new Date(),
                    },
                    include: {
                        stock: true,
                    },
                });
            } else {
                // Update as rejected
                return prisma.trade.update({
                    where: { id: tradeId },
                    data: {
                        status: 'REJECTED',
                        failureReason: orderResult.message,
                    },
                    include: {
                        stock: true,
                    },
                });
            }
        } catch (error) {
            // Update as failed
            return prisma.trade.update({
                where: { id: tradeId },
                data: {
                    status: 'REJECTED',
                    failureReason: error.message,
                    retryCount: trade.retryCount + 1,
                },
                include: {
                    stock: true,
                },
            });
        }
    }

    async cancelTrade(id: string, userId: string): Promise<Trade> {
        const trade = await this.findOne(id, userId);

        if (!['PENDING', 'SUBMITTED', 'PARTIALLY_FILLED'].includes(trade.status)) {
            throw new BadRequestException('Cannot cancel trade in current status');
        }

        // TODO: Call broker API to cancel order

        return prisma.trade.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
            },
            include: {
                stock: true,
            },
        });
    }

    async getStatistics(userId: string, params?: { startDate?: Date; endDate?: Date }) {
        const where: Prisma.TradeWhereInput = {
            userId,
            status: 'FILLED',
            ...(params?.startDate && { filledAt: { gte: params.startDate } }),
            ...(params?.endDate && { filledAt: { lte: params.endDate } }),
        };

        const trades = await prisma.trade.findMany({
            where,
            include: {
                stock: true,
            },
        });

        const totalTrades = trades.length;
        const buyTrades = trades.filter(t => t.orderSide === 'BUY');
        const sellTrades = trades.filter(t => t.orderSide === 'SELL');

        const totalBuyAmount = buyTrades.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const totalSellAmount = sellTrades.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

        return {
            totalTrades,
            buyTrades: buyTrades.length,
            sellTrades: sellTrades.length,
            totalBuyAmount,
            totalSellAmount,
            netAmount: totalSellAmount - totalBuyAmount,
        };
    }

    /**
     * Retry a failed trade with exponential backoff
     */
    async retryFailedTrade(tradeId: string): Promise<Trade> {
        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 1000; // 1 second

        const trade = await prisma.trade.findUnique({
            where: { id: tradeId },
            include: {
                stock: true,
                brokerAccount: true,
            },
        });

        if (!trade) {
            throw new NotFoundException('Trade not found');
        }

        if (trade.status !== 'REJECTED') {
            throw new BadRequestException('Can only retry rejected trades');
        }

        if (trade.retryCount >= MAX_RETRIES) {
            throw new BadRequestException(`Maximum retry attempts (${MAX_RETRIES}) exceeded`);
        }

        // Calculate delay with exponential backoff
        const delayMs = BASE_DELAY_MS * Math.pow(2, trade.retryCount);

        // Update retry count and reset to PENDING
        await prisma.trade.update({
            where: { id: tradeId },
            data: {
                status: 'PENDING',
                retryCount: trade.retryCount + 1,
                failureReason: null,
            },
        });

        // Queue for retry with delay
        await this.tradingQueue.add(
            'execute-trade',
            { tradeId: trade.id } as TradeExecutionJob,
            {
                delay: delayMs,
                attempts: 1, // Single attempt in queue, we handle retries manually
            }
        );

        return prisma.trade.findUnique({
            where: { id: tradeId },
            include: { stock: true },
        });
    }

    /**
     * Auto-retry all failed trades that haven't exceeded retry limit
     */
    async retryAllFailed(userId: string): Promise<{ retriedCount: number; skippedCount: number }> {
        const MAX_RETRIES = 3;

        const failedTrades = await prisma.trade.findMany({
            where: {
                userId,
                status: 'REJECTED',
                retryCount: {
                    lt: MAX_RETRIES,
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        let retriedCount = 0;
        let skippedCount = 0;

        for (const trade of failedTrades) {
            try {
                await this.retryFailedTrade(trade.id);
                retriedCount++;
            } catch (error) {
                this.logger.error(`Failed to retry trade ${trade.id}:`, error);
                skippedCount++;
            }
        }

        return { retriedCount, skippedCount };
    }

    /**
     * Get failed trades that can be retried
     */
    async getRetriableTrades(userId: string): Promise<Trade[]> {
        const MAX_RETRIES = 3;

        return prisma.trade.findMany({
            where: {
                userId,
                status: 'REJECTED',
                retryCount: {
                    lt: MAX_RETRIES,
                },
            },
            include: {
                stock: true,
                strategy: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    /**
     * Helper for logging (if not already present)
     */
    private logger = {
        error: (message: string, ...args: any[]) => console.error(message, ...args),
        log: (message: string, ...args: any[]) => console.log(message, ...args),
        warn: (message: string, ...args: any[]) => console.warn(message, ...args),
    };
}
