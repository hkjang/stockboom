import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { PatternDetectionService } from './pattern-detection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('AI Analysis')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
    constructor(
        private aiService: AiService,
        private patternDetectionService: PatternDetectionService,
    ) { }

    @Post('news/:newsId/analyze')
    @ApiOperation({ summary: 'Analyze news article with LLM' })
    async analyzeNews(@Param('newsId') newsId: string) {
        return this.aiService.analyzeNews(newsId);
    }

    @Get('stocks/:stockId/news-analysis')
    @ApiOperation({ summary: 'Get aggregated news analysis for a stock' })
    async getStockNewsAnalysis(
        @Param('stockId') stockId: string,
        @Query('limit') limit?: number,
    ) {
        return this.aiService.analyzeStockNews(stockId, limit ? parseInt(limit as any) : 10);
    }

    @Get('stocks/:stockId/report')
    @ApiOperation({ summary: 'Generate comprehensive AI stock report' })
    async generateStockReport(@Param('stockId') stockId: string) {
        return this.aiService.generateStockReport(stockId);
    }

    @Get('stocks/:stockId/reports')
    @ApiOperation({ summary: 'Get historical AI reports for a stock' })
    async getStockReports(
        @Param('stockId') stockId: string,
        @Query('type') analysisType?: string,
        @Query('limit') limit?: number,
    ) {
        return this.aiService.getStockReports(
            stockId,
            analysisType,
            limit ? parseInt(limit as any) : 10,
        );
    }

    @Get('stocks/:stockId/anomalies')
    @ApiOperation({ summary: 'Detect trading anomalies' })
    async detectAnomalies(
        @Param('stockId') stockId: string,
        @Query('timeframe') timeframe?: string,
    ) {
        return this.patternDetectionService.detectAnomalies(stockId, timeframe || '1d');
    }

    @Get('stocks/:stockId/patterns')
    @ApiOperation({ summary: 'Detect chart patterns' })
    async detectPatterns(@Param('stockId') stockId: string) {
        return this.patternDetectionService.detectChartPatterns(stockId);
    }

    @Post('stocks/:stockId/pattern-analysis')
    @ApiOperation({ summary: 'Run and save full pattern analysis' })
    async runPatternAnalysis(@Param('stockId') stockId: string) {
        return this.patternDetectionService.savePatternAnalysis(stockId);
    }

    // =====================================
    // Disclosure Analysis
    // =====================================

    @Post('disclosures/analyze')
    @ApiOperation({ summary: 'Analyze a single disclosure with AI' })
    async analyzeDisclosure(
        @Body() data: {
            corpName: string;
            reportTitle: string;
            reportType: string;
            content?: string;
            rcptNo?: string;
        }
    ) {
        return this.aiService.analyzeDisclosure(data);
    }

    @Post('disclosures/analyze-batch')
    @ApiOperation({ summary: 'Analyze multiple disclosures and provide comprehensive analysis' })
    async analyzeDisclosureBatch(
        @Body() disclosures: Array<{
            corpName: string;
            reportTitle: string;
            reportType: string;
            rcptDt: string;
        }>
    ) {
        return this.aiService.analyzeDisclosureBatch(disclosures);
    }
}

