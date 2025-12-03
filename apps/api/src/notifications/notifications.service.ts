import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma, Notification, Prisma } from '@stockboom/database';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
    private transporter: nodemailer.Transporter;

    constructor(private configService: ConfigService) {
        // Initialize email transporter
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: this.configService.get('SMTP_PORT'),
            secure: false,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASSWORD'),
            },
        });
    }

    async findAll(userId: string, params?: {
        skip?: number;
        take?: number;
        isRead?: boolean;
    }): Promise<Notification[]> {
        const { skip, take, isRead } = params || {};

        return prisma.notification.findMany({
            where: {
                userId,
                ...(isRead !== undefined && { isRead }),
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: take || 50,
        });
    }

    async markAsRead(id: string, userId: string): Promise<Notification> {
        return prisma.notification.update({
            where: { id },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });
    }

    async markAllAsRead(userId: string): Promise<number> {
        const result = await prisma.notification.updateMany({
            where: {
                userId,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });

        return result.count;
    }

    async getUnreadCount(userId: string): Promise<number> {
        return prisma.notification.count({
            where: {
                userId,
                isRead: false,
            },
        });
    }

    /**
     * Send email notification
     */
    async sendEmail(userId: string, subject: string, message: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || !user.email) {
            throw new Error('User email not found');
        }

        try {
            await this.transporter.sendMail({
                from: this.configService.get('SMTP_USER'),
                to: user.email,
                subject,
                html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2563eb;">📈 StockBoom Notification</h2>
            <p>${message}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">
              This email was sent from StockBoom. Please do not reply to this email.
            </p>
          </div>
        `,
            });

            return true;
        } catch (error) {
            console.error('Failed to send email:', error);
            return false;
        }
    }

    /**
     * Send web push notification
     */
    async sendWebPush(userId: string, title: string, message: string, data?: any) {
        // Import web-push dynamically
        const webPush = await import('web-push');

        // Configure VAPID keys
        const vapidPublicKey = this.configService.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = this.configService.get('VAPID_PRIVATE_KEY');
        const vapidEmail = this.configService.get('VAPID_EMAIL') || 'mailto:noreply@stockboom.com';

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.warn('VAPID keys not configured. Skipping web push.');
            // Log instead of sending
            console.log(`[Web Push] ${userId}: ${title} - ${message}`);
            return false;
        }

        webPush.default.setVapidDetails(
            vapidEmail,
            vapidPublicKey,
            vapidPrivateKey
        );

        try {
            // Get user's push subscriptions
            const subscriptions = await prisma.pushSubscription.findMany({
                where: { userId },
            });

            if (subscriptions.length === 0) {
                console.log(`No push subscriptions found for user ${userId}`);
                return false;
            }

            const payload = JSON.stringify({
                title,
                body: message,
                icon: '/icon-192x192.png',
                badge: '/badge-72x72.png',
                data: data || {},
                timestamp: Date.now(),
            });

            // Send to all subscriptions
            const promises = subscriptions.map(async (sub) => {
                try {
                    const pushConfig = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth,
                        },
                    };

                    await webPush.default.sendNotification(pushConfig, payload);
                    return true;
                } catch (error) {
                    console.error(`Failed to send push to subscription ${sub.id}:`, error);

                    // If subscription is invalid (410 Gone), remove it
                    if (error.statusCode === 410) {
                        await prisma.pushSubscription.delete({
                            where: { id: sub.id },
                        });
                        console.log(`Removed invalid subscription ${sub.id}`);
                    }

                    return false;
                }
            });

            const results = await Promise.all(promises);
            const successCount = results.filter(r => r).length;

            console.log(`Sent push notifications: ${successCount}/${subscriptions.length} successful`);

            return successCount > 0;

        } catch (error) {
            console.error('Failed to send web push:', error);
            return false;
        }
    }

    /**
     * Create and send notification
     */
    async createAndSend(data: {
        userId: string;
        alertId?: string;
        type: any;
        title: string;
        message: string;
        channel: 'WEB_PUSH' | 'EMAIL';
        priority?: string;
        data?: any;
    }) {
        // Create notification record
        const notification = await prisma.notification.create({
            data: {
                userId: data.userId,
                alertId: data.alertId,
                type: data.type,
                title: data.title,
                message: data.message,
                channel: data.channel,
                priority: data.priority || 'NORMAL',
                data: data.data,
            },
        });

        // Send via appropriate channel
        let sent = false;

        if (data.channel === 'EMAIL') {
            sent = await this.sendEmail(data.userId, data.title, data.message);
        } else if (data.channel === 'WEB_PUSH') {
            sent = await this.sendWebPush(data.userId, data.title, data.message);
        }

        // Update notification status
        if (sent) {
            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    isSent: true,
                    sentAt: new Date(),
                },
            });
        }

        return notification;
    }
}
