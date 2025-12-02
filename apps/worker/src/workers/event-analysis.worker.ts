import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { prisma } from '@stockboom/database';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * Event Analysis Worker
 * Detects real-time market events and triggers AI analysis
 */
@Processor('event-analysis')
export class EventAnalysisWorker {
    private readonly logger = new Logger(EventAnalysisWorker.name);

    constructor(
        @InjectQueue('notification') private notificationQueue: Queue,
        @InjectQueue('analysis') private analysisQueue: Queue,
    ) { }

    /**
     * Monitor for price spike events
     */
    @Process('price-spike-check')
    async handlePriceSpikeCheck(job: Job<{ stockId: string }>) {
        const { stockId } = job.data;

        try {
            // Get last 2 candles to compare
            const candles = await prisma.candle.findMany({
                where: {
                    stockId,
                    timeframe: '1d',
                },
                orderBy: { timestamp: 'desc' },
                take: 2,
                include: { stock: true },
            });

            if (candles.length < 2) {
                return { status: 'insufficient_data' };
            }

            const [current, previous] = candles;
            const priceChange = (Number(current.close) - Number(previous.close)) / Number(previous.close);
            const priceChangePercent = priceChange * 100;

            // Trigger if price changed more than 5%
            if (Math.abs(priceChangePercent) >= 5) {
                this.logger.log(`Price spike detected for ${current.stock.symbol}: ${priceChangePercent.toFixed(2)}%`);

                // Queue AI analysis
                await this.analysisQueue.add('analyze-stock', {
                    stockId,
                    trigger: 'PRICE_SPIKE',
                    priceChange: priceChangePercent,
                });

                // Create alert
                await this.createPriceSpikeAlert(stockId, priceChangePercent, current.stock);

                return {
                    status: 'spike_detected',
                    priceChange: priceChangePercent,
                    triggered: true,
                };
            }

            return { status: 'no_spike' };

        } catch (error) {
            this.logger.error(`Error checking price spike for ${stockId}:`, error);
            throw error;
        }
    }

    /**
     * Monitor for volume spike events
     */
    @Process('volume-spike-check')
    async handleVolumeSpikeCheck(job: Job<{ stockId: string }>) {
        const { stockId } = job.data;

        try {
            // Get last 30 days to calculate average
            const candles = await prisma.candle.findMany({
                where: {
                    stockId,
                    timeframe: '1d',
                },
                orderBy: { timestamp: 'desc' },
                take: 30,
                include: { stock: true },
            });

            if (candles.length < 10) {
                return { status: 'insufficient_data' };
            }

            const currentVolume = Number(candles[0].volume);
            const avgVolume = candles.slice(1, 30).reduce((sum, c) => sum + Number(c.volume), 0) / 29;

            const volumeRatio = currentVolume / avgVolume;

            // Trigger if volume is 3x average
            if (volumeRatio >= 3) {
                this.logger.log(`Volume spike detected for ${candles[0].stock.symbol}: ${volumeRatio.toFixed(2)}x average`);

                // Queue pattern detection
                await this.analysisQueue.add('detect-patterns', {
                    stockId,
                    trigger: 'VOLUME_SPIKE',
                    volumeRatio,
                });

                // Create alert
                await this.createVolumeSpikeAlert(stockId, volumeRatio, candles[0].stock);

                return {
                    status: 'spike_detected',
                    volumeRatio,
                    triggered: true,
                };
            }

            return { status: 'no_spike' };

        } catch (error) {
            this.logger.error(`Error checking volume spike for ${stockId}:`, error);
            throw error;
        }
    }

