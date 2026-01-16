import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { parseStringPromise } from 'xml2js';
import * as iconv from 'iconv-lite';
import { UserApiKeysService } from '../user-api-keys/user-api-keys.service';
import { prisma } from '@stockboom/database';
import AdmZip from 'adm-zip';


@Injectable()
export class OpenDartService {
    private readonly logger = new Logger(OpenDartService.name);
    private readonly baseUrl = 'https://opendart.fss.or.kr/api';

    constructor(
        private configService: ConfigService,
        private userApiKeysService: UserApiKeysService,
    ) { }

    private async getApiKey(userId?: string): Promise<string> {
        // 1. Check user-specific API key first
        if (userId) {
            try {
                const userKeys = await this.userApiKeysService.getKeys(userId, userId, true);
                if (userKeys?.openDartApiKey) {
                    await this.userApiKeysService.updateLastUsed(userId);
                    return userKeys.openDartApiKey;
                }
            } catch (error) {
                this.logger.warn(`Failed to get user API key for ${userId}, checking system settings`);
            }
        }

        // 2. Check SystemSettings database
        try {
            const systemSetting = await prisma.systemSettings.findUnique({
                where: { key: 'OPENDART_API_KEY' },
            });
            if (systemSetting?.value && systemSetting.value.trim() !== '') {
                this.logger.debug('Using OpenDart API key from SystemSettings');
                return systemSetting.value;
            }
        } catch (error) {
            this.logger.warn('Failed to get API key from SystemSettings, falling back to env');
        }

        // 3. Fall back to environment variable
        const envKey = this.configService.get<string>('OPENDART_API_KEY') || '';
        if (!envKey) {
            throw new Error('OpenDart API key not configured. Set it in Admin Settings or .env file.');
        }
        return envKey;
    }


    async getCompanyOverview(corpCode: string, userId?: string) {
        const apiKey = await this.getApiKey(userId);
        try {
            const url = `${this.baseUrl}/company.json?crtfc_key=${apiKey}&corp_code=${corpCode}`;
            const response = await this.fetchJson(url);
            if (response.status !== '000') {
                throw new Error(`OpenDart API error: ${response.message}`);
            }
            return response;
        } catch (error) {
            this.logger.error(`Failed to get company overview for ${corpCode}`, error);
            throw error;
        }
    }

    async getCorpCodeList(userId?: string): Promise<Map<string, string>> {
        const apiKey = await this.getApiKey(userId);
        try {
            const url = `${this.baseUrl}/corpCode.xml?crtfc_key=${apiKey}`;
            const xmlData = await this.fetchXml(url);
            const parsed = await parseStringPromise(xmlData);
            const corpList = parsed.result.list[0].list || [];
            const corpCodeMap = new Map<string, string>();

            for (const corp of corpList) {
                const corpName = corp.corp_name?.[0];
                const corpCode = corp.corp_code?.[0];
                const stockCode = corp.stock_code?.[0];

                if (corpName && corpCode) {
                    corpCodeMap.set(corpName, corpCode);
                    if (stockCode && stockCode !== ' ') {
                        corpCodeMap.set(stockCode, corpCode);
                    }
                }
            }

            this.logger.log(`Loaded ${corpCodeMap.size} corporation codes from OpenDart`);
            return corpCodeMap;
        } catch (error) {
            this.logger.error('Failed to get corp code list', error);
            throw error;
        }
    }

    async searchCorpCode(query: string, userId?: string): Promise<string | null> {
        try {
            const corpCodeMap = await this.getCorpCodeList(userId);
            return corpCodeMap.get(query) || null;
        } catch (error) {
            this.logger.error(`Failed to search corp code for ${query}`, error);
            return null;
        }
    }

    async getFinancialStatements(corpCode: string, year: string, reportCode: string = '11011', userId?: string) {
        const apiKey = await this.getApiKey(userId);
        try {
            const url = `${this.baseUrl}/fnlttSinglAcntAll.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reportCode}`;
            const response = await this.fetchJson(url);
            if (response.status !== '000') {
                throw new Error(`OpenDart API error: ${response.message}`);
            }
            return response.list || [];
        } catch (error) {
            this.logger.error(`Failed to get financial statements for ${corpCode}`, error);
            throw error;
        }
    }

    async getDisclosureList(beginDate: string, endDate: string, corpCode?: string, userId?: string) {
        const apiKey = await this.getApiKey(userId);
        try {
            let url = `${this.baseUrl}/list.json?crtfc_key=${apiKey}&bgn_de=${beginDate}&end_de=${endDate}`;
            if (corpCode) {
                url += `&corp_code=${corpCode}`;
            }
            const response = await this.fetchJson(url);
            if (response.status !== '000') {
                throw new Error(`OpenDart API error: ${response.message}`);
            }
            return response.list || [];
        } catch (error) {
            this.logger.error('Failed to get disclosure list', error);
            throw error;
        }
    }

