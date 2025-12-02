import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { StocksModule } from '../stocks/stocks.module';

@Module({
    imports: [
        StocksModule,
        BullModule.registerQueue({
            name: 'notification',
        }),
    ],
    controllers: [AlertsController],
    providers: [AlertsService],
    exports: [AlertsService],
})
export class AlertsModule { }
