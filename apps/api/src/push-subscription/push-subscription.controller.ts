import { Controller, Post, Delete, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PushSubscriptionService } from './push-subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Push Notifications')
@Controller('push-subscription')
export class PushSubscriptionController {
    constructor(private pushSubscriptionService: PushSubscriptionService) { }

    @Get('vapid-public-key')
    @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
    getPublicKey() {
        return {
            publicKey: this.pushSubscriptionService.getPublicKey(),
        };
    }

    @Post('subscribe')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Subscribe to push notifications' })
    async subscribe(
        @Request() req,
        @Body() subscription: {
            endpoint: string;
            keys: {
                p256dh: string;
                auth: string;
            };
        },
    ) {
        return this.pushSubscriptionService.subscribe(req.user.id, subscription);
    }

    @Delete('unsubscribe')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Unsubscribe from push notifications' })
    async unsubscribe(
        @Request() req,
        @Body() body: { endpoint: string },
    ) {
        return this.pushSubscriptionService.unsubscribe(req.user.id, body.endpoint);
    }

    @Get('subscriptions')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all push subscriptions' })
    async getSubscriptions(@Request() req) {
        return this.pushSubscriptionService.getUserSubscriptions(req.user.id);
    }
}
