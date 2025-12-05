import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import { IndicatorsService } from './indicators.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { prisma } from '@stockboom/database';

@ApiTags('analysis')
@Controller('analysis')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalysisController {
    constructor(
        private analysisService: AnalysisService,
        private indicatorsService: IndicatorsService,
    ) { }

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

    @Get(':stockId/technical')
    @ApiOperation({ summary: 'Get technical analysis data for a stock' })
    @ApiQuery({ name: 'timeframe', required: false, example: '1d' })
    async getTechnicalAnalysis(
        @Param('stockId') stockId: string,
        @Query('timeframe') timeframe?: string,
    ) {
        const tf = timeframe || '1d';

        // Get stock with recent candles
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
            include: {
                candles: {
                    where: { timeframe: tf },
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                },
            },
        });

        if (!stock) {
            return { error: 'Stock not found' };
        }

        // Get latest indicators
        const indicators = await this.indicatorsService.getLatestIndicators(stockId, tf);

        // Calculate additional indicators from candles if available
        let technicalData: any = {
            stock: {
                id: stock.id,
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.currentPrice,
                market: stock.market,
            },
            indicators: {},
            chartData: [],
            signal: null,
        };

        if (stock.candles.length > 0) {
            const candles = stock.candles.reverse();
            const closes = candles.map(c => Number(c.close));

            // Calculate RSI
            if (closes.length >= 14) {
                const rsi = this.indicatorsService.calculateRSI(closes, 14);
                const latestRSI = rsi[rsi.length - 1];
                technicalData.indicators.rsi = {
                    value: latestRSI,
                    signal: latestRSI > 70 ? 'SELL' : latestRSI < 30 ? 'BUY' : 'HOLD',
                    description: latestRSI > 70 ? '과매수 구간' : latestRSI < 30 ? '과매도 구간' : '중립',
                };
            }

            // Calculate MACD
            if (closes.length >= 26) {
                const macd = this.indicatorsService.calculateMACD(closes);
                const latestMACD = macd[macd.length - 1];
                if (latestMACD && latestMACD.MACD !== undefined && latestMACD.signal !== undefined) {
                    technicalData.indicators.macd = {
                        macd: latestMACD.MACD,
                        signal: latestMACD.signal,
                        histogram: latestMACD.histogram,
                        trend: (latestMACD.MACD ?? 0) > (latestMACD.signal ?? 0) ? 'BULLISH' : 'BEARISH',
                    };
                }
            }

            // Calculate Bollinger Bands
            if (closes.length >= 20) {
                const bb = this.indicatorsService.calculateBollingerBands(closes, 20, 2);
                const latestBB = bb[bb.length - 1];
                const currentPrice = closes[closes.length - 1];
                technicalData.indicators.bollingerBands = {
                    upper: latestBB.upper,
                    middle: latestBB.middle,
                    lower: latestBB.lower,
                    position: currentPrice > latestBB.upper ? 'ABOVE_UPPER' :
                        currentPrice < latestBB.lower ? 'BELOW_LOWER' : 'WITHIN',
                };
            }

            // Calculate Stochastic
            const stochCandles = candles.map(c => ({
                timestamp: c.timestamp,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
                volume: Number(c.volume),
            }));
            if (stochCandles.length >= 14) {
                const stoch = this.indicatorsService.calculateStochastic(stochCandles, 14, 3);
                const latestStoch = stoch[stoch.length - 1];
                if (latestStoch) {
                    technicalData.indicators.stochastic = {
                        k: latestStoch.k,
                        d: latestStoch.d,
                        signal: latestStoch.k > 80 ? 'OVERBOUGHT' : latestStoch.k < 20 ? 'OVERSOLD' : 'NEUTRAL',
                    };
                }
            }

            // Calculate Moving Averages
            if (closes.length >= 20) {
                const sma20 = this.indicatorsService.calculateSMA(closes, 20);
                const sma50 = closes.length >= 50 ? this.indicatorsService.calculateSMA(closes, 50) : [];
                const ema12 = this.indicatorsService.calculateEMA(closes, 12);

                technicalData.indicators.movingAverages = {
                    sma20: sma20[sma20.length - 1],
                    sma50: sma50.length > 0 ? sma50[sma50.length - 1] : null,
                    ema12: ema12[ema12.length - 1],
                    trend: closes[closes.length - 1] > sma20[sma20.length - 1] ? 'ABOVE_MA' : 'BELOW_MA',
                };
            }

            // Prepare chart data
            technicalData.chartData = candles.slice(-60).map((c, i) => ({
                timestamp: c.timestamp,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
                volume: Number(c.volume),
            }));

            // Generate overall signal
            technicalData.signal = await this.indicatorsService.generateTradingSignal(stockId, tf);
        }

        // Merge with stored indicators
        Object.assign(technicalData.indicators, indicators);

        return technicalData;
    }

    @Get(':stockId/chart-data')
    @ApiOperation({ summary: 'Get candlestick chart data with indicators' })
    @ApiQuery({ name: 'timeframe', required: false, example: '1d' })
    @ApiQuery({ name: 'limit', required: false, example: '100' })
    async getChartData(
        @Param('stockId') stockId: string,
        @Query('timeframe') timeframe?: string,
        @Query('limit') limit?: number,
    ) {
        const tf = timeframe || '1d';
        const dataLimit = limit ? Number(limit) : 100;

        const candles = await prisma.candle.findMany({
            where: { stockId, timeframe: tf },
            orderBy: { timestamp: 'desc' },
            take: dataLimit,
        });

        if (candles.length === 0) {
            return { chartData: [], indicators: {} };
        }

        const orderedCandles = candles.reverse();
        const closes = orderedCandles.map(c => Number(c.close));

        // Calculate indicators for chart overlay
        const sma20 = closes.length >= 20 ? this.indicatorsService.calculateSMA(closes, 20) : [];
        const sma50 = closes.length >= 50 ? this.indicatorsService.calculateSMA(closes, 50) : [];
        const bb = closes.length >= 20 ? this.indicatorsService.calculateBollingerBands(closes, 20, 2) : [];

        const chartData = orderedCandles.map((c, i) => ({
            timestamp: c.timestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume),
            sma20: i >= 19 ? sma20[i - 19] : null,
            sma50: i >= 49 && sma50.length > 0 ? sma50[i - 49] : null,
            bbUpper: i >= 19 && bb.length > 0 ? bb[i - 19]?.upper : null,
            bbMiddle: i >= 19 && bb.length > 0 ? bb[i - 19]?.middle : null,
            bbLower: i >= 19 && bb.length > 0 ? bb[i - 19]?.lower : null,
        }));

        return { chartData };
    }

    @Get(':stockId/summary')
    @ApiOperation({ summary: 'Get comprehensive analysis summary' })
    async getAnalysisSummary(@Param('stockId') stockId: string) {
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
            include: {
                indicators: {
                    where: { timeframe: '1d' },
                    orderBy: { timestamp: 'desc' },
                    take: 5,
                    distinct: ['type'],
                },
                news: {
                    orderBy: { publishedAt: 'desc' },
                    take: 5,
                },
                aiReports: {
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                },
            },
        });

        if (!stock) {
            return { error: 'Stock not found' };
        }

        // Calculate overall sentiment from news
        const newsWithSentiment = stock.news.filter(n => n.sentiment);
        const avgSentimentScore = newsWithSentiment.length > 0
            ? newsWithSentiment.reduce((sum, n) => sum + Number(n.sentimentScore || 0), 0) / newsWithSentiment.length
            : 0;

        // Get latest AI report recommendation
        const latestReport = stock.aiReports[0];

        // Calculate indicator consensus
        const indicatorSignals = stock.indicators.filter(i => i.signal);
        const buySignals = indicatorSignals.filter(i => i.signal?.includes('BUY')).length;
        const sellSignals = indicatorSignals.filter(i => i.signal?.includes('SELL')).length;

        let technicalConsensus = 'HOLD';
        if (buySignals > sellSignals && buySignals >= 2) technicalConsensus = 'BUY';
        if (sellSignals > buySignals && sellSignals >= 2) technicalConsensus = 'SELL';

        return {
            stock: {
                id: stock.id,
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.currentPrice,
                market: stock.market,
                sector: stock.sector,
            },
            technicalAnalysis: {
                consensus: technicalConsensus,
                buySignals,
                sellSignals,
                holdSignals: indicatorSignals.length - buySignals - sellSignals,
                indicators: stock.indicators.map(i => ({
                    type: i.type,
                    signal: i.signal,
                    strength: i.signalStrength,
                })),
            },
            sentiment: {
                score: avgSentimentScore,
                label: avgSentimentScore > 20 ? 'POSITIVE' : avgSentimentScore < -20 ? 'NEGATIVE' : 'NEUTRAL',
                newsCount: stock.news.length,
            },
            aiAnalysis: latestReport ? {
                recommendation: latestReport.recommendation,
                riskScore: latestReport.riskScore,
                confidence: latestReport.confidence,
                summary: latestReport.summary,
                createdAt: latestReport.createdAt,
            } : null,
            lastUpdated: new Date(),
        };
    }
}