    async syncCorpCodesToDatabase(userId?: string): Promise<number> {
        try {
            const apiKey = await this.getApiKey(userId);
            this.logger.log(`API key: ${apiKey.substring(0, 8)}...`);

            const url = `${this.baseUrl}/corpCode.xml?crtfc_key=${apiKey}`;
            this.logger.log(`Full URL: ${url.substring(0, 60)}...`);

            const xmlData = await this.fetchXml(url);
            return await this.syncCorpCodesFromXml(xmlData);
        } catch (error) {
            this.logger.error('Failed to sync corp codes', error);
            throw error;
        }
    }

    /**
     * Process and sync corporation codes from XML string (useful for uploaded files)
     */
    async syncCorpCodesFromXml(xmlData: string): Promise<number> {
        try {
            let syncedCount = 0;

            if (!xmlData || xmlData.length === 0) {
                throw new Error('Empty XML data');
            }

            const parsed = await parseStringPromise(xmlData);
            const corpList = parsed.result.list || [];

            this.logger.log(`Found ${corpList.length} corporations in XML`);

            for (const corp of corpList) {
                const corpName = corp.corp_name?.[0];
                const corpCode = corp.corp_code?.[0];
                const stockCode = corp.stock_code?.[0];

                if (stockCode && stockCode.trim() && stockCode !== ' ') {
                    try {
                        await prisma.stock.upsert({
                            where: { symbol: stockCode },
                            update: { corpName, corpCode },
                            create: {
                                symbol: stockCode,
                                name: corpName,
                                corpName,
                                corpCode,
                                market: 'KOSPI',
                            },
                        });
                        syncedCount++;
                    } catch (error) {
                        this.logger.warn(`Failed to sync ${corpName}`);
                    }
                }
            }

            this.logger.log(`Synced ${syncedCount} corporations`);
            return syncedCount;
        } catch (error) {
            this.logger.error('Failed to process XML data', error);
            throw error;
        }
    }

    async deleteAllCorpCodes(): Promise<number> {
        try {
            const result = await prisma.stock.deleteMany({
                where: {
                    market: { in: ['KOSPI', 'KOSDAQ', 'KONEX'] }
                }
            });
            this.logger.log(`Deleted ${result.count} stocks`);
            return result.count;
        } catch (error) {
            this.logger.error('Failed to delete all corp codes', error);
            throw error;
        }
    }

    async collectCompanyInfo(corpCode: string, userId?: string): Promise<any> {
        try {
            const companyInfo = await this.getCompanyOverview(corpCode, userId);
            const stock = await prisma.stock.findFirst({ where: { corpCode } });

            if (stock) {
                await prisma.stock.update({
                    where: { id: stock.id },
                    data: {
                        corpName: companyInfo.corp_name,
                        sector: companyInfo.induty_code,
                    },
                });
                return { success: true, stock, companyInfo };
            } else {
                return { success: false, message: 'Stock not found' };
            }
        } catch (error) {
            this.logger.error(`Failed to collect company info for ${corpCode}`, error);
            throw error;
        }
    }

    // ============================================
    // 정기보고서 주요정보 APIs
    // ============================================

