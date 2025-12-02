import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * Health Check Service
 * Monitors system health and cleans up stale jobs
 */
@Injectable()
export class HealthCheckService implements OnModuleInit {
    private readonly logger = new Logger(HealthCheckService.name);

    constructor(
        @InjectQueue('trading') private tradingQueue: Queue,
        @InjectQueue('analysis') private analysisQueue: Queue,
        @InjectQueue('data-collection') private dataCollectionQueue: Queue,
        @InjectQueue('notification') private notificationQueue: Queue,
    ) { }

    onModuleInit() {
        this.logger.log('Health Check Service initialized');
    }

    /**
     * Clean up old completed jobs every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async cleanupCompletedJobs() {
        this.logger.log('Starting cleanup of completed jobs...');

        const queues = [
            { name: 'trading', queue: this.tradingQueue },
            { name: 'analysis', queue: this.analysisQueue },
            { name: 'data-collection', queue: this.dataCollectionQueue },
            { name: 'notification', queue: this.notificationQueue },
        ];

        for (const { name, queue } of queues) {
            try {
                // Clean jobs completed more than 24 hours ago
                await queue.clean(24 * 60 * 60 * 1000, 'completed');
                this.logger.log(`Cleaned completed jobs from ${name} queue`);
            } catch (error) {
                this.logger.error(`Failed to clean ${name} queue:`, error);
            }
        }
    }

    /**
     * Check queue health every 5 minutes
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkQueueHealth() {
        const queues = [
            { name: 'trading', queue: this.tradingQueue },
            { name: 'analysis', queue: this.analysisQueue },
            { name: 'data-collection', queue: this.dataCollectionQueue },
            { name: 'notification', queue: this.notificationQueue },
        ];

        for (const { name, queue } of queues) {
            try {
                const [waiting, active, failed] = await Promise.all([
                    queue.getWaitingCount(),
                    queue.getActiveCount(),
                    queue.getFailedCount(),
                ]);

                // Warning if too many waiting jobs
                if (waiting > 1000) {
                    this.logger.warn(
                        `${name} queue has ${waiting} waiting jobs - potential backlog`
                    );
                }

                // Warning if too many failed jobs
                if (failed > 100) {
                    this.logger.warn(
                        `${name} queue has ${failed} failed jobs - needs attention`
                    );
                }

                // Log active processing
                if (active > 0) {
                    this.logger.debug(`${name} queue: ${active} jobs active`);
                }
            } catch (error) {
                this.logger.error(`Health check failed for ${name} queue:`, error);
            }
        }
    }

    /**
     * Get current health status
     */
    async getHealthStatus() {
        const queues = [
            { name: 'trading', queue: this.tradingQueue },
            { name: 'analysis', queue: this.analysisQueue },
            { name: 'data-collection', queue: this.dataCollectionQueue },
            { name: 'notification', queue: this.notificationQueue },
        ];

        const queueHealth = await Promise.all(
            queues.map(async ({ name, queue }) => {
                const [waiting, active, failed] = await Promise.all([
                    queue.getWaitingCount(),
                    queue.getActiveCount(),
                    queue.getFailedCount(),
                ]);

                const status = failed > 100 ? 'unhealthy' :
                    waiting > 1000 ? 'degraded' :
                        'healthy';

                return { name, status, waiting, active, failed };
            })
        );

        return {
            status: queueHealth.every(q => q.status === 'healthy') ? 'healthy' : 'degraded',
            queues: queueHealth,
            timestamp: new Date().toISOString(),
        };
    }
}
