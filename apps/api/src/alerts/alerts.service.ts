import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma, Alert, AlertType, Prisma } from '@stockboom/database';
import { NotificationJob } from '@stockboom/types';
import { StocksService } from '../stocks/stocks.service';

@Injectable()
export class AlertsService {
    constructor(
        @InjectQueue('notification') private notificationQueue: Queue,
        private stocksService: StocksService,
    ) { }

    async findAll(userId: string): Promise<Alert[]> {
        return prisma.alert.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string, userId: string): Promise<Alert> {
        const alert = await prisma.alert.findFirst({
            where: { id, userId },
        });

        if (!alert) {
            throw new NotFoundException('Alert not found');
        }

        return alert;
    }

    async create(userId: string, data: {
        type: AlertType;
        name: string;
        description?: string;
        conditions: any;
        webPush?: boolean;
        email?: boolean;
    }): Promise<Alert> {
        return prisma.alert.create({
            data: {
                userId,
                type: data.type,
                name: data.name,
                description: data.description,
                conditions: data.conditions,
                webPush: data.webPush ?? true,
                email: data.email ?? false,
            },
        });
    }

    async update(id: string, userId: string, data: Prisma.AlertUpdateInput): Promise<Alert> {
        // Verify ownership
        await this.findOne(id, userId);

        return prisma.alert.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, userId: string): Promise<Alert> {
        // Verify ownership
        await this.findOne(id, userId);

        return prisma.alert.delete({
            where: { id },
        });
    }

    /**
     * Check if alert conditions are met
     */
    async checkAlert(alert: Alert, currentData: any): Promise<boolean> {
        const conditions = alert.conditions as any;

        switch (alert.type) {
            case 'PRICE_CHANGE': {
                const { symbol, changePercent, direction } = conditions;

                if (currentData.symbol !== symbol) return false;

                const change = currentData.changePercent;

                if (direction === 'UP' && change >= changePercent) return true;
                if (direction === 'DOWN' && change <= -changePercent) return true;

                return false;
            }

            case 'VOLUME_SPIKE': {
                const { symbol, multiplier } = conditions;

                if (currentData.symbol !== symbol) return false;

                const avgVolume = currentData.avgVolume || currentData.volume;
                const currentVolume = currentData.volume;

                return currentVolume >= avgVolume * multiplier;
            }

            case 'INDICATOR_SIGNAL': {
                const { stockId, indicator, condition } = conditions;

                // This would check indicator values
                // For now, simplified
                return false;
            }

            default:
                return false;
        }
    }

    /**
     * Trigger alert notification
     */
    async triggerAlert(alertId: string, data: any) {
        const alert = await prisma.alert.findUnique({
            where: { id: alertId },
            include: { user: true },
        });

        if (!alert || !alert.isActive) return;

        // Create notification
        await prisma.notification.create({
            data: {
                userId: alert.userId,
                alertId: alert.id,
                type: alert.type,
                title: alert.name,
                message: this.formatAlertMessage(alert, data),
                channel: alert.webPush ? 'WEB_PUSH' : 'EMAIL',
                priority: 'HIGH',
                data,
            },
        });

        // Queue notification for sending
        await this.notificationQueue.add('send-notification', {
            userId: alert.userId,
            type: alert.type,
            title: alert.name,
            message: this.formatAlertMessage(alert, data),
            channel: alert.webPush ? 'WEB_PUSH' : 'EMAIL',
            priority: 'HIGH',
        } as NotificationJob);

        // Update alert stats
        await prisma.alert.update({
            where: { id: alertId },
            data: {
                lastTriggeredAt: new Date(),
                triggerCount: { increment: 1 },
            },
        });
    }

    private formatAlertMessage(alert: Alert, data: any): string {
        const conditions = alert.conditions as any;

        switch (alert.type) {
            case 'PRICE_CHANGE':
                return `${conditions.symbol} 가격이 ${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}% 변동했습니다.`;

            case 'VOLUME_SPIKE':
                return `${conditions.symbol} 거래량이 평균 대비 ${data.volumeMultiplier}배 급증했습니다.`;

            case 'INDICATOR_SIGNAL':
                return `${conditions.indicator} 신호: ${data.signal}`;

            case 'TRADE_EXECUTION':
                return `거래가 체결되었습니다: ${data.orderSide} ${data.quantity}주 @ ${data.price}원`;

            case 'RISK_WARNING':
                return `리스크 경고: ${data.message}`;

            default:
                return alert.description || '알림이 발생했습니다.';
        }
    }

    /**
     * Periodic check for all active alerts (runs every minute)
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async checkActiveAlerts() {
        const alerts = await prisma.alert.findMany({
            where: { isActive: true },
        });

        for (const alert of alerts) {
            try {
                const conditions = alert.conditions as any;

                if (alert.type === 'PRICE_CHANGE' && conditions.symbol) {
                    // Get current quote
                    const quote = await this.stocksService.getQuote(conditions.symbol);

                    const isTriggered = await this.checkAlert(alert, {
                        symbol: conditions.symbol,
                        changePercent: (quote as any).changeRate || (quote as any).changePercent,
                        volume: quote.volume,
                    });

                    if (isTriggered) {
                        await this.triggerAlert(alert.id, quote);
                    }
                }
            } catch (error) {
                console.error(`Failed to check alert ${alert.id}:`, error);
            }
        }
    }
}
