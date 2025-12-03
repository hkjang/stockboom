import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { KISTokenResponse, KISQuote, KISOrderRequest, KISOrderResponse } from '@stockboom/types';
import { UserApiKeysService } from '../user-api-keys/user-api-keys.service';

interface KisCredentials {
    appKey: string;
    appSecret: string;
    accountNumber: string;
    isMockMode: boolean;
}

@Injectable()
export class KisApiService {
    private readonly logger = new Logger(KisApiService.name);
    private readonly baseUrl = 'https://openapi.koreainvestment.com:9443';
    private accessToken: string | null = null;
    private tokenExpiresAt: Date | null = null;

    constructor(
        private httpService: HttpService,
        private configService: ConfigService,
        private userApiKeysService: UserApiKeysService,
    ) { }

    /**
     * Get API credentials with priority: user key > environment variable
     */
    private async getApiCredentials(userId?: string): Promise<KisCredentials> {
        // Try user-specific key first
        if (userId) {
            try {
                const userKeys = await this.userApiKeysService.getKeys(userId, userId, true);
                if (userKeys?.kisAppKey && userKeys?.kisAppSecret) {
                    await this.userApiKeysService.updateLastUsed(userId);
                    return {
                        appKey: userKeys.kisAppKey,
                        appSecret: userKeys.kisAppSecret,
                        accountNumber: userKeys.kisAccountNumber || '',
                        isMockMode: userKeys.kisMockMode,
                    };
                }
            } catch (error) {
                this.logger.warn(`Failed to get user API key for ${userId}, using env credentials`);
            }
        }

        // Fallback to environment variables
        const appKey = this.configService.get('KIS_APP_KEY');
        const appSecret = this.configService.get('KIS_APP_SECRET');

        if (!appKey || !appSecret) {
            throw new Error('KIS API credentials not configured');
        }

        return {
            appKey,
            appSecret,
            accountNumber: this.configService.get('KIS_ACCOUNT_NUMBER') || '',
            isMockMode: this.configService.get('KIS_MOCK_MODE') === 'true',
        };
    }

    /**
     * Get OAuth token from Korean Investment & Securities
     * Automatically refreshes token if it's about to expire
     */
    async getAccessToken(userId?: string): Promise<string> {
        // Check if token needs refresh (expired or expires in < 5 minutes)
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > fiveMinutesFromNow) {
            return this.accessToken;
        }

