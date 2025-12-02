import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { prisma } from '@stockboom/database';

/**
 * Data Collection Scheduler
 * Schedules periodic data collection for different timeframes
 */
@Injectable()
export class DataCollectionScheduler {
    private readonly logger = new Logger(DataCollectionScheduler.name);

    constructor(
        @InjectQueue('data-collection') private dataCollectionQueue: Queue,
    ) { }

    /**
     * Collect 1-minute candles every minute
     */
    @Cron('*/1 * * * *')
    async collect1MinuteCandles() {
        this.logger.debug('Starting 1-minute candle collection');
        await this.queueCandleCollection('1m');
    }

    /**
     * Collect 5-minute candles every 5 minutes
     */
    @Cron('*/5 * * * *')
    async collect5MinuteCandles() {
        this.logger.debug('Starting 5-minute candle collection');
        await this.queueCandleCollection('5m');
    }

    /**
     * Collect 15-minute candles every 15 minutes
     */
    @Cron('*/15 * * * *')
    async collect15MinuteCandles() {
        this.logger.debug('Starting 15-minute candle collection');
        await this.queueCandleCollection('15m');
    }

    /**
     * Collect 1-hour candles every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async collect1HourCandles() {
        this.logger.debug('Starting 1-hour candle collection');
        await this.queueCandleCollection('1h');
    }

    /**
     * Collect daily candles at 6 PM KST (market close)
     */
    @Cron('0 18 * * 1-5') // Monday to Friday at 6 PM
    async collectDailyCandles() {
        this.logger.log('Starting daily candle collection');
        await this.queueCandleCollection('1d');
    }

    /**
     * Collect weekly candles every Monday at 6 PM
     */
    @Cron('0 18 * * 1')
    async collectWeeklyCandles() {
        this.logger.log('Starting weekly candle collection');
        await this.queueCandleCollection('1w');
    }

    /**
     * Queue candle collection for all active stocks
     */
    private async queueCandleCollection(timeframe: string) {
        try {
            // Get all active and tradable stocks
            const stocks = await prisma.stock.findMany({
                where: {
                    isActive: true,
                    isTradable: true,
                },
                select: {
                    id: true,
                    symbol: true,
                },
            });

            this.logger.log(`Queuing ${timeframe} candle collection for ${stocks.length} stocks`);

            // Queue collection job for each stock
            for (const stock of stocks) {
                await this.dataCollectionQueue.add(
                    'collect-candles',
                    {
                        stockId: stock.id,
                        symbol: stock.symbol,
                        timeframe,
                    },
                    {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000,
                        },
                    }
                );
            }

            this.logger.log(`Queued ${stocks.length} ${timeframe} candle collection jobs`);
        } catch (error) {
            this.logger.error(`Failed to queue ${timeframe} candle collection:`, error);
        }
    }
}