    /**
     * 임원 현황 조회
     * reprt_code: 11011(사업보고서), 11012(반기보고서), 11013(1분기), 11014(3분기)
     */
    async getExecutiveStatus(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        const apiKey = await this.getApiKey(userId);
        try {
            const url = `${this.baseUrl}/exctvSttus.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${bizYear}&reprt_code=${reportCode}`;
            const response = await this.fetchJson(url);
            if (response.status !== '000') {
                if (response.status === '013') {
                    return []; // No data found
                }
                throw new Error(`OpenDart API error: ${response.message}`);
            }
            return response.list || [];
        } catch (error) {
            this.logger.error(`Failed to get executive status for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * 사외이사 및 그 변동현황 조회
     */
    async getOutsideDirectors(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        const apiKey = await this.getApiKey(userId);
        try {
            const url = `${this.baseUrl}/outcmpnyDrctrNdChangeSttus.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${bizYear}&reprt_code=${reportCode}`;
            const response = await this.fetchJson(url);
            if (response.status !== '000') {
                if (response.status === '013') {
                    return [];
                }
                throw new Error(`OpenDart API error: ${response.message}`);
            }
            return response.list || [];
        } catch (error) {
            this.logger.error(`Failed to get outside directors for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * 최대주주 현황 조회
     */
    async getMajorShareholders(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        const apiKey = await this.getApiKey(userId);
        try {
            const url = `${this.baseUrl}/hyslrSttus.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${bizYear}&reprt_code=${reportCode}`;
            const response = await this.fetchJson(url);
            if (response.status !== '000') {
                if (response.status === '013') {
                    return [];
                }
                throw new Error(`OpenDart API error: ${response.message}`);
            }
            return response.list || [];
        } catch (error) {
            this.logger.error(`Failed to get major shareholders for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * 배당에 관한 사항 조회
     */
    async getDividendInfo(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        const apiKey = await this.getApiKey(userId);
        try {
            const url = `${this.baseUrl}/alotMatter.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${bizYear}&reprt_code=${reportCode}`;
            const response = await this.fetchJson(url);
            if (response.status !== '000') {
                if (response.status === '013') {
                    return [];
                }
                throw new Error(`OpenDart API error: ${response.message}`);
            }
            return response.list || [];
        } catch (error) {
            this.logger.error(`Failed to get dividend info for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * 대량보유 상황보고 조회
     */
    async getLargeHoldings(corpCode: string, userId?: string) {
        const apiKey = await this.getApiKey(userId);
        try {
            const url = `${this.baseUrl}/majorstock.json?crtfc_key=${apiKey}&corp_code=${corpCode}`;
            const response = await this.fetchJson(url);
            if (response.status !== '000') {
                if (response.status === '013') {
                    return [];
                }
                throw new Error(`OpenDart API error: ${response.message}`);
            }
            return response.list || [];
        } catch (error) {
            this.logger.error(`Failed to get large holdings for ${corpCode}`, error);
            throw error;
        }
    }

    private async fetchJson(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                },
            };

            const getRequest = (currentUrl: string) => {
                const reqUrl = new URL(currentUrl);
                const reqOptions = {
                    ...options,
                    hostname: reqUrl.hostname,
                    path: reqUrl.pathname + reqUrl.search,
                };

                https.get(reqOptions, (res) => {
                    // Handle redirects
                    if (res.statusCode === 301 || res.statusCode === 302) {
                        if (res.headers.location) {
                            this.logger.log(`Following redirect to: ${res.headers.location}`);
                            getRequest(res.headers.location);
                            return;
                        }
                    }

                    if (res.statusCode !== 200) {
                        reject(new Error(`Request failed with status code ${res.statusCode}`));
                        return;
                    }

                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            if (!data) {
                                reject(new Error('Empty response received'));
                                return;
                            }
                            resolve(JSON.parse(data));
                        } catch (error) {
                            this.logger.error(`Failed to parse JSON. Status: ${res.statusCode}, URL: ${currentUrl}`);
                            this.logger.error(`Raw data (first 500 chars): ${data.substring(0, 500)}`);
                            reject(new Error('Failed to parse JSON'));
                        }
                    });
                }).on('error', reject);
            };

            getRequest(url);
        });
    }


    private async fetchXml(url: string): Promise<string> {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/xml, text/xml, */*',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        };

        return new Promise((resolve, reject) => {
            const makeRequest = (targetUrl: string) => {
                const parsedUrl = new URL(targetUrl);
                const options = {
                    hostname: parsedUrl.hostname,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    headers,
                };

                https.get(options, (res) => {
                    this.logger.log(`HTTP Status: ${res.statusCode}`);

                    // Handle redirects (302)
                    if (res.statusCode === 302 || res.statusCode === 301) {
                        const redirectUrl = res.headers.location;
                        this.logger.log(`Following redirect to: ${redirectUrl}`);

                        if (redirectUrl) {
                            makeRequest(redirectUrl);
                            return;
                        }
                    }

                    this.processXmlResponse(res, resolve, reject);
                }).on('error', reject);
            };

            makeRequest(url);
        });
    }


    private processXmlResponse(res: any, resolve: (value: string) => void, reject: (reason?: any) => void): void {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                this.logger.log(`Buffer length: ${buffer.length}`);

                if (buffer.length === 0) {
                    reject(new Error('Empty response'));
                    return;
                }

                // Check for ZIP file (PK header)
                if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
                    this.logger.log('ZIP file detected, extracting...');
                    const zip = new AdmZip(buffer);
                    const entries = zip.getEntries();
                    const xmlEntry = entries.find(e => e.entryName.endsWith('.xml'));

                    if (!xmlEntry) {
                        reject(new Error('No XML in ZIP'));
                        return;
                    }

                    const xmlBuffer = xmlEntry.getData();
                    const xmlString = iconv.decode(xmlBuffer, 'utf-8');
                    this.logger.log(`Extracted XML: ${xmlString.length} chars`);
                    resolve(xmlString);
                } else {
                    const xmlString = iconv.decode(buffer, 'utf-8');
                    resolve(xmlString);
                }
            } catch (error) {
                this.logger.error('XML processing failed', error);
                reject(error);
            }
        });
    }
}
