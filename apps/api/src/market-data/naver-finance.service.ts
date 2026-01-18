import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';

interface StockSummary {
    symbol: string;
    name: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    volume: number;
    tradingValue: number;
    marketCap: number;
    per: number;
    pbr: number;
    eps: number;
    bps: number;
    dividendYield: number;
    foreignOwnership: number;
}

interface InvestorFlow {
    date: string;
    individual: number;
    foreign: number;
    institution: number;
    pension: number;
    insurance: number;
}

interface SectorData {
    sectorCode: string;
    sectorName: string;
    change: number;
    changePercent: number;
    volume: number;
    topStocks: string[];
}

@Injectable()
export class NaverFinanceService {
    private readonly logger = new Logger(NaverFinanceService.name);
    private readonly baseUrl = 'https://finance.naver.com';
    private readonly mobileUrl = 'https://m.stock.naver.com';
    
    constructor(private httpService: HttpService) {}

    /**
     * Get stock summary from Naver Finance
     */
    async getStockSummary(symbol: string): Promise<StockSummary | null> {
        try {
            const url = `${this.baseUrl}/item/main.nhn?code=${symbol}`;
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                })
            );
            
            const $ = cheerio.load(response.data);
            
            // Parse stock info
            const name = $('.wrap_company h2 a').text().trim();
            const priceText = $('#chart_area .rate_info .today .no_today').text().replace(/,/g, '');
            const currentPrice = parseInt(priceText) || 0;
            
            const changeInfo = $('#chart_area .rate_info .today').text();
            const isDown = changeInfo.includes('하락') || changeInfo.includes('-');
            const changeMatch = changeInfo.match(/([0-9,]+)/g);
            const change = changeMatch ? parseInt(changeMatch[1]?.replace(/,/g, '') || '0') * (isDown ? -1 : 1) : 0;
            const changePercent = changeMatch ? parseFloat(changeMatch[2]?.replace(/,/g, '') || '0') * (isDown ? -1 : 1) : 0;

            // Parse additional info from table
            const tableData: Record<string, string> = {};
            $('#tab_con1 table tr').each((_, tr) => {
                const $tr = $(tr);
                $tr.find('th').each((i, th) => {
                    const key = $(th).text().trim();
                    const value = $tr.find('td').eq(i).text().trim();
                    tableData[key] = value;
                });
            });

            return {
                symbol,
                name,
                currentPrice,
                change,
                changePercent,
                volume: this.parseNumber(tableData['거래량']),
                tradingValue: this.parseNumber(tableData['거래대금']),
                marketCap: this.parseNumber(tableData['시가총액']),
                per: this.parseNumber(tableData['PER']),
                pbr: this.parseNumber(tableData['PBR']),
                eps: this.parseNumber(tableData['EPS']),
                bps: this.parseNumber(tableData['BPS']),
                dividendYield: this.parseNumber(tableData['배당수익률']),
                foreignOwnership: this.parseNumber(tableData['외국인소진률']),
            };
        } catch (error) {
            this.logger.error(`Failed to fetch stock summary for ${symbol}: ${error.message}`);
            return null;
        }
    }

    /**
     * Get investor trading flow (외국인/기관 매매동향)
     */
    async getInvestorFlow(symbol: string, days: number = 20): Promise<InvestorFlow[]> {
        try {
            const url = `${this.baseUrl}/item/frgn.nhn?code=${symbol}`;
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                })
            );
            
            const $ = cheerio.load(response.data);
            const flows: InvestorFlow[] = [];
            
            $('table.type2 tbody tr').each((i, tr) => {
                if (i >= days) return false;
                
                const $tr = $(tr);
                const tds = $tr.find('td');
                
                if (tds.length >= 6) {
                    const dateText = tds.eq(0).text().trim();
                    if (dateText.match(/\d{4}\.\d{2}\.\d{2}/)) {
                        flows.push({
                            date: dateText,
                            foreign: this.parseSignedNumber(tds.eq(5).text()),
                            institution: this.parseSignedNumber(tds.eq(6).text()),
                            individual: 0, // Calculated separately
                            pension: 0,
                            insurance: 0,
                        });
                    }
                }
            });
            
            return flows;
        } catch (error) {
            this.logger.error(`Failed to fetch investor flow for ${symbol}: ${error.message}`);
            return [];
        }
    }

    /**
     * Get foreign net buying stocks ranking
     */
    async getForeignNetBuying(market: 'kospi' | 'kosdaq' = 'kospi'): Promise<any[]> {
        try {
            const marketCode = market === 'kospi' ? '01' : '02';
            const url = `${this.baseUrl}/sise/sise_trans_foreign.nhn?sosok=${marketCode}&type=1`;
            
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                })
            );
            
            const $ = cheerio.load(response.data);
            const stocks: any[] = [];
            
            $('table.type2 tbody tr').each((_, tr) => {
                const $tr = $(tr);
                const tds = $tr.find('td');
                
                if (tds.length >= 8) {
                    const nameLink = tds.eq(1).find('a');
                    if (nameLink.length) {
                        const href = nameLink.attr('href') || '';
                        const symbolMatch = href.match(/code=(\d+)/);
                        
                        stocks.push({
                            rank: parseInt(tds.eq(0).text()) || stocks.length + 1,
                            symbol: symbolMatch ? symbolMatch[1] : '',
                            name: nameLink.text().trim(),
                            currentPrice: this.parseNumber(tds.eq(2).text()),
                            change: this.parseSignedNumber(tds.eq(3).text()),
                            netBuying: this.parseSignedNumber(tds.eq(5).text()),
                            holdings: this.parseNumber(tds.eq(6).text()),
                            holdingPercent: parseFloat(tds.eq(7).text()) || 0,
                        });
                    }
                }
            });
            
            return stocks.slice(0, 30);
        } catch (error) {
            this.logger.error(`Failed to fetch foreign net buying: ${error.message}`);
            return [];
        }
    }

    /**
     * Get institutional net buying stocks
     */
    async getInstitutionalNetBuying(market: 'kospi' | 'kosdaq' = 'kospi'): Promise<any[]> {
        try {
            const marketCode = market === 'kospi' ? '01' : '02';
            const url = `${this.baseUrl}/sise/sise_trans_organ.nhn?sosok=${marketCode}&type=1`;
            
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                })
            );
            
            const $ = cheerio.load(response.data);
            const stocks: any[] = [];
            
            $('table.type2 tbody tr').each((_, tr) => {
                const $tr = $(tr);
                const tds = $tr.find('td');
                
                if (tds.length >= 6) {
                    const nameLink = tds.eq(1).find('a');
                    if (nameLink.length) {
                        const href = nameLink.attr('href') || '';
                        const symbolMatch = href.match(/code=(\d+)/);
                        
                        stocks.push({
                            rank: parseInt(tds.eq(0).text()) || stocks.length + 1,
                            symbol: symbolMatch ? symbolMatch[1] : '',
                            name: nameLink.text().trim(),
                            currentPrice: this.parseNumber(tds.eq(2).text()),
                            change: this.parseSignedNumber(tds.eq(3).text()),
                            netBuying: this.parseSignedNumber(tds.eq(5).text()),
                        });
                    }
                }
            });
            
            return stocks.slice(0, 30);
        } catch (error) {
            this.logger.error(`Failed to fetch institutional net buying: ${error.message}`);
            return [];
        }
    }

    /**
     * Get sector ranking
     */
    async getSectorRanking(): Promise<SectorData[]> {
        try {
            const url = `${this.baseUrl}/sise/sise_group.nhn?type=upjong`;
            
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                })
            );
            
            const $ = cheerio.load(response.data);
            const sectors: SectorData[] = [];
            
            $('table.type_1 tbody tr').each((_, tr) => {
                const $tr = $(tr);
                const tds = $tr.find('td');
                
                if (tds.length >= 4) {
                    const nameLink = tds.eq(0).find('a');
                    if (nameLink.length) {
                        const href = nameLink.attr('href') || '';
                        const codeMatch = href.match(/no=(\d+)/);
                        
                        sectors.push({
                            sectorCode: codeMatch ? codeMatch[1] : '',
                            sectorName: nameLink.text().trim(),
                            change: this.parseSignedNumber(tds.eq(1).text()),
                            changePercent: parseFloat(tds.eq(2).text().replace('%', '')) || 0,
                            volume: this.parseNumber(tds.eq(3).text()),
                            topStocks: [],
                        });
                    }
                }
            });
            
            return sectors;
        } catch (error) {
            this.logger.error(`Failed to fetch sector ranking: ${error.message}`);
            return [];
        }
    }

    /**
     * Get market index (KOSPI, KOSDAQ)
     */
    async getMarketIndex(): Promise<{ kospi: any; kosdaq: any }> {
        try {
            const url = `${this.baseUrl}/sise/sise_index.nhn?code=KOSPI`;
            const kosdaqUrl = `${this.baseUrl}/sise/sise_index.nhn?code=KOSDAQ`;
            
            const [kospiRes, kosdaqRes] = await Promise.all([
                firstValueFrom(this.httpService.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                })),
                firstValueFrom(this.httpService.get(kosdaqUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                })),
            ]);
            
            const parseIndex = (html: string) => {
                const $ = cheerio.load(html);
                const now = $('#now_value').text().replace(/,/g, '');
                const change = $('#change_value_and_rate .value').text().replace(/,/g, '');
                const rate = $('#change_value_and_rate .rate').text().replace(/[%\s]/g, '');
                
                return {
                    value: parseFloat(now) || 0,
                    change: parseFloat(change) || 0,
                    changePercent: parseFloat(rate) || 0,
                };
            };
            
            return {
                kospi: parseIndex(kospiRes.data),
                kosdaq: parseIndex(kosdaqRes.data),
            };
        } catch (error) {
            this.logger.error(`Failed to fetch market index: ${error.message}`);
            return {
                kospi: { value: 0, change: 0, changePercent: 0 },
                kosdaq: { value: 0, change: 0, changePercent: 0 },
            };
        }
    }

    /**
     * Check service status
     */
    async checkApiStatus(): Promise<{ connected: boolean; message: string; lastCheck: Date }> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(this.baseUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 5000,
                })
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

    // Helper functions
    private parseNumber(str: string): number {
        if (!str) return 0;
        const cleaned = str.replace(/[^0-9.-]/g, '');
        return parseFloat(cleaned) || 0;
    }

    private parseSignedNumber(str: string): number {
        if (!str) return 0;
        const isNegative = str.includes('-') || str.includes('▼');
        const cleaned = str.replace(/[^0-9.]/g, '');
        const value = parseFloat(cleaned) || 0;
        return isNegative ? -value : value;
    }
}
