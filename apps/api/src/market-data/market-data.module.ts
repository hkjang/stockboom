import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MarketDataService } from './market-data.service';
import { KisApiService } from './kis-api.service';
import { KisWebsocketService } from './kis-websocket.service';
import { KisSyncService } from './kis-sync.service';
import { TradingController } from './trading.controller';
import { YahooFinanceService } from './yahoo-finance.service';
import { OpenDartService } from './opendart.service';
import { RealTimeEventHandler } from './realtime-event-handler.service';
import { RealTimeGateway } from './realtime.gateway';
import { UserApiKeysModule } from '../user-api-keys/user-api-keys.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        HttpModule,
        ConfigModule,
        UserApiKeysModule,
        NotificationsModule,
        JwtModule.register({}),
    ],
    controllers: [TradingController],
    providers: [
        MarketDataService,
        KisApiService,
        KisWebsocketService,
        KisSyncService,
        YahooFinanceService,
        OpenDartService,
        RealTimeEventHandler,
        RealTimeGateway,
    ],
    exports: [
        MarketDataService,
        KisApiService,
        KisWebsocketService,
        KisSyncService,
        YahooFinanceService,
        OpenDartService,
        RealTimeEventHandler,
    ],
})
export class MarketDataModule { }



