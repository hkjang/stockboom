import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

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

// Custom errors for better error handling
export class YahooFinanceError extends HttpException {
    constructor(message: string, status: HttpStatus = HttpStatus.BAD_GATEWAY) {
        super(message, status);
    }
}

export class YahooRateLimitError extends YahooFinanceError {
    constructor() {
        super('Yahoo Finance API rate limit exceeded. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
}

export class YahooSymbolNotFoundError extends YahooFinanceError {
    constructor(symbol: string) {
        super(`Stock symbol '${symbol}' not found on Yahoo Finance.`, HttpStatus.NOT_FOUND);
    }
}

@Injectable()
export class YahooFinanceService {
    private readonly logger = new Logger(YahooFinanceService.name);
    private readonly baseUrl = 'https://query1.finance.yahoo.com';
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000; // 1 second

    constructor(private httpService: HttpService) { }

    /**
     * Sleep helper for retry logic
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Execute request with retry logic
     */
    private async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: string
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                const isRetryable = this.isRetryableError(error);

                if (!isRetryable || attempt === this.maxRetries) {
                    throw this.handleError(error, context);
                }

                this.logger.warn(
                    `Attempt ${attempt}/${this.maxRetries} failed for ${context}. Retrying in ${this.retryDelay}ms...`
                );
                await this.sleep(this.retryDelay * attempt);
            }
        }

        throw this.handleError(lastError, context);
    }

    /**
     * Check if error is retryable
     */
    private isRetryableError(error: unknown): boolean {
        if (error instanceof AxiosError) {
            const status = error.response?.status;
            // Retry on rate limit (429), server errors (5xx), or network errors
            return status === 429 || (status && status >= 500) || !error.response;
        }
        return false;
    }

    /**
     * Handle and transform errors to user-friendly messages
     */
    private handleError(error: unknown, context: string): never {
        if (error instanceof AxiosError) {
            const status = error.response?.status;

            if (status === 429) {
                this.logger.error(`Rate limit exceeded for ${context}`);
                throw new YahooRateLimitError();
            }

            if (status === 404) {
                throw new YahooSymbolNotFoundError(context);
            }

            if (status && status >= 500) {
                throw new YahooFinanceError(
                    'Yahoo Finance service is temporarily unavailable. Please try again later.',
                    HttpStatus.SERVICE_UNAVAILABLE
                );
            }

            if (!error.response) {
                throw new YahooFinanceError(
                    'Failed to connect to Yahoo Finance. Please check your network connection.',
                    HttpStatus.BAD_GATEWAY
                );
            }
        }

        this.logger.error(`Failed to ${context}`, error);
        throw new YahooFinanceError(
            `Failed to fetch data from Yahoo Finance: ${(error as Error).message}`,
            HttpStatus.BAD_GATEWAY
        );
    }

    /**
     * Get current quote for a stock from Yahoo Finance
     * @param symbol Stock symbol (e.g., 'AAPL', '005930.KS' for Samsung)
     */
    async getQuote(symbol: string): Promise<YahooQuote> {
        return this.executeWithRetry(async () => {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/v8/finance/chart/${symbol}`, {
                    params: {
                        interval: '1d',
                        range: '1d',
                    },
                    timeout: 10000, // 10 second timeout
                }),
            );

            const result = response.data.chart?.result?.[0];
            if (!result) {
                throw new YahooSymbolNotFoundError(symbol);
            }

            const meta = result.meta;
            const quote = result.indicators?.quote?.[0] || {};

            return {
                symbol: meta.symbol,
                name: meta.longName || meta.symbol,
                currentPrice: meta.regularMarketPrice || 0,
                changePrice: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
                changePercent: meta.previousClose
                    ? (((meta.regularMarketPrice || 0) - meta.previousClose) / meta.previousClose) * 100
                    : 0,
                volume: meta.regularMarketVolume || 0,
                high: quote.high?.length > 0 ? quote.high[quote.high.length - 1] : 0,
                low: quote.low?.length > 0 ? quote.low[quote.low.length - 1] : 0,
                open: quote.open?.length > 0 ? quote.open[quote.open.length - 1] : 0,
                previousClose: meta.previousClose || 0,
                marketCap: meta.marketCap || 0,
                timestamp: new Date((meta.regularMarketTime || 0) * 1000),
            };
        }, `get quote for ${symbol}`);
    }

    /**
     * Get historical candle data from Yahoo Finance
     * @param symbol Stock symbol
     * @param interval Interval (1m, 5m, 15m, 1h, 1d, 1wk, 1mo)
     * @param range Range (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
     */
    async getCandles(symbol: string, interval: string = '1d', range: string = '1mo'): Promise<YahooCandle[]> {
        return this.executeWithRetry(async () => {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/v8/finance/chart/${symbol}`, {
                    params: {
                        interval,
                        range,
                    },
                    timeout: 15000, // 15 second timeout for larger data
                }),
            );

            const result = response.data.chart?.result?.[0];
            if (!result || !result.timestamp) {
                throw new YahooSymbolNotFoundError(symbol);
            }

            const timestamps = result.timestamp;
            const quotes = result.indicators?.quote?.[0] || {};

            return timestamps
                .map((timestamp: number, index: number) => ({
                    timestamp: new Date(timestamp * 1000),
                    open: quotes.open?.[index] ?? null,
                    high: quotes.high?.[index] ?? null,
                    low: quotes.low?.[index] ?? null,
                    close: quotes.close?.[index] ?? null,
                    volume: quotes.volume?.[index] ?? 0,
                }))
                .filter((candle: YahooCandle) =>
                    candle.open !== null &&
                    candle.high !== null &&
                    candle.low !== null &&
                    candle.close !== null
                );
        }, `get candles for ${symbol}`);
    }

    /**
     * Search for stocks by query
     * @param query Search query
     */
    async searchStocks(query: string): Promise<any[]> {
        return this.executeWithRetry(async () => {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/v1/finance/search`, {
                    params: {
                        q: query,
                        quotesCount: 10,
                        newsCount: 0,
                    },
                    timeout: 10000,
                }),
            );

            const quotes = response.data.quotes || [];
            return quotes.map((quote: any) => ({
                symbol: quote.symbol,
                name: quote.longname || quote.shortname,
                exchange: quote.exchange,
                type: quote.quoteType,
            }));
        }, `search stocks with query: ${query}`);
    }

    /**
     * Get market summary (indices)
     */
    async getMarketSummary(): Promise<any[]> {
        return this.executeWithRetry(async () => {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/v6/finance/quote/marketSummary`, {
                    timeout: 10000,
                }),
            );

            const results = response.data.marketSummaryResponse?.result || [];
            return results.map((market: any) => ({
                symbol: market.symbol,
                name: market.shortName,
                price: market.regularMarketPrice?.raw,
                change: market.regularMarketChange?.raw,
                changePercent: market.regularMarketChangePercent?.raw,
            }));
        }, 'get market summary');
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
