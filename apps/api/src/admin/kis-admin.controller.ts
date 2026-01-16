/**
 * KIS Admin Controller
 * 한국투자증권 API 관리용 엔드포인트
 */
import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { KisApiService } from '../market-data/kis-api.service';
import { KisWebsocketService } from '../market-data/kis-websocket.service';
import { KisSyncService } from '../market-data/kis-sync.service';

@Controller('admin/kis')
@UseGuards(JwtAuthGuard, AdminGuard)
export class KisAdminController {
    constructor(
        private kisApiService: KisApiService,
        private kisWebsocketService: KisWebsocketService,
        private kisSyncService: KisSyncService,
    ) {}

    /**
     * KIS API 연결 상태 확인
     */
    @Get('status')
    async getStatus() {
        const tokenExpiresAt = this.kisApiService.getTokenExpiresAt();
        const wsConnected = this.kisWebsocketService.isWebSocketConnected();
        const subscriptions = Object.fromEntries(this.kisWebsocketService.getSubscriptions());

        return {
            api: {
                tokenValid: tokenExpiresAt ? tokenExpiresAt > new Date() : false,
                tokenExpiresAt,
            },
            websocket: {
                connected: wsConnected,
                subscriptions,
            },
        };
    }

    /**
     * 토큰 강제 갱신
     */
    @Post('refresh-token')
    async refreshToken() {
        try {
            await this.kisApiService.getAccessToken();
            return { success: true, message: '토큰이 갱신되었습니다' };
        } catch (error) {
            return { success: false, message: `토큰 갱신 실패: ${error.message}` };
        }
    }

    /**
     * WebSocket 연결/재연결
     */
    @Post('websocket/connect')
    async connectWebSocket() {
        try {
            await this.kisWebsocketService.connect();
            return { success: true, message: 'WebSocket 연결됨' };
        } catch (error) {
            return { success: false, message: `WebSocket 연결 실패: ${error.message}` };
        }
    }

    /**
     * WebSocket 연결 해제
     */
    @Post('websocket/disconnect')
    disconnectWebSocket() {
        this.kisWebsocketService.disconnect();
        return { success: true, message: 'WebSocket 연결 해제됨' };
    }

    /**
     * 전체 계좌 동기화 트리거
     */
    @Post('sync/all')
    async syncAllAccounts() {
        try {
            await this.kisSyncService.syncAllBrokerAccounts();
            return { success: true, message: '전체 계좌 동기화 완료' };
        } catch (error) {
            return { success: false, message: `동기화 실패: ${error.message}` };
        }
    }

    /**
     * 특정 계좌 동기화
     */
    @Post('sync/:brokerAccountId')
    async syncAccount(@Param('brokerAccountId') brokerAccountId: string, @Request() req) {
        return this.kisSyncService.triggerSync(brokerAccountId, req.user.id);
    }

    /**
     * 시세 조회 테스트
     */
    @Get('test/quote/:symbol')
    async testQuote(@Param('symbol') symbol: string) {
        try {
            const quote = await this.kisApiService.getQuote(symbol);
            return { success: true, data: quote };
        } catch (error) {
            return { success: false, message: `시세 조회 실패: ${error.message}` };
        }
    }

    /**
     * 호가 조회 테스트
     */
    @Get('test/orderbook/:symbol')
    async testOrderbook(@Param('symbol') symbol: string) {
        try {
            const orderbook = await this.kisApiService.getOrderbook(symbol);
            return { success: true, data: orderbook };
        } catch (error) {
            return { success: false, message: `호가 조회 실패: ${error.message}` };
        }
    }

    /**
     * 계좌 잔고 조회 테스트
     */
    @Get('test/balance')
    async testBalance(@Request() req) {
        try {
            const balance = await this.kisApiService.getAccountBalance(req.user.id);
            return { success: true, data: balance };
        } catch (error) {
            return { success: false, message: `잔고 조회 실패: ${error.message}` };
        }
    }
}
