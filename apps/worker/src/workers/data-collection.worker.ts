import { Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { DataCollectionJob } from '@stockboom/types';
import { prisma } from '@stockboom/database';

export class DataCollectionWorker {
    private worker: Worker;

    constructor(private connection: Redis) {
        this.worker = new Worker(
            'data-collection',
            async (job: Job<any>) => {
                return this.processJob(job);
            },
            {
                connection: this.connection,
                concurrency: 5,
            },
        );

        this.worker.on('completed', (job) => {
            console.log(`✅ Data collection job ${job.id} completed`);
        });

        this.worker.on('failed', (job, err) => {
            console.error(`❌ Data collection job ${job?.id} failed:`, err);
        });
    }

    async processJob(job: Job<any>) {
        console.log(`📥 Processing ${job.name}`, job.data);

        switch (job.name) {
            case 'collect-candles':
                return this.collectCandles(job);
            case 'collect-quotes':
                return this.collectQuotes(job);
            default:
                console.warn(`Unknown job type: ${job.name}`);
                return { success: false };
        }
    }

    /**
     * Collect candle data for a specific stock and timeframe
     */
    async collectCandles(job: Job<{ stockId: string; symbol: string; timeframe: string }>) {
        const { stockId, symbol, timeframe } = job.data;

        try {
            await job.updateProgress(25);

            // Determine the range based on timeframe
            const range = this.getRange(timeframe);

            // Fetch candle data (using Yahoo Finance for now)
            // In production, use KIS API for Korean stocks, Yahoo for international
            const yahooSymbol = this.convertToYahooSymbol(symbol);

            // Mock API call - replace with actual implementation
            const candles = await this.fetchCandleData(yahooSymbol, timeframe, range);

            await job.updateProgress(75);

            // Store candles in database
            for (const candle of candles) {
                await prisma.candle.upsert({
                    where: {
                        stockId_timeframe_timestamp: {
                            stockId,
                            timeframe,
                            timestamp: candle.timestamp,
                        },
                    },
                    create: {
                        stockId,
                        timeframe,
                        timestamp: candle.timestamp,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume,
                    },
                    update: {
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume,
                    },
                });
            }

            await job.updateProgress(100);

            console.log(`✅ Collected ${candles.length} ${timeframe} candles for ${symbol}`);

            return { success: true, candlesCollected: candles.length };

        } catch (error) {
            console.error(`Failed to collect candles for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Collect real-time quotes
     */
    async collectQuotes(job: Job<{ stockIds: string[]; symbols: string[] }>) {
        const { stockIds, symbols } = job.data;

        try {
            // Fetch quotes for all symbols
            // Implementation depends on your data source

            await job.updateProgress(100);

            return { success: true, quotesCollected: stockIds.length };

        } catch (error) {
            console.error('Failed to collect quotes:', error);
            throw error;
        }
    }

    /**
     * Fetch candle data from data source
     * TODO: Implement actual API calls
     */
    private async fetchCandleData(symbol: string, timeframe: string, range: string) {
        // This is a placeholder - implement actual API call
        // For Yahoo Finance: use yahooFinance.getCandles(symbol, timeframe, range)
        // For KIS API: use kisApi.getCandles(symbol, timeframe, count)

        return [];
    }

    /**
     * Get appropriate range for timeframe
     */
    private getRange(timeframe: string): string {
        const rangeMap: Record<string, string> = {
            '1m': '1d',
            '5m': '5d',
            '15m': '5d',
            '1h': '1mo',
            '1d': '6mo',
            '1w': '5y',
        };
        return rangeMap[timeframe] || '1mo';
    }

    /**
     * Convert Korean stock symbol to Yahoo Finance format
     */
    private convertToYahooSymbol(symbol: string): string {
        // Korean stocks need .KS or .KQ suffix
        if (/^\d{6}$/.test(symbol)) {
            return `${symbol}.KS`; // Assuming KOSPI, check market in production
        }
        return symbol;
    }

    async start() {
        console.log('🔄 Data Collection Worker started');
    }

    async stop() {
        await this.worker.close();
        console.log('⏹️  Data Collection Worker stopped');
    }
}