    /**
     * Monitor for news events
     */
    @Process('news-event-check')
    async handleNewsEventCheck(job: Job<{ stockId: string }>) {
        const { stockId } = job.data;

        try {
            // Get recent news (last 24 hours)
            const recentNews = await prisma.news.findMany({
                where: {
                    stockId,
                    publishedAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                    sentiment: null, // Not yet analyzed
                },
                orderBy: { publishedAt: 'desc' },
                take: 5,
                include: { stock: true },
            });

            if (recentNews.length === 0) {
                return { status: 'no_new_news' };
            }

            this.logger.log(`Found ${recentNews.length} new articles for ${recentNews[0].stock?.symbol || stockId}`);

            // Queue AI analysis for each news
            for (const news of recentNews) {
                await this.analysisQueue.add('analyze-news', {
                    newsId: news.id,
                    stockId,
                });
            }

            return {
                status: 'news_detected',
                count: recentNews.length,
                triggered: true,
            };

        } catch (error) {
            this.logger.error(`Error checking news events for ${stockId}:`, error);
            throw error;
        }
    }

    /**
     * Comprehensive market event scanner
     * Runs periodically to check all active stocks
     */
    @Process('scan-market-events')
    async handleMarketEventScan(job: Job) {
        this.logger.log('Starting market event scan...');

        try {
            // Get all active stocks
            const stocks = await prisma.stock.findMany({
                where: {
                    isActive: true,
                    isTradable: true,
                },
                select: { id: true, symbol: true },
            });

            let eventsDetected = 0;

            // Check each stock for events
            for (const stock of stocks) {
                try {
                    // Queue individual checks
                    await this.analysisQueue.add('price-spike-check', {
                        stockId: stock.id,
                    }, {
                        attempts: 3,
                        backoff: 5000,
                    });

                    await this.analysisQueue.add('volume-spike-check', {
                        stockId: stock.id,
                    }, {
                        attempts: 3,
                        backoff: 5000,
                    });

                    await this.analysisQueue.add('news-event-check', {
                        stockId: stock.id,
                    }, {
                        attempts: 3,
                        backoff: 5000,
                    });

                } catch (error) {
                    this.logger.error(`Error scanning ${stock.symbol}:`, error);
                }
            }

            this.logger.log(`Market event scan completed. Scanned ${stocks.length} stocks.`);

            return {
                status: 'completed',
                stocksScanned: stocks.length,
                eventsDetected,
            };

        } catch (error) {
            this.logger.error('Error in market event scan:', error);
            throw error;
        }
    }

    /**
     * Create price spike alert
     */
    private async createPriceSpikeAlert(stockId: string, priceChange: number, stock: any) {
        const direction = priceChange > 0 ? '급등' : '급락';
        const absChange = Math.abs(priceChange).toFixed(2);

        // Find users watching this stock (with active portfolios)
        const portfolios = await prisma.portfolio.findMany({
            where: {
                positions: {
                    some: { stockId },
                },
                isActive: true,
            },
            include: { user: true },
        });

        for (const portfolio of portfolios) {
            await this.notificationQueue.add('send-notification', {
                userId: portfolio.userId,
                title: `${stock.symbol} 가격 ${direction}`,
                message: `${stock.name}의 가격이 ${absChange}% ${direction}했습니다.`,
                type: 'PRICE_CHANGE',
                priority: 'HIGH',
                channel: 'WEB_PUSH',
                data: {
                    stockId,
                    symbol: stock.symbol,
                    priceChange,
                },
            });
        }
    }

    /**
     * Create volume spike alert
     */
    private async createVolumeSpikeAlert(stockId: string, volumeRatio: number, stock: any) {
        const portfolios = await prisma.portfolio.findMany({
            where: {
                positions: {
                    some: { stockId },
                },
                isActive: true,
            },
            include: { user: true },
        });

        for (const portfolio of portfolios) {
            await this.notificationQueue.add('send-notification', {
                userId: portfolio.userId,
                title: `${stock.symbol} 거래량 급증`,
                message: `${stock.name}의 거래량이 평균 대비 ${volumeRatio.toFixed(1)}배 증가했습니다.`,
                type: 'VOLUME_SPIKE',
                priority: 'NORMAL',
                channel: 'WEB_PUSH',
                data: {
                    stockId,
                    symbol: stock.symbol,
                    volumeRatio,
                },
            });
        }
    }
}
