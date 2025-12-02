import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { prisma } from '@stockboom/database';

/**
 * Trade Transaction Service
 * Handles duplicate trade prevention using distributed locks
 */
@Injectable()
export class TradeTransactionService {
    private readonly logger = new Logger(TradeTransactionService.name);
    private readonly LOCK_TTL = 30000; // 30 seconds
    private readonly LOCK_RETRY_DELAY = 100; // 100ms
    private readonly MAX_LOCK_RETRIES = 10;

    constructor(@InjectRedis() private readonly redis: Redis) { }

    /**
     * Execute trade with duplicate prevention 
     */
    async executeTrade(params: {
        userId: string;
        stockId: string;
        brokerAccountId: string;
        orderType: string;
        orderSide: string;
        quantity: number;
        limitPrice?: number;
        stopPrice?: number;
        strategyId?: string;
    }) {
        const lockKey = `trade:lock:${params.userId}:${params.stockId}:${params.brokerAccountId}`;
        const lockValue = `${Date.now()}`;

        try {
            // Acquire distributed lock
            const locked = await this.acquireLock(lockKey, lockValue);

            if (!locked) {
                throw new BadRequestException('Another trade for this stock is in progress. Please wait.');
            }

            try {
                // Check for duplicate trades in the last 5 seconds
                const recentTrade = await prisma.trade.findFirst({
                    where: {
                        userId: params.userId,
                        stockId: params.stockId,
                        brokerAccountId: params.brokerAccountId,
                        orderSide: params.orderSide,
                        quantity: params.quantity,
                        createdAt: {
                            gte: new Date(Date.now() - 5000), // Last 5 seconds
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });

                if (recentTrade) {
                    this.logger.warn(`Duplicate trade detected for user ${params.userId}, stock ${params.stockId}`);
                    throw new BadRequestException('Duplicate trade detected. Please wait before submitting again.');
                }

                // Execute trade in transaction
                const trade = await prisma.$transaction(async (tx) => {
                    // Create trade record
                    const newTrade = await tx.trade.create({
                        data: {
                            userId: params.userId,
                            stockId: params.stockId,
                            brokerAccountId: params.brokerAccountId,
                            orderType: params.orderType as any,
                            orderSide: params.orderSide as any,
                            quantity: params.quantity,
                            limitPrice: params.limitPrice,
                            stopPrice: params.stopPrice,
                            strategyId: params.strategyId,
                            status: 'PENDING',
                            isAutoTrade: !!params.strategyId,
                        },
                        include: {
                            stock: true,
                            brokerAccount: true,
                        },
                    });

                    // Update portfolio if needed
                    const portfolio = await tx.portfolio.findFirst({
                        where: {
                            userId: params.userId,
                            brokerAccountId: params.brokerAccountId,
                        },
                    });

                    if (portfolio) {
                        // Reserve cash for buy orders
                        if (params.orderSide === 'BUY' && params.limitPrice) {
                            const estimatedCost = params.limitPrice * params.quantity;

                            if (portfolio.cashBalance < estimatedCost) {
                                throw new BadRequestException('Insufficient cash balance');
                            }

                            // Don't actually deduct yet, just check
                            // Actual deduction happens when order is filled
                        }
                    }

                    return newTrade;
                });

                this.logger.log(`Trade created successfully: ${trade.id}`);
                return trade;

            } finally {
                // Always release lock
                await this.releaseLock(lockKey, lockValue);
            }

        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error('Failed to execute trade', error);
            throw new BadRequestException(`Failed to execute trade: ${error.message}`);
        }
    }

    /**
     * Acquire distributed lock using Redis
     */
    private async acquireLock(key: string, value: string, retries: number = 0): Promise<boolean> {
        const result = await this.redis.set(key, value, 'PX', this.LOCK_TTL, 'NX');

        if (result === 'OK') {
            this.logger.debug(`Lock acquired: ${key}`);
            return true;
        }

        // Lock acquisition failed, retry if within limit
        if (retries < this.MAX_LOCK_RETRIES) {
            await this.sleep(this.LOCK_RETRY_DELAY);
            return this.acquireLock(key, value, retries + 1);
        }

        this.logger.warn(`Failed to acquire lock after ${this.MAX_LOCK_RETRIES} retries: ${key}`);
        return false;
    }

    /**
     * Release distributed lock
     */
    private async releaseLock(key: string, value: string): Promise<void> {
        // Use Lua script to ensure we only delete our own lock
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;

        await this.redis.eval(script, 1, key, value);
        this.logger.debug(`Lock released: ${key}`);
    }

    /**
     * Helper function to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if a trade lock exists
     */
    async isLocked(userId: string, stockId: string, brokerAccountId: string): Promise<boolean> {
        const lockKey = `trade:lock:${userId}:${stockId}:${brokerAccountId}`;
        const exists = await this.redis.exists(lockKey);
        return exists === 1;
    }
}
