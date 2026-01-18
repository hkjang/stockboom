import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { prisma } from '@stockboom/database';

interface StockPrice {
    symbol: string;
    name: string;
    market: string;
    closePrice: number;
    openPrice: number;
    highPrice: number;
    lowPrice: number;
    volume: number;
    change: number;
    changePercent: number;
    tradingValue: number;
    marketCap: number;
    date: string;
}

interface IndexData {
    indexCode: string;
    indexName: string;
    closeValue: number;
    openValue: number;
    highValue: number;
    lowValue: number;
    change: number;
    changePercent: number;
    volume: number;
    tradingValue: number;
    date: string;
}

interface EconomicIndicator {
    code: string;
    name: string;
    value: number;
    unit: string;
    date: string;
    change: number;
}

@Injectable()
export class PublicDataService {
    private readonly logger = new Logger(PublicDataService.name);
    private readonly stockPriceApiUrl = 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService';
    private readonly indexApiUrl = 'https://apis.data.go.kr/1160100/service/GetMarketIndexInfoService';
    
    constructor(
        private httpService: HttpService,
        private configService: ConfigService,
    ) {}

    /**
     * Get API key from system settings or environment
     */
    private async getApiKey(): Promise<string> {
        // Try system settings first
        const setting = await prisma.systemSettings.findUnique({
            where: { key: 'PUBLIC_DATA_API_KEY' },
        });
        
        if (setting?.value) {
            return setting.value;
        }
        
        // Fallback to environment variable
        const envKey = this.configService.get<string>('PUBLIC_DATA_API_KEY');
        if (envKey) {
            return envKey;
        }
        
        throw new Error('Public Data API key not configured');
    }

