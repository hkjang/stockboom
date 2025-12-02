import { Injectable, Logger } from '@nestjs/common';
import { KisApiService } from './kis-api.service';
import { YahooFinanceService } from './yahoo-finance.service';
import { prisma } from '@stockboom/database';

/**
 * Unified market data service that combines data from multiple sources
 */
@Injectable()
export class MarketDataService {
    private readonly logger = new Logger(MarketDataService.name);

    constructor(
        private kisApiService: KisApiService,
        private yahooFinanceService: YahooFinanceService,
    ) { }

    /**
     * Get quote from the best available source
     * Tries KIS first for Korean stocks, falls back to Yahoo Finance
     */
    async getQuote(symbol: string, market?: string) {
        try {
            // For Korean stocks, try KIS first
            if (market === 'KOSPI' || market === 'KOSDAQ' || symbol.length === 6) {
                try {
                    const kisQuote = await this.kisApiService.getQuote(symbol);
                    return { source: 'KIS', data: kisQuote };
                } catch (error) {
                    this.logger.warn(`KIS quote failed for ${symbol}, trying Yahoo Finance`);
                }
            }

            // Try Yahoo Finance
            const yahooSymbol = market ?
                this.yahooFinanceService.convertKoreanSymbol(symbol, market as any) :
                symbol;

            const yahooQuote = await this.yahooFinanceService.getQuote(yahooSymbol);
            return { source: 'Yahoo', data: yahooQuote };

        } catch (error) {
            this.logger.error(`Failed to get quote for ${symbol} from all sources`, error);
            throw error;
        }
    }

    /**
     * Update stock price in database
     */
    async updateStockPrice(symbol: string, market?: string) {
        try {
            const quoteResult = await this.getQuote(symbol, market);
            const quote = quoteResult.data;

            await prisma.stock.upsert({
                where: { symbol },
                update: {
                    currentPrice: quote.currentPrice,
                    openPrice: quote.open,
                    highPrice: quote.high,
                    lowPrice: quote.low,
                    volume: BigInt(quote.volume),
                    lastPriceUpdate: new Date(),
                },
                create: {
                    symbol,
                    name: quote.name,
                    market: market || 'UNKNOWN',
                    currentPrice: quote.currentPrice,
                    openPrice: quote.open,
                    highPrice: quote.high,
                    lowPrice: quote.low,
                    volume: BigInt(quote.volume),
                    lastPriceUpdate: new Date(),
                },
            });

            this.logger.log(`Updated price for ${symbol} from ${quoteResult.source}`);
            return quote;

        } catch (error) {
            this.logger.error(`Failed to update stock price for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get and store historical candles
     */
    async syncCandles(symbol: string, timeframe: string, market?: string) {
        try {
            let candles;

            // Try to get from appropriate source
            if (market === 'KOSPI' || market === 'KOSDAQ') {
                try {
                    candles = await this.kisApiService.getCandles(symbol, timeframe);
                } catch (error) {
                    this.logger.warn(`KIS candles failed for ${symbol}, trying Yahoo Finance`);
                    const yahooSymbol = this.yahooFinanceService.convertKoreanSymbol(symbol, market as any);
                    candles = await this.yahooFinanceService.getCandles(yahooSymbol, timeframe, '3mo');
                }
            } else {
                candles = await this.yahooFinanceService.getCandles(symbol, timeframe, '3mo');
            }

            // Get stock ID
            const stock = await prisma.stock.findUnique({ where: { symbol } });
            if (!stock) {
                throw new Error(`Stock ${symbol} not found in database`);
            }

            // Store candles in database
            for (const candle of candles) {
                await prisma.candle.upsert({
                    where: {
                        stockId_timeframe_timestamp: {
                            stockId: stock.id,
                            timeframe,
                            timestamp: candle.timestamp,
                        },
                    },
                    update: {
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: BigInt(candle.volume),
                    },
                    create: {
                        stockId: stock.id,
                        timeframe,
                        timestamp: candle.timestamp,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: BigInt(candle.volume),
                    },
                });
            }

            this.logger.log(`Synced ${candles.length} candles for ${symbol} (${timeframe})`);
            return candles;

        } catch (error) {
            this.logger.error(`Failed to sync candles for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Search for stocks across all sources
     */
    async searchStocks(query: string) {
        try {
            const results = await this.yahooFinanceService.searchStocks(query);
            return results;
        } catch (error) {
            this.logger.error(`Failed to search stocks with query: ${query}`, error);
            throw error;
        }
    }

    /**
     * Get market indices
     */
    async getMarketIndices() {
        try {
            const summary = await this.yahooFinanceService.getMarketSummary();
            return summary;
        } catch (error) {
            this.logger.error('Failed to get market indices', error);
            throw error;
        }
    }
}
