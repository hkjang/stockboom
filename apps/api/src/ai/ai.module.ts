import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PatternDetectionService } from './pattern-detection.service';
import { StocksModule } from '../stocks/stocks.module';

@Module({
    imports: [
        ConfigModule,
        StocksModule,
    ],
    controllers: [AiController],
    providers: [AiService, PatternDetectionService],
    exports: [AiService, PatternDetectionService],
})
export class AiModule { }