    /**
     * Get stock prices from 금융위원회 주식시세정보
     * Note: Data is delayed by 1 business day
     */
    async getStockPrices(date: string, symbols?: string[]): Promise<StockPrice[]> {
        try {
            const apiKey = await this.getApiKey();
            const url = `${this.stockPriceApiUrl}/getStockPriceInfo`;
            
            const params: any = {
                serviceKey: apiKey,
                numOfRows: symbols?.length || 100,
                pageNo: 1,
                resultType: 'json',
                basDt: date.replace(/-/g, ''),
            };
            
            if (symbols && symbols.length === 1) {
                params.isinCd = symbols[0];
            }
            
            const response = await firstValueFrom(
                this.httpService.get(url, { params })
            );
            
            const items = response.data?.response?.body?.items?.item || [];
            
            return items.map((item: any) => ({
                symbol: item.srtnCd || item.isinCd,
                name: item.itmsNm,
                market: item.mrktCtg,
                closePrice: Number(item.clpr) || 0,
                openPrice: Number(item.mkp) || 0,
                highPrice: Number(item.hipr) || 0,
                lowPrice: Number(item.lopr) || 0,
                volume: Number(item.trqu) || 0,
                change: Number(item.vs) || 0,
                changePercent: Number(item.fltRt) || 0,
                tradingValue: Number(item.trPrc) || 0,
                marketCap: Number(item.mrktTotAmt) || 0,
                date: item.basDt,
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch stock prices: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get KOSPI/KOSDAQ index data
     */
    async getIndexData(indexCode: string, startDate: string, endDate: string): Promise<IndexData[]> {
        try {
            const apiKey = await this.getApiKey();
            const url = `${this.indexApiUrl}/getStockMarketIndex`;
            
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    params: {
                        serviceKey: apiKey,
                        numOfRows: 100,
                        pageNo: 1,
                        resultType: 'json',
                        beginBasDt: startDate.replace(/-/g, ''),
                        endBasDt: endDate.replace(/-/g, ''),
                        idxNm: indexCode,
                    },
                })
            );
            
            const items = response.data?.response?.body?.items?.item || [];
            
            return items.map((item: any) => ({
                indexCode: item.idxCsf,
                indexName: item.idxNm,
                closeValue: Number(item.clpr) || 0,
                openValue: Number(item.mkp) || 0,
                highValue: Number(item.hipr) || 0,
                lowValue: Number(item.lopr) || 0,
                change: Number(item.vs) || 0,
                changePercent: Number(item.fltRt) || 0,
                volume: Number(item.trqu) || 0,
                tradingValue: Number(item.trPrc) || 0,
                date: item.basDt,
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch index data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get multiple market indices (KOSPI, KOSDAQ, KRX100 등)
     */
    async getAllIndices(date: string): Promise<IndexData[]> {
        const indices = ['코스피', '코스닥', 'KRX100'];
        const results: IndexData[] = [];
        
        for (const idx of indices) {
            try {
                const data = await this.getIndexData(idx, date, date);
                results.push(...data);
            } catch (error) {
                this.logger.warn(`Failed to fetch ${idx} index: ${error.message}`);
            }
        }
        
        return results;
    }

    /**
     * Get top volume stocks
     */
    async getTopVolumeStocks(date: string, limit: number = 20): Promise<StockPrice[]> {
        try {
            const stocks = await this.getStockPrices(date);
            return stocks
                .sort((a, b) => b.volume - a.volume)
                .slice(0, limit);
        } catch (error) {
            this.logger.error(`Failed to fetch top volume stocks: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get top gainers/losers
     */
    async getTopMovers(date: string, type: 'gainers' | 'losers', limit: number = 20): Promise<StockPrice[]> {
        try {
            const stocks = await this.getStockPrices(date);
            const sorted = stocks.sort((a, b) => 
                type === 'gainers' 
                    ? b.changePercent - a.changePercent 
                    : a.changePercent - b.changePercent
            );
            return sorted.slice(0, limit);
        } catch (error) {
            this.logger.error(`Failed to fetch top ${type}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sync stock prices to database
     */
    async syncStockPricesToDatabase(date: string): Promise<number> {
        try {
            const prices = await this.getStockPrices(date);
            let updated = 0;
            
            for (const price of prices) {
                try {
                    await prisma.stock.upsert({
                        where: { symbol: price.symbol },
                        update: {
                            currentPrice: price.closePrice,
                            openPrice: price.openPrice,
                            highPrice: price.highPrice,
                            lowPrice: price.lowPrice,
                            volume: price.volume,
                            marketCap: price.marketCap,
                            updatedAt: new Date(),
                        },
                        create: {
                            symbol: price.symbol,
                            name: price.name,
                            market: price.market === '코스피' ? 'KOSPI' : price.market === '코스닥' ? 'KOSDAQ' : 'ETC',
                            currentPrice: price.closePrice,
                            openPrice: price.openPrice,
                            highPrice: price.highPrice,
                            lowPrice: price.lowPrice,
                            volume: price.volume,
                            marketCap: price.marketCap,
                            isTradable: true,
                        },
                    });
                    updated++;
                } catch (e) {
                    this.logger.warn(`Failed to upsert stock ${price.symbol}: ${e.message}`);
                }
            }
            
            this.logger.log(`Synced ${updated} stock prices to database`);
            return updated;
        } catch (error) {
            this.logger.error(`Failed to sync stock prices: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get service status for monitoring
     */
    async checkApiStatus(): Promise<{ connected: boolean; message: string; lastCheck: Date }> {
        try {
            const apiKey = await this.getApiKey();
            const testUrl = `${this.stockPriceApiUrl}/getStockPriceInfo`;
            
            const response = await firstValueFrom(
                this.httpService.get(testUrl, {
                    params: {
                        serviceKey: apiKey,
                        numOfRows: 1,
                        pageNo: 1,
                        resultType: 'json',
                    },
                    timeout: 5000,
                })
            );
            
            const resultCode = response.data?.response?.header?.resultCode;
            
            return {
                connected: resultCode === '00',
                message: resultCode === '00' ? 'Connected' : `Error: ${resultCode}`,
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
