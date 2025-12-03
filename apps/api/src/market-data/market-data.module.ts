import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MarketDataService } from './market-data.service';
import { KisApiService } from './kis-api.service';
import { YahooFinanceService } from './yahoo-finance.service';
import { OpenDartService } from './opendart.service';
import { UserApiKeysModule } from '../user-api-keys/user-api-keys.module';

@Module({
    imports: [HttpModule, ConfigModule, UserApiKeysModule],
    providers: [
        MarketDataService,
        KisApiService,
        YahooFinanceService,
        OpenDartService,
    ],
    exports: [
        MarketDataService,
        KisApiService,
        YahooFinanceService,
        OpenDartService,
    ],
})
export class MarketDataModule { }
