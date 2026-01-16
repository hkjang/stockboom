/**
 * KIS WebSocket Service
 * 한국투자증권 실시간 시세/체결 통보 WebSocket 연동
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import { UserApiKeysService } from '../user-api-keys/user-api-keys.service';

// 실시간 데이터 타입
export interface RealTimePrice {
    symbol: string;
    price: number;
    change: number;
    changeRate: number;
    volume: number;
    timestamp: Date;
}

export interface RealTimeOrderbook {
    symbol: string;
    asks: Array<{ price: number; quantity: number }>;
    bids: Array<{ price: number; quantity: number }>;
    timestamp: Date;
}

export interface RealTimeExecution {
    symbol: string;
    orderNumber: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    filledQuantity: number;
    status: string;
    timestamp: Date;
}

@Injectable()
export class KisWebsocketService implements OnModuleDestroy {
    private readonly logger = new Logger(KisWebsocketService.name);
    private ws: WebSocket | null = null;
    private approvalKey: string | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private readonly reconnectInterval = 5000; // 5 seconds
    private subscriptions = new Map<string, Set<string>>(); // trId -> Set<symbol>
    private isConnected = false;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        private eventEmitter: EventEmitter2,
        private userApiKeysService: UserApiKeysService,
    ) { }

    onModuleDestroy() {
        this.disconnect();
    }

    /**
     * WebSocket 접속키 발급
     */
    private async getApprovalKey(userId?: string): Promise<string> {
        if (this.approvalKey) {
            return this.approvalKey;
        }

        const credentials = await this.getCredentials(userId);
        const baseUrl = this.getBaseUrl(credentials.isMockMode);

        try {
            const response = await firstValueFrom(
                this.httpService.post(`${baseUrl}/oauth2/Approval`, {
                    grant_type: 'client_credentials',
                    appkey: credentials.appKey,
                    secretkey: credentials.appSecret,
                }),
            );

            this.approvalKey = response.data.approval_key;
            this.logger.log('KIS WebSocket approval key obtained');
            return this.approvalKey!;
        } catch (error) {
            this.logger.error('Failed to get WebSocket approval key', error);
            throw error;
        }
    }

    private async getCredentials(userId?: string) {
        if (userId) {
            try {
                const userKeys = await this.userApiKeysService.getKeys(userId, userId, true);
                if (userKeys?.kisAppKey && userKeys?.kisAppSecret) {
                    return {
                        appKey: userKeys.kisAppKey,
                        appSecret: userKeys.kisAppSecret,
                        accountNumber: userKeys.kisAccountNumber || '',
                        isMockMode: userKeys.kisMockMode,
                    };
                }
            } catch (error) {
                this.logger.warn(`Failed to get user API key for WebSocket ${userId}`);
            }
        }

        return {
            appKey: this.configService.get('KIS_APP_KEY'),
            appSecret: this.configService.get('KIS_APP_SECRET'),
            accountNumber: this.configService.get('KIS_ACCOUNT_NUMBER') || '',
            isMockMode: this.configService.get('KIS_MOCK_MODE') === 'true',
        };
    }

    private getBaseUrl(isMockMode: boolean): string {
        return isMockMode
            ? 'https://openapivts.koreainvestment.com:29443'
            : 'https://openapi.koreainvestment.com:9443';
    }

    private getWebSocketUrl(isMockMode: boolean): string {
        return isMockMode
            ? 'ws://ops.koreainvestment.com:31000'
            : 'ws://ops.koreainvestment.com:21000';
    }

    /**
     * WebSocket 연결
     */
    async connect(userId?: string): Promise<void> {
        if (this.isConnected) {
            this.logger.warn('WebSocket already connected');
            return;
        }

        try {
            const credentials = await this.getCredentials(userId);
            const approvalKey = await this.getApprovalKey(userId);
            const wsUrl = this.getWebSocketUrl(credentials.isMockMode);

            this.ws = new WebSocket(wsUrl);

            this.ws!.on('open', () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.logger.log('KIS WebSocket connected');
                
                // Heartbeat 시작
                this.startHeartbeat();

                // 기존 구독 복원
                this.restoreSubscriptions();
                
                this.eventEmitter.emit('kis.websocket.connected');
            });

            this.ws!.on('message', (data: Buffer) => {
                this.handleMessage(data.toString());
            });

            this.ws!.on('error', (error) => {
                this.logger.error('KIS WebSocket error', error);
                this.eventEmitter.emit('kis.websocket.error', error);
            });

            this.ws!.on('close', () => {
                this.isConnected = false;
                this.stopHeartbeat();
                this.logger.warn('KIS WebSocket disconnected');
                this.eventEmitter.emit('kis.websocket.disconnected');

                // 자동 재연결
                this.attemptReconnect(userId);
            });

        } catch (error) {
            this.logger.error('Failed to connect KIS WebSocket', error);
            throw error;
        }
    }

    /**
     * 자동 재연결
     */
    private attemptReconnect(userId?: string): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        this.logger.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

        setTimeout(() => {
            this.connect(userId);
        }, this.reconnectInterval * this.reconnectAttempts);
    }

    /**
     * 연결 해제
     */
    disconnect(): void {
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.approvalKey = null;
        this.subscriptions.clear();
    }

    /**
     * Heartbeat 관리
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.isConnected) {
                this.ws.ping();
            }
        }, 30000); // 30초마다
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval as NodeJS.Timeout);
            this.heartbeatInterval = null;
        }
    }

    /**
     * 메시지 처리
     */
    private handleMessage(data: string): void {
        try {
            // 암호화된 메시지인지 확인
            if (data.startsWith('0|') || data.startsWith('1|')) {
                this.handleRealTimeData(data);
            } else {
                // JSON 응답 (구독 응답 등)
                const message = JSON.parse(data);
                this.handleJsonMessage(message);
            }
        } catch (error) {
            this.logger.error('Failed to handle WebSocket message', error);
        }
    }

    /**
     * 실시간 데이터 파싱
     */
    private handleRealTimeData(data: string): void {
        const [encrypted, trIdStr, countStr, ...bodyParts] = data.split('|');
        const trId = trIdStr;
        const body = bodyParts.join('|');

        switch (trId) {
            case 'H0STCNT0': // 실시간 체결가
                this.parseRealTimePrice(body);
                break;
            case 'H0STASP0': // 실시간 호가
                this.parseRealTimeOrderbook(body);
                break;
            case 'H0STCNI0': // 체결 통보
            case 'H0STCNI9': // 체결 통보 (모의)
                this.parseRealTimeExecution(body);
                break;
            default:
                this.logger.debug(`Unhandled TR ID: ${trId}`);
        }
    }

    /**
     * 실시간 체결가 파싱 (H0STCNT0)
     */
    private parseRealTimePrice(body: string): void {
        const fields = body.split('^');
        if (fields.length < 20) return;

        const price: RealTimePrice = {
            symbol: fields[0],
            price: parseFloat(fields[2]) || 0,
            change: parseFloat(fields[4]) || 0,
            changeRate: parseFloat(fields[5]) || 0,
            volume: parseInt(fields[12]) || 0,
            timestamp: new Date(),
        };

        this.eventEmitter.emit('kis.realtime.price', price);
    }

    /**
     * 실시간 호가 파싱 (H0STASP0)
     */
    private parseRealTimeOrderbook(body: string): void {
        const fields = body.split('^');
        if (fields.length < 40) return;

        const symbol = fields[0];
        const asks: Array<{ price: number; quantity: number }> = [];
        const bids: Array<{ price: number; quantity: number }> = [];

        // 매도호가 1~10
        for (let i = 0; i < 10; i++) {
            asks.push({
                price: parseFloat(fields[3 + i * 2]) || 0,
                quantity: parseInt(fields[23 + i]) || 0,
            });
        }

        // 매수호가 1~10
        for (let i = 0; i < 10; i++) {
            bids.push({
                price: parseFloat(fields[13 + i * 2]) || 0,
                quantity: parseInt(fields[33 + i]) || 0,
            });
        }

        const orderbook: RealTimeOrderbook = {
            symbol,
            asks: asks.filter(a => a.price > 0),
            bids: bids.filter(b => b.price > 0),
            timestamp: new Date(),
        };

        this.eventEmitter.emit('kis.realtime.orderbook', orderbook);
    }

    /**
     * 체결 통보 파싱 (H0STCNI0/H0STCNI9)
     */
    private parseRealTimeExecution(body: string): void {
        const fields = body.split('^');
        if (fields.length < 20) return;

        const execution: RealTimeExecution = {
            symbol: fields[8],
            orderNumber: fields[1],
            side: fields[4] === '01' ? 'SELL' : 'BUY',
            quantity: parseInt(fields[12]) || 0,
            price: parseFloat(fields[13]) || 0,
            filledQuantity: parseInt(fields[14]) || 0,
            status: fields[3],
            timestamp: new Date(),
        };

        this.eventEmitter.emit('kis.realtime.execution', execution);
    }

    /**
     * JSON 메시지 처리 (구독 응답 등)
     */
    private handleJsonMessage(message: any): void {
        if (message.header?.tr_id) {
            this.logger.debug(`Received response for TR: ${message.header.tr_id}`);
        }

        if (message.body?.rt_cd === '0') {
            this.logger.log(`Subscription successful: ${message.body.msg1}`);
        } else if (message.body?.rt_cd) {
            this.logger.warn(`Subscription response: ${message.body.msg1}`);
        }
    }

    /**
     * 실시간 체결가 구독
     */
    async subscribePrice(symbol: string): Promise<void> {
        await this.subscribe('H0STCNT0', symbol);
    }

    /**
     * 실시간 호가 구독
     */
    async subscribeOrderbook(symbol: string): Promise<void> {
        await this.subscribe('H0STASP0', symbol);
    }

    /**
     * 체결 통보 구독
     */
    async subscribeExecution(userId?: string): Promise<void> {
        const credentials = await this.getCredentials(userId);
        const trId = credentials.isMockMode ? 'H0STCNI9' : 'H0STCNI0';
        const htsId = credentials.accountNumber.substring(0, 8);
        await this.subscribe(trId, htsId);
    }

    /**
     * 구독 요청
     */
    private async subscribe(trId: string, key: string): Promise<void> {
        if (!this.isConnected || !this.ws) {
            throw new Error('WebSocket not connected');
        }

        const approvalKey = await this.getApprovalKey();

        const request = {
            header: {
                approval_key: approvalKey,
                custtype: 'P',
                tr_type: '1', // 1: 등록
                'content-type': 'utf-8',
            },
            body: {
                input: {
                    tr_id: trId,
                    tr_key: key,
                },
            },
        };

        this.ws.send(JSON.stringify(request));

        // 구독 목록에 추가
        if (!this.subscriptions.has(trId)) {
            this.subscriptions.set(trId, new Set());
        }
        this.subscriptions.get(trId)!.add(key);

        this.logger.log(`Subscribed to ${trId}: ${key}`);
    }

    /**
     * 구독 해제
     */
    async unsubscribe(trId: string, key: string): Promise<void> {
        if (!this.isConnected || !this.ws) {
            return;
        }

        const approvalKey = await this.getApprovalKey();

        const request = {
            header: {
                approval_key: approvalKey,
                custtype: 'P',
                tr_type: '2', // 2: 해제
                'content-type': 'utf-8',
            },
            body: {
                input: {
                    tr_id: trId,
                    tr_key: key,
                },
            },
        };

        this.ws.send(JSON.stringify(request));

        // 구독 목록에서 제거
        this.subscriptions.get(trId)?.delete(key);

        this.logger.log(`Unsubscribed from ${trId}: ${key}`);
    }

    /**
     * 기존 구독 복원 (재연결 시)
     */
    private restoreSubscriptions(): void {
        for (const [trId, keys] of this.subscriptions) {
            for (const key of keys) {
                this.subscribe(trId, key).catch(err => {
                    this.logger.error(`Failed to restore subscription ${trId}:${key}`, err);
                });
            }
        }
    }

    /**
     * 연결 상태 확인
     */
    isWebSocketConnected(): boolean {
        return this.isConnected;
    }

    /**
     * 현재 구독 목록
     */
    getSubscriptions(): Map<string, string[]> {
        const result = new Map<string, string[]>();
        for (const [trId, keys] of this.subscriptions) {
            result.set(trId, Array.from(keys));
        }
        return result;
    }
}
