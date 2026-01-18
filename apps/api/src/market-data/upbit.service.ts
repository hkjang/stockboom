import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface CryptoTicker {
    market: string;
    koreanName: string;
    englishName: string;
    tradePrice: number;
    change: 'RISE' | 'EVEN' | 'FALL';
    changePrice: number;
    changeRate: number;
    signedChangePrice: number;
    signedChangeRate: number;
    openingPrice: number;
    highPrice: number;
    lowPrice: number;
    tradeVolume: number;
    accTradePrice24h: number;
    accTradeVolume24h: number;
    timestamp: number;
}

interface CryptoCandle {
    market: string;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface CryptoOrderbook {
    market: string;
    timestamp: number;
    totalAskSize: number;
    totalBidSize: number;
    orderbookUnits: Array<{
        askPrice: number;
        bidPrice: number;
        askSize: number;
        bidSize: number;
    }>;
}

@Injectable()
export class UpbitService {
    private readonly logger = new Logger(UpbitService.name);
    private readonly baseUrl = 'https://api.upbit.com/v1';
    
    constructor(private httpService: HttpService) {}

    /**
     * Get all available markets (종목 목록)
     */
    async getMarkets(): Promise<Array<{ market: string; koreanName: string; englishName: string }>> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/market/all?isDetails=true`)
            );
            
            return response.data.map((item: any) => ({
                market: item.market,
                koreanName: item.korean_name,
                englishName: item.english_name,
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch markets: ${error.message}`);
            return [];
        }
    }

    /**
     * Get current ticker for multiple markets
     */
    async getTickers(markets: string[]): Promise<CryptoTicker[]> {
        try {
            const marketsParam = markets.join(',');
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/ticker?markets=${marketsParam}`)
            );
            
            return response.data.map((item: any) => ({
                market: item.market,
                koreanName: '',
                englishName: '',
                tradePrice: item.trade_price,
                change: item.change,
                changePrice: item.change_price,
                changeRate: item.change_rate,
                signedChangePrice: item.signed_change_price,
                signedChangeRate: item.signed_change_rate,
                openingPrice: item.opening_price,
                highPrice: item.high_price,
                lowPrice: item.low_price,
                tradeVolume: item.trade_volume,
                accTradePrice24h: item.acc_trade_price_24h,
                accTradeVolume24h: item.acc_trade_volume_24h,
                timestamp: item.timestamp,
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch tickers: ${error.message}`);
            return [];
        }
    }

    /**
     * Get major KRW market tickers (BTC, ETH, XRP 등)
     */
    async getMajorTickers(): Promise<CryptoTicker[]> {
        const majorMarkets = [
            'KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-DOGE',
            'KRW-ADA', 'KRW-AVAX', 'KRW-DOT', 'KRW-MATIC', 'KRW-LINK'
        ];
        return this.getTickers(majorMarkets);
    }

    /**
     * Get candle data (캔들 조회)
     */
    async getCandles(
        market: string, 
        unit: 'minutes' | 'days' | 'weeks' | 'months' = 'days',
        count: number = 100,
        minuteUnit: number = 60
    ): Promise<CryptoCandle[]> {
        try {
            let url = `${this.baseUrl}/candles`;
            
            if (unit === 'minutes') {
                url += `/minutes/${minuteUnit}?market=${market}&count=${count}`;
            } else {
                url += `/${unit}?market=${market}&count=${count}`;
            }
            
            const response = await firstValueFrom(
                this.httpService.get(url)
            );
            
            return response.data.map((item: any) => ({
                market: item.market,
                timestamp: new Date(item.candle_date_time_kst),
                open: item.opening_price,
                high: item.high_price,
                low: item.low_price,
                close: item.trade_price,
                volume: item.candle_acc_trade_volume,
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch candles: ${error.message}`);
            return [];
        }
    }

    /**
     * Get orderbook (호가 정보)
     */
    async getOrderbook(markets: string[]): Promise<CryptoOrderbook[]> {
        try {
            const marketsParam = markets.join(',');
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/orderbook?markets=${marketsParam}`)
            );
            
            return response.data.map((item: any) => ({
                market: item.market,
                timestamp: item.timestamp,
                totalAskSize: item.total_ask_size,
                totalBidSize: item.total_bid_size,
                orderbookUnits: item.orderbook_units.map((unit: any) => ({
                    askPrice: unit.ask_price,
                    bidPrice: unit.bid_price,
                    askSize: unit.ask_size,
                    bidSize: unit.bid_size,
                })),
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch orderbook: ${error.message}`);
            return [];
        }
    }

    /**
     * Get recent trades (체결 내역)
     */
    async getRecentTrades(market: string, count: number = 50): Promise<any[]> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/trades/ticks?market=${market}&count=${count}`)
            );
            
            return response.data.map((item: any) => ({
                market: item.market,
                tradePrice: item.trade_price,
                tradeVolume: item.trade_volume,
                askBid: item.ask_bid,
                timestamp: item.timestamp,
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch recent trades: ${error.message}`);
            return [];
        }
    }

    /**
     * Calculate Fear & Greed proxy based on market data
     */
    async calculateMarketSentiment(): Promise<{ score: number; label: string; factors: any }> {
        try {
            const tickers = await this.getMajorTickers();
            
            // Calculate various factors
            let risingCount = 0;
            let fallingCount = 0;
            let totalVolume24h = 0;
            let avgChangeRate = 0;
            
            for (const ticker of tickers) {
                if (ticker.change === 'RISE') risingCount++;
                else if (ticker.change === 'FALL') fallingCount++;
                totalVolume24h += ticker.accTradePrice24h;
                avgChangeRate += ticker.signedChangeRate;
            }
            avgChangeRate /= tickers.length;
            
            // Calculate sentiment score (0-100)
            const riseRatio = risingCount / tickers.length;
            const volatilityScore = Math.min(Math.abs(avgChangeRate) * 500, 50);
            const score = Math.min(100, Math.max(0, riseRatio * 50 + volatilityScore));
            
            let label = '중립';
            if (score >= 75) label = '극단적 탐욕';
            else if (score >= 55) label = '탐욕';
            else if (score >= 45) label = '중립';
            else if (score >= 25) label = '공포';
            else label = '극단적 공포';
            
            return {
                score: Math.round(score),
                label,
                factors: {
                    risingCoins: risingCount,
                    fallingCoins: fallingCount,
                    avgChangeRate: (avgChangeRate * 100).toFixed(2),
                    totalVolume24h: (totalVolume24h / 1e12).toFixed(2) + '조원',
                }
            };
        } catch (error) {
            this.logger.error(`Failed to calculate sentiment: ${error.message}`);
            return { score: 50, label: '중립', factors: {} };
        }
    }

    /**
     * Check API status
     */
    async checkApiStatus(): Promise<{ connected: boolean; message: string; lastCheck: Date }> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/market/all`, { timeout: 5000 })
            );
            
            return {
                connected: response.status === 200,
                message: 'Connected',
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                connected: false,
                message: error.message,
                lastCheck: new Date(),
            };
        }
    }
}
