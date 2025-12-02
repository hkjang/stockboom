import { Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { TradeExecutionJob } from '@stockboom/types';

export class TraderWorker {
    private worker: Worker;

    constructor(private connection: Redis) {
        this.worker = new Worker(
            'trading',
            async (job: Job<TradeExecutionJob>) => {
                return this.processJob(job);
            },
            {
                connection: this.connection,
                concurrency: 1, // Process trades one at a time to avoid conflicts
            },
        );

        this.worker.on('completed', (job) => {
            console.log(`✅ Trading job ${job.id} completed`);
        });

        this.worker.on('failed', (job, err) => {
            console.error(`❌ Trading job ${job?.id} failed:`, err);
        });
    }

    async processJob(job: Job<TradeExecutionJob>) {
        console.log(`💰 Processing trading job ${job.id}`, job.data);

        const { tradeId, retry } = job.data;

        // TODO: Implement actual trading logic
        // - Get trade details from database
        // - Execute order via KIS API
        // - Update trade status
        // - Send notification

        await job.updateProgress(100);

        return { success: true, tradeId };
    }

    async start() {
        console.log('🔄 Trader Worker started');
    }

    async stop() {
        await this.worker.close();
        console.log('⏹️  Trader Worker stopped');
    }
}
