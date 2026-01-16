import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { KISTokenResponse, KISQuote, KISOrderRequest, KISOrderResponse } from '@stockboom/types';
import { UserApiKeysService } from '../user-api-keys/user-api-keys.service';
import {
    KISAccountBalanceResponse,
    KISOrderbookResponse,
    KISOrderHistoryResponse,
    KISIntradayCandleResponse,
    KISModifyOrderResponse,
    AccountBalance,
    Holding,
    Orderbook,
    OrderHistoryItem,
    IntradayCandle,
} from './kis-api.types';

interface KisCredentials {
    appKey: string;
    appSecret: string;
    accountNumber: string;
    isMockMode: boolean;
}

@Injectable()
export class KisApiService {
    private readonly logger = new Logger(KisApiService.name);
    // private readonly baseUrl = 'https://openapi.koreainvestment.com:9443'; // Removed hardcoded URL
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

    private getBaseUrl(isMockMode: boolean): string {
        return isMockMode
            ? 'https://openapivts.koreainvestment.com:29443'
            : 'https://openapi.koreainvestment.com:9443';
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

            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.post<KISTokenResponse>(`${baseUrl}/oauth2/tokenP`, {
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
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.get(`${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`, {
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
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.post(`${baseUrl}/uapi/domestic-stock/v1/trading/order-cash`, {
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
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.get(`${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-price`, {
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
     * Get portfolio balance and positions from KIS API
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
        const balance = await this.getAccountBalance(userId);
        const holdings = await this.getHoldings(userId);

        return {
            cashBalance: balance.cashBalance,
            positions: holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                quantity: h.quantity,
                avgPrice: h.avgPrice,
                currentPrice: h.currentPrice,
                market: 'KOSPI', // Default, should be fetched from stock info
            })),
        };
    }

    /**
     * Get account balance (예수금 조회)
     * 실전: TTTC8908R / 모의: VTTC8434R
     */
    async getAccountBalance(userId?: string): Promise<AccountBalance> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        const trId = credentials.isMockMode ? 'VTTC8434R' : 'TTTC8908R';

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.get<KISAccountBalanceResponse>(
                    `${baseUrl}/uapi/domestic-stock/v1/trading/inquire-balance`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'authorization': `Bearer ${token}`,
                            'appkey': credentials.appKey,
                            'appsecret': credentials.appSecret,
                            'tr_id': trId,
                        },
                        params: {
                            CANO: credentials.accountNumber.substring(0, 8),
                            ACNT_PRDT_CD: credentials.accountNumber.substring(8, 10),
                            AFHR_FLPR_YN: 'N',
                            OFL_YN: '',
                            INQR_DVSN: '02',
                            UNPR_DVSN: '01',
                            FUND_STTL_ICLD_YN: 'N',
                            FNCG_AMT_AUTO_RDPT_YN: 'N',
                            PRCS_DVSN: '00',
                            CTX_AREA_FK100: '',
                            CTX_AREA_NK100: '',
                        },
                    },
                ),
            );

            const output1 = response.data.output1?.[0];
            if (!output1) {
                return {
                    cashBalance: 0,
                    totalDeposit: 0,
                    totalEvaluation: 0,
                    totalPurchase: 0,
                    totalProfitLoss: 0,
                    profitLossRate: 0,
                };
            }

            return {
                cashBalance: parseFloat(output1.dnca_tot_amt) || 0,
                totalDeposit: parseFloat(output1.tot_evlu_amt) || 0,
                totalEvaluation: parseFloat(output1.scts_evlu_amt) || 0,
                totalPurchase: parseFloat(output1.pchs_amt_smtl_amt) || 0,
                totalProfitLoss: parseFloat(output1.evlu_pfls_smtl_amt) || 0,
                profitLossRate: parseFloat(output1.asst_icdc_erng_rt) || 0,
            };
        } catch (error) {
            this.logger.error('Failed to get account balance', error);
            throw error;
        }
    }

