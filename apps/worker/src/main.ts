import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { DataCollectionWorker } from './workers/data-collection.worker';
import { AnalyzerWorker } from './workers/analyzer.worker';
import { TraderWorker } from './workers/trader.worker';
import { NotifierWorker } from './workers/notifier.worker';

const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
});

async function main() {
    console.log('🚀 Starting StockBoom Workers...');

    // Initialize workers
    const dataCollectionWorker = new DataCollectionWorker(connection);
    const analyzerWorker = new AnalyzerWorker(connection);
    const traderWorker = new TraderWorker(connection);
    const notifierWorker = new NotifierWorker(connection);

    // Start all workers
    await dataCollectionWorker.start();
    await analyzerWorker.start();
    await traderWorker.start();
    await notifierWorker.start();

    console.log('✅ All workers started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        await dataCollectionWorker.stop();
        await analyzerWorker.stop();
        await traderWorker.stop();
        await notifierWorker.stop();
        await connection.quit();
        process.exit(0);
    });
}

main().catch(console.error);
