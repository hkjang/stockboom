import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { IndicatorsService } from './indicators.service';
import { StocksModule } from '../stocks/stocks.module';

@Module({
    imports: [StocksModule],
    controllers: [AnalysisController],
    providers: [AnalysisService, IndicatorsService],
    exports: [AnalysisService, IndicatorsService],
})
export class AnalysisModule { }
