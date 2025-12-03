import { Injectable, Logger } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { StocksService } from '../stocks/stocks.service';
import { prisma } from '@stockboom/database';

@Injectable()
export class AnalysisService {
    private readonly logger = new Logger(AnalysisService.name);

    constructor(
        private indicatorsService: IndicatorsService,
        private stocksService: StocksService,
    ) { }

    /**
     * Analyze stock with technical indicators
     */
    async analyzeStock(stockId: string, timeframe: string = '1d') {
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
            include: {
                candles: {
                    where: { timeframe },
                    orderBy: { timestamp: 'desc' },
                    take: 200, // Get enough data for indicators
                },
            },
        });

        if (!stock || stock.candles.length === 0) {
            throw new Error('Insufficient data for analysis');
        }

        // Calculate and store indicators
        const candles = stock.candles.reverse().map(c => ({
            timestamp: c.timestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume),
        }));

        await this.indicatorsService.storeIndicators(stockId, timeframe, candles);

        // Generate trading signal
        const signal = await this.indicatorsService.generateTradingSignal(stockId, timeframe);

        // Get latest indicators
        const indicators = await this.indicatorsService.getLatestIndicators(stockId, timeframe);

        return {
            stock: {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.currentPrice,
            },
            signal,
            indicators,
            analysisTime: new Date(),
        };
    }

    /**
     * Batch analyze multiple stocks
     */
    async analyzeMultipleStocks(stockIds: string[], timeframe: string = '1d') {
        const results: any[] = [];

        for (const stockId of stockIds) {
            try {
                const analysis = await this.analyzeStock(stockId, timeframe);
                results.push(analysis);
            } catch (error) {
                this.logger.error(`Failed to analyze stock ${stockId}:`, error);
                results.push({
                    stockId,
                    error: error.message,
                });
            }
        }

        return results;
    }

    /**
     * Get stock recommendations based on signals
     */
    async getRecommendations(params?: { minStrength?: number; signal?: string }) {
        const { minStrength = 70, signal } = params || {};

        // Get stocks with strong signals
        const indicators = await prisma.indicator.findMany({
            where: {
                timeframe: '1d',
                ...(signal && { signal }),
                signalStrength: {
                    gte: minStrength,
                },
            },
            include: {
                stock: true,
            },
            orderBy: {
                signalStrength: 'desc',
            },
            take: 20,
            distinct: ['stockId'],
        });

        return indicators.map(ind => ({
            stock: {
                symbol: ind.stock.symbol,
                name: ind.stock.name,
                currentPrice: ind.stock.currentPrice,
            },
            signal: ind.signal,
            strength: ind.signalStrength,
            indicatorType: ind.type,
            timestamp: ind.timestamp,
        }));
    }
}
