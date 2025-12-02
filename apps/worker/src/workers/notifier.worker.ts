import { Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { NotificationJob } from '@stockboom/types';

export class NotifierWorker {
    private worker: Worker;

    constructor(private connection: Redis) {
        this.worker = new Worker(
            'notification',
            async (job: Job<NotificationJob>) => {
                return this.processJob(job);
            },
            {
                connection: this.connection,
                concurrency: 10,
            },
        );

        this.worker.on('completed', (job) => {
            console.log(`✅ Notification job ${job.id} completed`);
        });

        this.worker.on('failed', (job, err) => {
            console.error(`❌ Notification job ${job?.id} failed:`, err);
        });
    }

    async processJob(job: Job<NotificationJob>) {
        console.log(`🔔 Processing notification job ${job.id}`, job.data);

        const { userId, type, title, message, channel, priority } = job.data;

        // TODO: Implement actual notification logic
        // - Send via appropriate channel (Web Push, Email)
        // - Store notification in database
        // - Mark as sent

        await job.updateProgress(100);

        return { success: true, userId, channel };
    }

    async start() {
        console.log('🔄 Notifier Worker started');
    }

    async stop() {
        await this.worker.close();
        console.log('⏹️  Notifier Worker stopped');
    }
}
