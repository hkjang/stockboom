/**
 * Trading Controller
 * 트레이딩 관련 API 엔드포인트
 */
import { Controller, Get, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KisApiService } from '../market-data/kis-api.service';
import { prisma } from '@stockboom/database';

@Controller('market-data')
@UseGuards(JwtAuthGuard)
export class TradingController {
    constructor(private kisApiService: KisApiService) {}

    /**
     * 호가 조회
     */
    @Get('orderbook/:symbol')
    async getOrderbook(@Param('symbol') symbol: string, @Request() req) {
        try {
            const orderbook = await this.kisApiService.getOrderbook(symbol, req.user.id);
            return orderbook;
        } catch (error) {
            // 호가 데이터가 없으면 빈 구조 반환
            return {
                symbol,
                timestamp: new Date(),
                asks: [],
                bids: [],
                totalAskQuantity: 0,
                totalBidQuantity: 0,
                currentPrice: 0,
                changeRate: 0,
            };
        }
    }

    /**
     * 실시간 시세 조회
     */
    @Get('quote/:symbol')
    async getQuote(@Param('symbol') symbol: string, @Request() req) {
        try {
            const quote = await this.kisApiService.getQuote(symbol, req.user.id);
            return quote;
        } catch (error) {
            return { error: 'Failed to fetch quote' };
        }
    }

    /**
     * 분봉 데이터 조회
     */
    @Get('candles/:symbol/intraday')
    async getIntradayCandles(
        @Param('symbol') symbol: string,
        @Query('minutes') minutes: string = '1',
        @Request() req,
    ) {
        const min = parseInt(minutes) as 1 | 3 | 5 | 10 | 15 | 30 | 60;
        return this.kisApiService.getIntradayCandles(symbol, min, req.user.id);
    }

    /**
     * 일봉 데이터 조회
     */
    @Get('candles/:symbol/daily')
    async getDailyCandles(
        @Param('symbol') symbol: string,
        @Query('count') count: string = '100',
        @Request() req,
    ) {
        return this.kisApiService.getCandles(symbol, 'D', parseInt(count), req.user.id);
    }

    /**
     * 주봉 데이터 조회
     */
    @Get('candles/:symbol/weekly')
    async getWeeklyCandles(
        @Param('symbol') symbol: string,
        @Query('count') count: string = '52',
        @Request() req,
    ) {
        return this.kisApiService.getWeeklyCandles(symbol, parseInt(count), req.user.id);
    }

    /**
     * 월봉 데이터 조회
     */
    @Get('candles/:symbol/monthly')
    async getMonthlyCandles(
        @Param('symbol') symbol: string,
        @Query('count') count: string = '24',
        @Request() req,
    ) {
        return this.kisApiService.getMonthlyCandles(symbol, parseInt(count), req.user.id);
    }

    /**
     * 체결 내역 (Mock - 실제로는 WebSocket에서 수신)
     */
    @Get('tickers/:symbol')
    async getTickers(
        @Param('symbol') symbol: string,
        @Query('limit') limit: string = '30',
    ) {
        // 실제 구현에서는 Redis나 DB에서 캐싱된 체결 데이터 조회
        // 여기서는 샘플 데이터 반환
        const now = new Date();
        const mockTickers = Array.from({ length: parseInt(limit) }, (_, i) => ({
            time: new Date(now.getTime() - i * 1000).toLocaleTimeString('ko-KR'),
            price: 70000 + Math.floor(Math.random() * 2000) - 1000,
            change: Math.floor(Math.random() * 200) - 100,
            volume: Math.floor(Math.random() * 1000) + 1,
            side: Math.random() > 0.5 ? 'BUY' : 'SELL' as 'BUY' | 'SELL',
        }));

        return mockTickers;
    }
}
