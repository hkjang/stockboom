import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { RiskManagementService } from './risk-management.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { PortfoliosModule } from '../portfolios/portfolios.module';

@Module({
    imports: [
        MarketDataModule,
        PortfoliosModule,
        BullModule.registerQueue({
            name: 'trading',
        }),
    ],
    controllers: [TradesController],
    providers: [TradesService, RiskManagementService],
    exports: [TradesService, RiskManagementService],
})
export class TradesModule { }

