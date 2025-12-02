import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { prisma } from '@stockboom/database';
import * as os from 'os';

@Injectable()
export class AdminService {
    constructor(
        @InjectQueue('trading') private tradingQueue: Queue,
        @InjectQueue('analysis') private analysisQueue: Queue,
        @InjectQueue('data-collection') private dataCollectionQueue: Queue,
        @InjectQueue('notification') private notificationQueue: Queue,
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
                createdAt: true,
                lastLoginAt: true,
                // isActive field doesn't exist in schema, using placeholder
                // TODO: Add isActive field to User model
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Update user status
     */
    async updateUserStatus(userId: string, isActive: boolean) {
        // TODO: Implement when isActive field is added to schema
        return { success: true, userId, isActive };
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
}