    /**
     * Get holdings (보유 종목 조회)
     */
    async getHoldings(userId?: string): Promise<Holding[]> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        const trId = credentials.isMockMode ? 'VTTC8434R' : 'TTTC8908R';

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.get<KISAccountBalanceResponse>(
                    `${baseUrl}/uapi/domestic-stock/v1/trading/inquire-balance`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'authorization': `Bearer ${token}`,
                            'appkey': credentials.appKey,
                            'appsecret': credentials.appSecret,
                            'tr_id': trId,
                        },
                        params: {
                            CANO: credentials.accountNumber.substring(0, 8),
                            ACNT_PRDT_CD: credentials.accountNumber.substring(8, 10),
                            AFHR_FLPR_YN: 'N',
                            OFL_YN: '',
                            INQR_DVSN: '02',
                            UNPR_DVSN: '01',
                            FUND_STTL_ICLD_YN: 'N',
                            FNCG_AMT_AUTO_RDPT_YN: 'N',
                            PRCS_DVSN: '00',
                            CTX_AREA_FK100: '',
                            CTX_AREA_NK100: '',
                        },
                    },
                ),
            );

            const output2 = response.data.output2 || [];

            return output2.map(item => ({
                symbol: item.pdno,
                name: item.prdt_name,
                quantity: parseInt(item.hldg_qty) || 0,
                availableQuantity: parseInt(item.ord_psbl_qty) || 0,
                avgPrice: parseFloat(item.pchs_avg_pric) || 0,
                currentPrice: parseFloat(item.prpr) || 0,
                purchaseAmount: parseFloat(item.pchs_amt) || 0,
                evaluationAmount: parseFloat(item.evlu_amt) || 0,
                profitLoss: parseFloat(item.evlu_pfls_amt) || 0,
                profitLossRate: parseFloat(item.evlu_pfls_rt) || 0,
                changeRate: parseFloat(item.fltt_rt) || 0,
            }));
        } catch (error) {
            this.logger.error('Failed to get holdings', error);
            throw error;
        }
    }

    /**
     * Get orderbook (호가 조회)
     * TR ID: FHKST01010200
     */
    async getOrderbook(symbol: string, userId?: string): Promise<Orderbook> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.get<KISOrderbookResponse>(
                    `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'authorization': `Bearer ${token}`,
                            'appkey': credentials.appKey,
                            'appsecret': credentials.appSecret,
                            'tr_id': 'FHKST01010200',
                        },
                        params: {
                            FID_COND_MRKT_DIV_CODE: 'J',
                            FID_INPUT_ISCD: symbol,
                        },
                    },
                ),
            );

            const output1 = response.data.output1;
            const output2 = response.data.output2;

            // Build asks array (sell orders) - ascending price
            const asks: Array<{ price: number; quantity: number }> = [];
            for (let i = 1; i <= 10; i++) {
                const price = parseFloat(output1[`askp${i}`]) || 0;
                const quantity = parseInt(output1[`askp_rsqn${i}`]) || 0;
                if (price > 0) {
                    asks.push({ price, quantity });
                }
            }

            // Build bids array (buy orders) - descending price
            const bids: Array<{ price: number; quantity: number }> = [];
            for (let i = 1; i <= 10; i++) {
                const price = parseFloat(output1[`bidp${i}`]) || 0;
                const quantity = parseInt(output1[`bidp_rsqn${i}`]) || 0;
                if (price > 0) {
                    bids.push({ price, quantity });
                }
            }

            return {
                symbol,
                timestamp: new Date(),
                asks: asks.sort((a, b) => a.price - b.price),
                bids: bids.sort((a, b) => b.price - a.price),
                totalAskQuantity: parseInt(output1.total_askp_rsqn) || 0,
                totalBidQuantity: parseInt(output1.total_bidp_rsqn) || 0,
                currentPrice: parseFloat(output2.stck_prpr) || 0,
                changeRate: parseFloat(output2.prdy_ctrt) || 0,
            };
        } catch (error) {
            this.logger.error(`Failed to get orderbook for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get order history (체결/미체결 내역 조회)
     * 실전: TTTC8001R / 모의: VTTC8001R
     */
    async getOrderHistory(
        userId?: string,
        options?: {
            startDate?: string;  // YYYYMMDD
            endDate?: string;    // YYYYMMDD
            onlyUnfilled?: boolean;
        },
    ): Promise<OrderHistoryItem[]> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        const trId = credentials.isMockMode ? 'VTTC8001R' : 'TTTC8001R';
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.get<KISOrderHistoryResponse>(
                    `${baseUrl}/uapi/domestic-stock/v1/trading/inquire-daily-ccld`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'authorization': `Bearer ${token}`,
                            'appkey': credentials.appKey,
                            'appsecret': credentials.appSecret,
                            'tr_id': trId,
                        },
                        params: {
                            CANO: credentials.accountNumber.substring(0, 8),
                            ACNT_PRDT_CD: credentials.accountNumber.substring(8, 10),
                            INQR_STRT_DT: options?.startDate || today,
                            INQR_END_DT: options?.endDate || today,
                            SLL_BUY_DVSN_CD: '00',
                            INQR_DVSN: '00',
                            PDNO: '',
                            CCLD_DVSN: options?.onlyUnfilled ? '01' : '00',
                            ORD_GNO_BRNO: '',
                            ODNO: '',
                            INQR_DVSN_3: '00',
                            INQR_DVSN_1: '',
                            CTX_AREA_FK100: '',
                            CTX_AREA_NK100: '',
                        },
                    },
                ),
            );

            const output = response.data.output || [];

            return output.map(item => ({
                orderDate: item.ord_dt,
                orderNumber: item.odno,
                originalOrderNumber: item.orgn_odno,
                symbol: item.pdno,
                name: item.prdt_name,
                orderType: item.ord_dvsn_name,
                side: item.sll_buy_dvsn_cd === '01' ? 'SELL' as const : 'BUY' as const,
                orderQuantity: parseInt(item.ord_qty) || 0,
                orderPrice: parseFloat(item.ord_unpr) || 0,
                filledQuantity: parseInt(item.tot_ccld_qty) || 0,
                remainingQuantity: parseInt(item.rmn_qty) || 0,
                avgPrice: parseFloat(item.avg_prvs) || 0,
                totalAmount: parseFloat(item.tot_ccld_amt) || 0,
                isCancelled: item.cncl_yn === 'Y',
                orderTime: item.ord_tmd,
            }));
        } catch (error) {
            this.logger.error('Failed to get order history', error);
            throw error;
        }
    }

    /**
     * Modify order (주문 정정)
     * 실전: TTTC0803U / 모의: VTTC0803U
     */
    async modifyOrder(
        orderNumber: string,
        newQuantity: number,
        newPrice: number,
        userId?: string,
    ): Promise<KISModifyOrderResponse> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        const trId = credentials.isMockMode ? 'VTTC0803U' : 'TTTC0803U';

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.post<KISModifyOrderResponse>(
                    `${baseUrl}/uapi/domestic-stock/v1/trading/order-rvsecncl`,
                    {
                        CANO: credentials.accountNumber.substring(0, 8),
                        ACNT_PRDT_CD: credentials.accountNumber.substring(8, 10),
                        KRX_FWDG_ORD_ORGNO: '',
                        ORGN_ODNO: orderNumber,
                        ORD_DVSN: '00',
                        RVSE_CNCL_DVSN_CD: '01', // 01: 정정
                        ORD_QTY: newQuantity.toString(),
                        ORD_UNPR: newPrice.toString(),
                        QTY_ALL_ORD_YN: 'N',
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'authorization': `Bearer ${token}`,
                            'appkey': credentials.appKey,
                            'appsecret': credentials.appSecret,
                            'tr_id': trId,
                        },
                    },
                ),
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to modify order ${orderNumber}`, error);
            throw error;
        }
    }

    /**
     * Cancel order (주문 취소)
     * 실전: TTTC0803U / 모의: VTTC0803U
     */
    async cancelOrder(
        orderNumber: string,
        quantity: number,
        userId?: string,
    ): Promise<KISModifyOrderResponse> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        const trId = credentials.isMockMode ? 'VTTC0803U' : 'TTTC0803U';

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.post<KISModifyOrderResponse>(
                    `${baseUrl}/uapi/domestic-stock/v1/trading/order-rvsecncl`,
                    {
                        CANO: credentials.accountNumber.substring(0, 8),
                        ACNT_PRDT_CD: credentials.accountNumber.substring(8, 10),
                        KRX_FWDG_ORD_ORGNO: '',
                        ORGN_ODNO: orderNumber,
                        ORD_DVSN: '00',
                        RVSE_CNCL_DVSN_CD: '02', // 02: 취소
                        ORD_QTY: quantity.toString(),
                        ORD_UNPR: '0',
                        QTY_ALL_ORD_YN: 'Y',
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'authorization': `Bearer ${token}`,
                            'appkey': credentials.appKey,
                            'appsecret': credentials.appSecret,
                            'tr_id': trId,
                        },
                    },
                ),
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to cancel order ${orderNumber}`, error);
            throw error;
        }
    }

    /**
     * Get intraday candles (분봉 데이터)
     * TR ID: FHKST03010200
     */
    async getIntradayCandles(
        symbol: string,
        minutes: 1 | 3 | 5 | 10 | 15 | 30 | 60 = 1,
        userId?: string,
    ): Promise<IntradayCandle[]> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const now = new Date();
            const endTime = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}00`;

            const response = await firstValueFrom(
                this.httpService.get<KISIntradayCandleResponse>(
                    `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'authorization': `Bearer ${token}`,
                            'appkey': credentials.appKey,
                            'appsecret': credentials.appSecret,
                            'tr_id': 'FHKST03010200',
                        },
                        params: {
                            FID_ETC_CLS_CODE: '',
                            FID_COND_MRKT_DIV_CODE: 'J',
                            FID_INPUT_ISCD: symbol,
                            FID_INPUT_HOUR_1: endTime,
                            FID_PW_DATA_INCU_YN: 'Y',
                        },
                    },
                ),
            );

            const output2 = response.data.output2 || [];

            return output2.map(item => {
                const dateStr = item.stck_bsop_date;
                const timeStr = item.stck_cntg_hour;
                const timestamp = new Date(
                    parseInt(dateStr.substring(0, 4)),
                    parseInt(dateStr.substring(4, 6)) - 1,
                    parseInt(dateStr.substring(6, 8)),
                    parseInt(timeStr.substring(0, 2)),
                    parseInt(timeStr.substring(2, 4)),
                    parseInt(timeStr.substring(4, 6)),
                );

                return {
                    timestamp,
                    open: parseFloat(item.stck_oprc) || 0,
                    high: parseFloat(item.stck_hgpr) || 0,
                    low: parseFloat(item.stck_lwpr) || 0,
                    close: parseFloat(item.stck_prpr) || 0,
                    volume: parseInt(item.cntg_vol) || 0,
                    accumulatedVolume: parseInt(item.acml_vol) || 0,
                };
            });
        } catch (error) {
            this.logger.error(`Failed to get intraday candles for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get weekly candles (주봉 데이터)
     * TR ID: FHKST03010100
     */
    async getWeeklyCandles(symbol: string, count: number = 52, userId?: string): Promise<any[]> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.get(`${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'authorization': `Bearer ${token}`,
                        'appkey': credentials.appKey,
                        'appsecret': credentials.appSecret,
                        'tr_id': 'FHKST03010100',
                    },
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_INPUT_ISCD: symbol,
                        FID_INPUT_DATE_1: '',
                        FID_INPUT_DATE_2: '',
                        FID_PERIOD_DIV_CODE: 'W', // W: 주봉
                        FID_ORG_ADJ_PRC: '0',
                    },
                }),
            );

            return response.data.output2?.slice(0, count).map((item: any) => ({
                timestamp: new Date(
                    parseInt(item.stck_bsop_date.substring(0, 4)),
                    parseInt(item.stck_bsop_date.substring(4, 6)) - 1,
                    parseInt(item.stck_bsop_date.substring(6, 8)),
                ),
                open: parseFloat(item.stck_oprc),
                high: parseFloat(item.stck_hgpr),
                low: parseFloat(item.stck_lwpr),
                close: parseFloat(item.stck_clpr),
                volume: parseInt(item.acml_vol),
            })) || [];
        } catch (error) {
            this.logger.error(`Failed to get weekly candles for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get monthly candles (월봉 데이터)
     */
    async getMonthlyCandles(symbol: string, count: number = 24, userId?: string): Promise<any[]> {
        const token = await this.getAccessToken(userId);
        const credentials = await this.getApiCredentials(userId);

        try {
            const baseUrl = this.getBaseUrl(credentials.isMockMode);
            const response = await firstValueFrom(
                this.httpService.get(`${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'authorization': `Bearer ${token}`,
                        'appkey': credentials.appKey,
                        'appsecret': credentials.appSecret,
                        'tr_id': 'FHKST03010100',
                    },
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_INPUT_ISCD: symbol,
                        FID_INPUT_DATE_1: '',
                        FID_INPUT_DATE_2: '',
                        FID_PERIOD_DIV_CODE: 'M', // M: 월봉
                        FID_ORG_ADJ_PRC: '0',
                    },
                }),
            );

            return response.data.output2?.slice(0, count).map((item: any) => ({
                timestamp: new Date(
                    parseInt(item.stck_bsop_date.substring(0, 4)),
                    parseInt(item.stck_bsop_date.substring(4, 6)) - 1,
                    parseInt(item.stck_bsop_date.substring(6, 8)),
                ),
                open: parseFloat(item.stck_oprc),
                high: parseFloat(item.stck_hgpr),
                low: parseFloat(item.stck_lwpr),
                close: parseFloat(item.stck_clpr),
                volume: parseInt(item.acml_vol),
            })) || [];
        } catch (error) {
            this.logger.error(`Failed to get monthly candles for ${symbol}`, error);
            throw error;
        }
    }
}

