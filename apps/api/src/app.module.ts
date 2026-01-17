import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StocksModule } from './stocks/stocks.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { TradesModule } from './trades/trades.module';
import { StrategiesModule } from './strategies/strategies.module';
import { AnalysisModule } from './analysis/analysis.module';
import { AlertsModule } from './alerts/alerts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MarketDataModule } from './market-data/market-data.module';
import { QueueModule } from './queue/queue.module';
import { AdminModule } from './admin/admin.module';
import { DataSourceModule } from './data-source/data-source.module';
import { CommonModule } from './common/common.module';
import { UserApiKeysModule } from './user-api-keys/user-api-keys.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { TradingEngineModule } from './trading-engine/trading-engine.module';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '../../.env',
        }),

        // Scheduling
        ScheduleModule.forRoot(),

        // Event Emitter
        EventEmitterModule.forRoot(),

        // Rate limiting
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100,
        }]),

        // Redis & BullMQ
        BullModule.forRootAsync({
            useFactory: () => ({
                redis: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    password: process.env.REDIS_PASSWORD,
                },
            }),
        }),

        // Common modules
        CommonModule,

        // Feature modules
        AuthModule,
        UsersModule,
        StocksModule,
        PortfoliosModule,
        TradesModule,
        StrategiesModule,
        AnalysisModule,
        AlertsModule,
        NotificationsModule,
        MarketDataModule,
        QueueModule,
        AdminModule,
        DataSourceModule,
        UserApiKeysModule,
        WatchlistModule,
        TradingEngineModule,
    ],
    providers: [
        // Global Rate Limiting Guard
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule { }

