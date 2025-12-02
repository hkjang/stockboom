import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
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

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '../../.env',
        }),

        // Scheduling
        ScheduleModule.forRoot(),

        // Rate limiting
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100,
        }]),

        // Redis & BullMQ
        BullModule.forRootAsync({
            useFactory: () => ({
                connection: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    password: process.env.REDIS_PASSWORD,
                },
            }),
        }),

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
    ],
})
export class AppModule { }