        // Token expired or about to expire, refresh it
        return this.refreshToken(userId, 0);
    }

    /**
     * Refresh OAuth token with retry mechanism
     */
    private async refreshToken(userId?: string, retryCount: number = 0): Promise<string> {
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 1000; // 1 second

        try {
            const credentials = await this.getApiCredentials(userId);

            this.logger.log('Refreshing KIS access token...');

            const response = await firstValueFrom(
                this.httpService.post<KISTokenResponse>(`${this.baseUrl}/oauth2/tokenP`, {
                    grant_type: 'client_credentials',
                    appkey: credentials.appKey,
                    appsecret: credentials.appSecret,
                }),
            );

            this.accessToken = response.data.access_token;
            // Token typically expires in 24 hours
            this.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);

            this.logger.log(`Successfully refreshed KIS access token. Expires at: ${this.tokenExpiresAt.toISOString()}`);
            return this.accessToken;

        } catch (error) {
            this.logger.error(`Failed to refresh KIS access token (attempt ${retryCount + 1}/${MAX_RETRIES})`, error);

            if (retryCount < MAX_RETRIES - 1) {
                // Wait before retry with exponential backoff
                const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
                this.logger.log(`Retrying token refresh in ${delay}ms...`);
                await this.sleep(delay);
                return this.refreshToken(userId, retryCount + 1);
            }

            // All retries failed
            throw new Error(`Failed to refresh KIS token after ${MAX_RETRIES} attempts`);
        }
    }

    /**
     * Check if token needs renewal and refresh proactively
     */
    async checkAndRenewToken(userId?: string): Promise<void> {
        await this.getAccessToken(userId);
    }

    /**
     * Get token expiration time for monitoring
     */
    getTokenExpiresAt(): Date | null {
        return this.tokenExpiresAt;
    }

    /**
     * Helper function to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current quote for a stock
     */
    async getQuote(symbol: string, userId?: string): Promise<KISQuote> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'authorization': `Bearer ${token}`,
                        'appkey': credentials.appKey,
                        'appsecret': credentials.appSecret,
                        'tr_id': 'FHKST01010100',
                    },
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_INPUT_ISCD: symbol,
                    },
                }),
            );

            const output = response.data.output;

            return {
                symbol,
                name: output.hts_kor_isnm,
                currentPrice: parseFloat(output.stck_prpr),
                changePrice: parseFloat(output.prdy_vrss),
                changeRate: parseFloat(output.prdy_ctrt),
                volume: parseInt(output.acml_vol),
                high: parseFloat(output.stck_hgpr),
                low: parseFloat(output.stck_lwpr),
                open: parseFloat(output.stck_oprc),
                previousClose: parseFloat(output.stck_sdpr),
                timestamp: new Date(),
            };

        } catch (error) {
            this.logger.error(`Failed to get quote for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Place an order
     */
    async placeOrder(orderRequest: KISOrderRequest, userId?: string): Promise<KISOrderResponse> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        // Determine transaction ID based on order type
        const trId = credentials.isMockMode ?
            (orderRequest.side === 'BUY' ? 'VTTC0802U' : 'VTTC0801U') :
            (orderRequest.side === 'BUY' ? 'TTTC0802U' : 'TTTC0801U');

        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/uapi/domestic-stock/v1/trading/order-cash`, {
                    CANO: credentials.accountNumber.substring(0, 8),
                    ACNT_PRDT_CD: credentials.accountNumber.substring(8),
                    PDNO: orderRequest.symbol,
                    ORD_DVSN: orderRequest.orderType === 'MARKET' ? '01' : '00',
                    ORD_QTY: orderRequest.quantity.toString(),
                    ORD_UNPR: orderRequest.price?.toString() || '0',
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'authorization': `Bearer ${token}`,
                        'appkey': credentials.appKey,
                        'appsecret': credentials.appSecret,
                        'tr_id': trId,
                    },
                }),
            );

            return {
                orderId: response.data.output.KRX_FWDG_ORD_ORGNO + response.data.output.ODNO,
                status: response.data.rt_cd === '0' ? 'SUCCESS' : 'FAILED',
                message: response.data.msg1,
            };

        } catch (error) {
            this.logger.error('Failed to place order', error);
            throw error;
        }
    }

    /**
     * Get historical candle data
     */
    async getCandles(symbol: string, timeframe: string, count: number = 100, userId?: string): Promise<any[]> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-price`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'authorization': `Bearer ${token}`,
                        'appkey': credentials.appKey,
                        'appsecret': credentials.appSecret,
                        'tr_id': 'FHKST01010400',
                    },
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_INPUT_ISCD: symbol,
                        FID_PERIOD_DIV_CODE: 'D', // Daily
                        FID_ORG_ADJ_PRC: '0',
                    },
                }),
            );

            return response.data.output.slice(0, count).map((item: any) => ({
                timestamp: new Date(item.stck_bsop_date),
                open: parseFloat(item.stck_oprc),
                high: parseFloat(item.stck_hgpr),
                low: parseFloat(item.stck_lwpr),
                close: parseFloat(item.stck_clpr),
                volume: parseInt(item.acml_vol),
            }));

        } catch (error) {
            this.logger.error(`Failed to get candles for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get portfolio balance and positions
     */
    async getPortfolioData(accountNumber: string, userId?: string): Promise<{
        cashBalance: number;
        positions: Array<{
            symbol: string;
            name: string;
            quantity: number;
            avgPrice: number;
            currentPrice: number;
            market: string;
        }>;
    }> {
        // TODO: Implement actual KIS API call for balance
        // Endpoint: /uapi/domestic-stock/v1/trading/inquire-balance

        // Return mock data for now to fix build
        return {
            cashBalance: 10000000,
            positions: []
        };
    }
}
