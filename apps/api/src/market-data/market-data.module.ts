import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KisApiService } from './kis-api.service';
import { YahooFinanceService } from './yahoo-finance.service';
import { MarketDataService } from './market-data.service';

@Module({
    imports: [HttpModule],
    providers: [KisApiService, YahooFinanceService, MarketDataService],
    exports: [KisApiService, YahooFinanceService, MarketDataService],
})
export class MarketDataModule { }
