import { Module } from '@nestjs/common';
import { StrategiesController } from './strategies.controller';
import { StrategiesService } from './strategies.service';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
    imports: [AnalysisModule],
    controllers: [StrategiesController],
    providers: [StrategiesService],
    exports: [StrategiesService],
})
export class StrategiesModule { }
