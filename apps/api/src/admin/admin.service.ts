import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { prisma } from '@stockboom/database';
import * as os from 'os';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserApiKeysService, UserApiKeysDto } from '../user-api-keys/user-api-keys.service';

@Injectable()
export class AdminService {
    constructor(
        @InjectQueue('trading') private tradingQueue: Queue,
        @InjectQueue('analysis') private analysisQueue: Queue,
        @InjectQueue('data-collection') private dataCollectionQueue: Queue,
        @InjectQueue('notification') private notificationQueue: Queue,
        private userApiKeysService: UserApiKeysService,
    ) { }

    /**
     * Get system statistics for admin dashboard
     */
    async getSystemStats() {
        const [
            totalUsers,
            activeTrades,
            recentUsers,
            recentTrades,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.trade.count({
                where: {
                    status: { in: ['PENDING', 'SUBMITTED', 'PARTIALLY_FILLED'] },
                },
            }),
            prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true,
                },
            }),
            prisma.trade.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    stock: true,
                },
            }),
        ]);

        // Get queue job counts
        const queueJobs = await this.getQueueJobCounts();

        return {
            totalUsers,
            activeTrades,
            queueJobs: queueJobs.total,
            apiRequestsPerMin: 0, // TODO: Implement with Redis counter
            recentUsers,
            recentTrades,
        };
    }

    /**
     * Get system metrics (CPU, memory, disk)
     */
    async getSystemMetrics() {
        const cpus = os.cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        // Calculate CPU usage (simplified)
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

        // Get error logs from last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const errorLogs = await this.getRecentErrors(oneHourAgo);

        return {
            cpu: Math.round(cpuUsage),
            memory: Math.round((usedMemory / totalMemory) * 100),
            disk: 45, // TODO: Implement actual disk usage check
            errorLogs,
        };
    }

    /**
     * Get queue status for all queues
     */
    async getQueueStatus() {
        const queues = [
            { name: 'trading', queue: this.tradingQueue },
            { name: 'analysis', queue: this.analysisQueue },
            { name: 'data-collection', queue: this.dataCollectionQueue },
            { name: 'notification', queue: this.notificationQueue },
        ];

        const queueStatus = await Promise.all(
            queues.map(async ({ name, queue }) => {
                const [waiting, active, completed, failed] = await Promise.all([
                    queue.getWaitingCount(),
                    queue.getActiveCount(),
                    queue.getCompletedCount(),
                    queue.getFailedCount(),
                ]);

                return {
                    name,
                    waiting,
                    active,
                    completed,
                    failed,
                };
            })
        );

        return queueStatus;
    }

    /**
     * Get all users for admin management
     */
    async getAllUsers() {
        return prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                twoFactorEnabled: true,
                isActive: true,
                createdAt: true,
                lastLoginAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Update user status
     */
    async updateUserStatus(userId: string, isActive: boolean) {
        return prisma.user.update({
            where: { id: userId },
            data: { isActive },
        });
    }

    /**
     * Update user details
     */
    async updateUser(userId: string, data: { name?: string; email?: string }) {
        return prisma.user.update({
            where: { id: userId },
            data,
        });
    }

    /**
     * Delete user
     */
    async deleteUser(userId: string) {
        return prisma.user.delete({
            where: { id: userId },
        });
    }

    /**
     * Reset user password
     */
    async resetUserPassword(userId: string) {
        // Generate random 8-character password
        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hashedPassword },
        });

        return { success: true, tempPassword };
    }

    /**
     * Get failed jobs for a queue
     */
    async getFailedJobs(queueName: string, limit: number = 10) {
        const queueMap = {
            trading: this.tradingQueue,
            analysis: this.analysisQueue,
            'data-collection': this.dataCollectionQueue,
            notification: this.notificationQueue,
        };

        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error('Invalid queue name');
        }

        const failedJobs = await queue.getFailed(0, limit - 1);

        return failedJobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            failedReason: job.failedReason,
            stacktrace: job.stacktrace,
            timestamp: job.timestamp,
            attemptsMade: job.attemptsMade,
        }));
    }

    /**
     * Retry failed job
     */
    async retryFailedJob(queueName: string, jobId: string) {
        const queueMap = {
            trading: this.tradingQueue,
            analysis: this.analysisQueue,
            'data-collection': this.dataCollectionQueue,
            notification: this.notificationQueue,
        };

        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error('Invalid queue name');
        }

        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error('Job not found');
        }

        await job.retry();
        return { success: true, jobId };
    }

    /**
     * Clear completed jobs from queue
     */
    async clearCompletedJobs(queueName: string) {
        const queueMap = {
            trading: this.tradingQueue,
            analysis: this.analysisQueue,
            'data-collection': this.dataCollectionQueue,
            notification: this.notificationQueue,
        };

        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error('Invalid queue name');
        }

        await queue.clean(0, 'completed');
        return { success: true, queueName };
    }

    /**
     * Helper: Get total queue job counts
     */
    private async getQueueJobCounts() {
        const queues = [
            this.tradingQueue,
            this.analysisQueue,
            this.dataCollectionQueue,
            this.notificationQueue,
        ];

        let total = 0;
        for (const queue of queues) {
            const [waiting, active] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
            ]);
            total += waiting + active;
        }

        return { total };
    }

    /**
     * Helper: Get recent error logs
     * TODO: Implement proper error logging system
     */
    private async getRecentErrors(since: Date) {
        // Placeholder - implement with proper logging system
        return [];
    }

    /**
     * Bulk create stocks
     */
    async bulkCreateStocks(stocks: any[]) {
        const results: {
            success: any[];
            failed: Array<{ data: any; error: string }>;
        } = {
            success: [],
            failed: [],
        };

        for (const stockData of stocks) {
            try {
                const stock = await prisma.stock.upsert({
                    where: { symbol: stockData.symbol },
                    update: stockData,
                    create: stockData,
                });
                results.success.push(stock);
            } catch (error: any) {
                results.failed.push({
                    data: stockData,
                    error: error.message,
                });
            }
        }

        return results;
    }

    /**
     * Sync stocks from OpenDart
     * TODO: Implement actual OpenDart integration
     */
    async syncStocksFromOpenDart(corpCodes?: string[]) {
        // This will be implemented when OpenDartService is integrated
        return {
            message: 'OpenDart sync not yet implemented',
            corpCodes: corpCodes || [],
        };
    }

    /**
     * Get all stocks for admin management
     */
    /**
     * Get all stocks for admin management with data collection stats
     */
    async getAllStocks(params?: {
        skip?: number;
        take?: number;
        search?: string;
    }) {
        const { skip, take, search } = params || {};

        const where = search ? {
            OR: [
                { symbol: { contains: search, mode: 'insensitive' as any } },
                { name: { contains: search, mode: 'insensitive' as any } },
                { corpName: { contains: search, mode: 'insensitive' as any } },
            ],
        } : {};

        const [stocks, total] = await Promise.all([
            prisma.stock.findMany({
                where,
                skip,
                take: take || 50,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.stock.count({ where }),
        ]);

        // Fetch stats for each stock (in parallel)
        const stocksWithStats = await Promise.all(stocks.map(async (stock) => {
            const [
                candleStats,
                indicatorStats,
                newsStats,
                aiReportStats
            ] = await Promise.all([
                // Candles
                prisma.candle.aggregate({
                    where: { stockId: stock.id },
                    _count: true,
                    _max: { timestamp: true }
                }),
                // Indicators
                prisma.indicator.aggregate({
                    where: { stockId: stock.id },
                    _count: true,
                    _max: { timestamp: true }
                }),
                // News
                prisma.news.aggregate({
                    where: { stockId: stock.id },
                    _count: true,
                    _max: { publishedAt: true }
                }),
                // AI Reports
                prisma.aIReport.aggregate({
                    where: { stockId: stock.id },
                    _count: true,
                    _max: { createdAt: true }
                })
            ]);

            return {
                ...stock,
                stats: {
                    candles: {
                        count: candleStats._count,
                        lastUpdated: candleStats._max.timestamp
                    },
                    indicators: {
                        count: indicatorStats._count,
                        lastUpdated: indicatorStats._max.timestamp
                    },
                    news: {
                        count: newsStats._count,
                        lastUpdated: newsStats._max.publishedAt
                    },
                    aiReports: {
                        count: aiReportStats._count,
                        lastUpdated: aiReportStats._max.createdAt
                    }
                }
            };
        }));

        return { stocks: stocksWithStats, total };
    }

    /**
     * Delete stock
     */
    async deleteStock(stockId: string) {
        return prisma.stock.delete({
            where: { id: stockId },
        });
    }

    /**
     * Get user API keys (masked)
     */
    async getUserApiKeys(userId: string) {
        return this.userApiKeysService.getMaskedKeys(userId, userId, true);
    }

    /**
     * Update user API keys
     */
    async updateUserApiKeys(userId: string, data: UserApiKeysDto) {
        await this.userApiKeysService.updateKeys(userId, data, userId, true);
        return { success: true, message: 'User API keys updated' };
    }

    /**
     * Delete user API keys
     */
    async deleteUserApiKeys(userId: string) {
        await this.userApiKeysService.deleteKeys(userId, userId, true);
        return { success: true, message: 'User API keys deleted' };
    }
}
