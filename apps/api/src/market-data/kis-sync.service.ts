/**
 * KIS Sync Service
 * 한국투자증권 계좌 데이터 동기화 서비스
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@stockboom/database';
import { KisApiService } from './kis-api.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class KisSyncService implements OnModuleInit {
    private readonly logger = new Logger(KisSyncService.name);
    private isSyncing = false;

    constructor(
        private kisApiService: KisApiService,
        private eventEmitter: EventEmitter2,
    ) {}

    async onModuleInit() {
        this.logger.log('KIS Sync Service initialized');
    }

    /**
     * 장중 매 5분마다 보유 종목 동기화 (09:05 ~ 15:25)
     */
    @Cron('*/5 9-14 * * 1-5')
    async syncDuringMarketHours() {
        await this.syncAllBrokerAccounts();
    }

    /**
     * 장 마감 후 최종 동기화 (15:35)
     */
    @Cron('35 15 * * 1-5')
    async syncAfterMarketClose() {
        await this.syncAllBrokerAccounts();
    }

    /**
     * 모든 활성 브로커 계좌 동기화
     */
    async syncAllBrokerAccounts(): Promise<void> {
        if (this.isSyncing) {
            this.logger.warn('Sync already in progress, skipping');
            return;
        }

        this.isSyncing = true;

        try {
            const accounts = await prisma.brokerAccount.findMany({
                where: {
                    isActive: true,
                    broker: 'kis',
                },
                include: {
                    user: true,
                },
            });

            this.logger.log(`Syncing ${accounts.length} broker accounts`);

            for (const account of accounts) {
                try {
                    await this.syncBrokerAccount(account.id, account.userId);
                } catch (error) {
                    this.logger.error(`Failed to sync account ${account.id}`, error);
                }
            }

        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * 특정 브로커 계좌 동기화
     */
    async syncBrokerAccount(brokerAccountId: string, userId: string): Promise<void> {
        this.logger.log(`Syncing broker account ${brokerAccountId}`);

        try {
            // 계좌 정보 조회
            const [balance, holdings] = await Promise.all([
                this.kisApiService.getAccountBalance(userId),
                this.kisApiService.getHoldings(userId),
            ]);

            // 포트폴리오 찾기 또는 생성
            let portfolio = await prisma.portfolio.findFirst({
                where: { brokerAccountId },
            });

            if (!portfolio) {
                portfolio = await prisma.portfolio.create({
                    data: {
                        userId,
                        brokerAccountId,
                        name: 'KIS 연동 포트폴리오',
                        cashBalance: balance.cashBalance,
                        totalValue: balance.totalEvaluation,
                        totalReturn: balance.totalProfitLoss,
                        totalReturnPct: balance.profitLossRate,
                    },
                });
            } else {
                // 포트폴리오 업데이트
                await prisma.portfolio.update({
                    where: { id: portfolio.id },
                    data: {
                        cashBalance: balance.cashBalance,
                        totalValue: balance.totalEvaluation,
                        totalReturn: balance.totalProfitLoss,
                        totalReturnPct: balance.profitLossRate,
                        lastSyncedAt: new Date(),
                    },
                });
            }

            // 보유 종목 동기화
            await this.syncPositions(portfolio.id, holdings);

            // 브로커 계좌 마지막 동기화 시간 업데이트
            await prisma.brokerAccount.update({
                where: { id: brokerAccountId },
                data: { lastSyncedAt: new Date() },
            });

            // 이벤트 발행
            this.eventEmitter.emit('portfolio.synced', {
                portfolioId: portfolio.id,
                userId,
                balance,
                holdings,
            });

            this.logger.log(`Synced account ${brokerAccountId}: ${holdings.length} positions`);

        } catch (error) {
            this.logger.error(`Failed to sync broker account ${brokerAccountId}`, error);
            throw error;
        }
    }

    /**
     * 보유 종목 동기화
     */
    private async syncPositions(portfolioId: string, holdings: any[]): Promise<void> {
        // 기존 포지션 조회
        const existingPositions = await prisma.position.findMany({
            where: { portfolioId },
            include: { stock: true },
        });

        const existingSymbols = new Set(existingPositions.map(p => p.stock.symbol));
        const newSymbols = new Set(holdings.map(h => h.symbol));

        // 청산된 포지션 삭제
        for (const position of existingPositions) {
            if (!newSymbols.has(position.stock.symbol)) {
                await prisma.position.delete({
                    where: { id: position.id },
                });
                this.logger.log(`Removed position: ${position.stock.symbol}`);
            }
        }

        // 포지션 업데이트 또는 생성
        for (const holding of holdings) {
            // 주식 정보 조회/생성
            let stock = await prisma.stock.findUnique({
                where: { symbol: holding.symbol },
            });

            if (!stock) {
                stock = await prisma.stock.create({
                    data: {
                        symbol: holding.symbol,
                        name: holding.name,
                        market: 'KOSPI', // Default, should be determined
                        currentPrice: holding.currentPrice,
                        isActive: true,
                        isTradable: true,
                    },
                });
            } else {
                // 현재가 업데이트
                await prisma.stock.update({
                    where: { id: stock.id },
                    data: {
                        currentPrice: holding.currentPrice,
                        lastPriceUpdate: new Date(),
                    },
                });
            }

            // 포지션 업데이트 또는 생성
            const existingPosition = existingPositions.find(p => p.stock.symbol === holding.symbol);

            if (existingPosition) {
                await prisma.position.update({
                    where: { id: existingPosition.id },
                    data: {
                        quantity: holding.quantity,
                        avgPrice: holding.avgPrice,
                        currentPrice: holding.currentPrice,
                        totalCost: holding.purchaseAmount,
                        marketValue: holding.evaluationAmount,
                        unrealizedPL: holding.profitLoss,
                        unrealizedPLPct: holding.profitLossRate,
                    },
                });
            } else {
                await prisma.position.create({
                    data: {
                        portfolioId,
                        stockId: stock.id,
                        quantity: holding.quantity,
                        avgPrice: holding.avgPrice,
                        currentPrice: holding.currentPrice,
                        totalCost: holding.purchaseAmount,
                        marketValue: holding.evaluationAmount,
                        unrealizedPL: holding.profitLoss,
                        unrealizedPLPct: holding.profitLossRate,
                    },
                });
                this.logger.log(`Added position: ${holding.symbol}`);
            }
        }
    }

    /**
     * 미체결 주문 동기화
     */
    async syncPendingOrders(userId: string): Promise<void> {
        try {
            const orderHistory = await this.kisApiService.getOrderHistory(userId, {
                onlyUnfilled: true,
            });

            this.logger.log(`Found ${orderHistory.length} pending orders`);

            for (const order of orderHistory) {
                // 내부 Trade 레코드와 매칭하여 상태 업데이트
                const trade = await prisma.trade.findFirst({
                    where: {
                        userId,
                        brokerOrderId: order.orderNumber,
                        status: { in: ['SUBMITTED', 'PARTIALLY_FILLED'] },
                    },
                });

                if (trade) {
                    await prisma.trade.update({
                        where: { id: trade.id },
                        data: {
                            filledQuantity: order.filledQuantity,
                            avgFillPrice: order.avgPrice,
                            status: order.isCancelled
                                ? 'CANCELLED'
                                : order.filledQuantity === order.orderQuantity
                                    ? 'FILLED'
                                    : order.filledQuantity > 0
                                        ? 'PARTIALLY_FILLED'
                                        : 'SUBMITTED',
                        },
                    });
                }
            }
        } catch (error) {
            this.logger.error('Failed to sync pending orders', error);
            throw error;
        }
    }

    /**
     * 수동 동기화 트리거
     */
    async triggerSync(brokerAccountId: string, userId: string): Promise<{
        success: boolean;
        message: string;
    }> {
        try {
            await this.syncBrokerAccount(brokerAccountId, userId);
            return { success: true, message: '동기화 완료' };
        } catch (error) {
            return { success: false, message: `동기화 실패: ${error.message}` };
        }
    }
}
