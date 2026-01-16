import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MarketDataService } from './market-data.service';
import { KisApiService } from './kis-api.service';
import { KisWebsocketService } from './kis-websocket.service';
import { KisSyncService } from './kis-sync.service';
import { YahooFinanceService } from './yahoo-finance.service';
import { OpenDartService } from './opendart.service';
import { UserApiKeysModule } from '../user-api-keys/user-api-keys.module';

@Module({
    imports: [
        HttpModule,
        ConfigModule,
        UserApiKeysModule,
        ScheduleModule.forRoot(),
        EventEmitterModule.forRoot(),
    ],
    providers: [
        MarketDataService,
        KisApiService,
        KisWebsocketService,
        KisSyncService,
        YahooFinanceService,
        OpenDartService,
    ],
    exports: [
        MarketDataService,
        KisApiService,
        KisWebsocketService,
        KisSyncService,
        YahooFinanceService,
        OpenDartService,
    ],
})
export class MarketDataModule { }


