import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { parseStringPromise } from 'xml2js';
import * as iconv from 'iconv-lite';
import { UserApiKeysService } from '../user-api-keys/user-api-keys.service';

/**
 * OpenDart API Service
 * https://opendart.fss.or.kr/
 */
@Injectable()
export class OpenDartService {
    private readonly logger = new Logger(OpenDartService.name);
    private readonly baseUrl = 'https://opendart.fss.or.kr/api';

    constructor(
        private configService: ConfigService,
        private userApiKeysService: UserApiKeysService,
    ) { }

    /**
     * Get API key with priority: user key > environment variable
     */
    private async getApiKey(userId?: string): Promise<string> {
        // Try user-specific key first
        if (userId) {
            try {
                const userKeys = await this.userApiKeysService.getKeys(userId, userId, true);
                if (userKeys?.openDartApiKey) {
                    await this.userApiKeysService.updateLastUsed(userId);
                    return userKeys.openDartApiKey;
                }
            } catch (error) {
                this.logger.warn(`Failed to get user API key for ${userId}, using env key`);
            }
        }

        // Fallback to environment variable
        const envKey = this.configService.get<string>('OPENDART_API_KEY') || '';
        if (!envKey) {
            throw new Error('OpenDart API key not configured');
        }
        return envKey;
    }

    /**
     * Get company overview information
     * @param corpCode OpenDart corporation code
     * @param userId Optional user ID for user-specific API key
     */
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

    /**
     * Download corporation code list (XML format)
     * Returns a map of corporation names to corp codes
     * @param userId Optional user ID for user-specific API key
     */
    async getCorpCodeList(userId?: string): Promise<Map<string, string>> {
        const apiKey = await this.getApiKey(userId);

        try {
            const url = `${this.baseUrl}/corpCode.xml?crtfc_key=${apiKey}`;
            const xmlData = await this.fetchXml(url);

            // Parse XML to get corp list
            const parsed = await parseStringPromise(xmlData);
            const corpList = parsed.result.list[0].list || [];

            const corpCodeMap = new Map<string, string>();

            for (const corp of corpList) {
                const corpName = corp.corp_name?.[0];
                const corpCode = corp.corp_code?.[0];
                const stockCode = corp.stock_code?.[0];

                if (corpName && corpCode) {
                    corpCodeMap.set(corpName, corpCode);
                    // Also map by stock code if available
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

    /**
     * Search for corporation code by name or stock code
     * @param query Company name or stock code
     * @param userId Optional user ID for user-specific API key
     */
    async searchCorpCode(query: string, userId?: string): Promise<string | null> {
        try {
            const corpCodeMap = await this.getCorpCodeList(userId);
            return corpCodeMap.get(query) || null;
        } catch (error) {
            this.logger.error(`Failed to search corp code for ${query}`, error);
            return null;
        }
    }

    /**
     * Fetch JSON data from OpenDart API
     */
    private async fetchJson(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error('Failed to parse JSON response'));
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Fetch XML data from OpenDart API (with EUC-KR encoding)
     */
    private async fetchXml(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    // OpenDart XML is encoded in EUC-KR
                    const xmlString = iconv.decode(buffer, 'euc-kr');
                    resolve(xmlString);
                });
            }).on('error', reject);
        });
    }
}
