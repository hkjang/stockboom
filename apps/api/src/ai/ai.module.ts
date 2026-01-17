import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PatternDetectionService } from './pattern-detection.service';
import { AITradingService } from './ai-trading.service';
import { StocksModule } from '../stocks/stocks.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
    imports: [
        ConfigModule,
        StocksModule,
        forwardRef(() => MarketDataModule),
        forwardRef(() => AnalysisModule),
    ],
    controllers: [AiController],
    providers: [AiService, PatternDetectionService, AITradingService],
    exports: [AiService, PatternDetectionService, AITradingService],
})
export class AiModule { }
