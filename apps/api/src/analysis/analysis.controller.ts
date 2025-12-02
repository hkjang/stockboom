import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('analysis')
@Controller('analysis')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalysisController {
    constructor(private analysisService: AnalysisService) { }

    @Post('stocks/:id/analyze')
    @ApiOperation({ summary: 'Analyze stock with technical indicators' })
    @ApiQuery({ name: 'timeframe', required: false, example: '1d' })
    async analyzeStock(
        @Param('id') stockId: string,
        @Query('timeframe') timeframe?: string,
    ) {
        return this.analysisService.analyzeStock(stockId, timeframe || '1d');
    }

    @Get('recommendations')
    @ApiOperation({ summary: 'Get stock recommendations based on signals' })
    @ApiQuery({ name: 'minStrength', required: false, type: Number })
    @ApiQuery({ name: 'signal', required: false, example: 'BUY' })
    async getRecommendations(
        @Query('minStrength') minStrength?: number,
        @Query('signal') signal?: string,
    ) {
        return this.analysisService.getRecommendations({
            minStrength: minStrength ? Number(minStrength) : 70,
            signal,
        });
    }
}
