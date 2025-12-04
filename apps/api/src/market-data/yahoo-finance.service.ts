import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface YahooQuote {
    symbol: string;
    name: string;
    currentPrice: number;
    changePrice: number;
    changePercent: number;
    volume: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    marketCap: number;
    timestamp: Date;
}

export interface YahooCandle {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

@Injectable()
export class YahooFinanceService {
    private readonly logger = new Logger(YahooFinanceService.name);
    private readonly baseUrl = 'https://query1.finance.yahoo.com';

    constructor(private httpService: HttpService) { }

    /**
     * Get current quote for a stock from Yahoo Finance
     * @param symbol Stock symbol (e.g., 'AAPL', '005930.KS' for Samsung)
     */
    async getQuote(symbol: string): Promise<YahooQuote> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/v8/finance/chart/${symbol}`, {
                    params: {
                        interval: '1d',
                        range: '1d',
                    },
                }),
            );

            const result = response.data.chart.result[0];
            const meta = result.meta;
            const quote = result.indicators.quote[0];

            return {
                symbol: meta.symbol,
                name: meta.longName || meta.symbol,
                currentPrice: meta.regularMarketPrice,
                changePrice: meta.regularMarketPrice - meta.previousClose,
                changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
                volume: meta.regularMarketVolume,
                high: (quote.high && quote.high.length > 0) ? quote.high[quote.high.length - 1] : 0,
                low: (quote.low && quote.low.length > 0) ? quote.low[quote.low.length - 1] : 0,
                open: (quote.open && quote.open.length > 0) ? quote.open[quote.open.length - 1] : 0,
                previousClose: meta.previousClose,
                marketCap: meta.marketCap || 0,
                timestamp: new Date(meta.regularMarketTime * 1000),
            };

        } catch (error) {
            this.logger.error(`Failed to get Yahoo Finance quote for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get historical candle data from Yahoo Finance
     * @param symbol Stock symbol
     * @param interval Interval (1m, 5m, 15m, 1h, 1d, 1wk, 1mo)
     * @param range Range (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
     */
    async getCandles(symbol: string, interval: string = '1d', range: string = '1mo'): Promise<YahooCandle[]> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/v8/finance/chart/${symbol}`, {
                    params: {
                        interval,
                        range,
                    },
                }),
            );

            const result = response.data.chart.result[0];
            const timestamps = result.timestamp;
            const quotes = result.indicators.quote[0];

            return timestamps.map((timestamp: number, index: number) => ({
                timestamp: new Date(timestamp * 1000),
                open: quotes.open[index],
                high: quotes.high[index],
                low: quotes.low[index],
                close: quotes.close[index],
                volume: quotes.volume[index],
            }));

        } catch (error) {
            this.logger.error(`Failed to get Yahoo Finance candles for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Search for stocks by query
     * @param query Search query
     */
    async searchStocks(query: string): Promise<any[]> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/v1/finance/search`, {
                    params: {
                        q: query,
                        quotesCount: 10,
                        newsCount: 0,
                    },
                }),
            );

            return response.data.quotes.map((quote: any) => ({
                symbol: quote.symbol,
                name: quote.longname || quote.shortname,
                exchange: quote.exchange,
                type: quote.quoteType,
            }));

        } catch (error) {
            this.logger.error(`Failed to search stocks with query: ${query}`, error);
            throw error;
        }
    }

    /**
     * Get market summary (indices)
     */
    async getMarketSummary(): Promise<any[]> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/v6/finance/quote/marketSummary`),
            );

            return response.data.marketSummaryResponse.result.map((market: any) => ({
                symbol: market.symbol,
                name: market.shortName,
                price: market.regularMarketPrice?.raw,
                change: market.regularMarketChange?.raw,
                changePercent: market.regularMarketChangePercent?.raw,
            }));

        } catch (error) {
            this.logger.error('Failed to get market summary', error);
            throw error;
        }
    }

    /**
     * Convert Korean stock symbol to Yahoo Finance format
     * @param symbol Korean stock code (e.g., '005930')
     * @returns Yahoo Finance symbol (e.g., '005930.KS')
     */
    convertKoreanSymbol(symbol: string, market: 'KOSPI' | 'KOSDAQ' = 'KOSPI'): string {
        const suffix = market === 'KOSPI' ? '.KS' : '.KQ';
        return `${symbol}${suffix}`;
    }
}
