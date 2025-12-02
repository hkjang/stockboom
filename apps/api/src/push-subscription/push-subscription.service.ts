import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@stockboom/database';

@Injectable()
export class PushSubscriptionService {
    constructor(private configService: ConfigService) { }

    /**
     * Get VAPID public key for client
     */
    getPublicKey(): string {
        const publicKey = this.configService.get('VAPID_PUBLIC_KEY');

        if (!publicKey) {
            // Generate VAPID keys if not configured
            // In production, these should be generated once and stored in env
            return this.generateVapidKeys().publicKey;
        }

        return publicKey;
    }

    /**
     * Subscribe user to push notifications
     */
    async subscribe(userId: string, subscription: {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
    }) {
        // Check if subscription already exists
        const existing = await prisma.pushSubscription.findUnique({
            where: { endpoint: subscription.endpoint },
        });

        if (existing) {
            return existing;
        }

        return prisma.pushSubscription.create({
            data: {
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
        });
    }

    /**
     * Unsubscribe user from push notifications
     */
    async unsubscribe(userId: string, endpoint: string) {
        return prisma.pushSubscription.deleteMany({
            where: {
                userId,
                endpoint,
            },
        });
    }

    /**
     * Get all subscriptions for a user
     */
    async getUserSubscriptions(userId: string) {
        return prisma.pushSubscription.findMany({
            where: { userId },
        });
    }

    /**
     * Generate VAPID keys (for development)
     */
    private generateVapidKeys() {
        const webPush = require('web-push');
        const vapidKeys = webPush.generateVAPIDKeys();

        console.log('Generated VAPID Keys (add these to your .env file):');
        console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
        console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);

        return vapidKeys;
    }
}
