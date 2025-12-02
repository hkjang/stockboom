import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@stockboom/database';

/**
 * Pattern Detection Service
 * Machine learning-based anomaly detection and pattern recognition
 */
@Injectable()
export class PatternDetectionService {
    private readonly logger = new Logger(PatternDetectionService.name);

    /**
     * Detect anomalies in trading volume and price
     */
    async detectAnomalies(stockId: string, timeframe: string = '1d'): Promise<{
        hasAnomaly: boolean;
        anomalies: any[];
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        description: string;
    }> {
        // Get recent candles (last 100 days for daily timeframe)
        const candles = await prisma.candle.findMany({
            where: {
                stockId,
                timeframe,
            },
            orderBy: { timestamp: 'desc' },
            take: 100,
        });

        if (candles.length < 30) {
            return {
                hasAnomaly: false,
                anomalies: [],
                severity: 'LOW',
                description: 'Insufficient data for analysis',
            };
        }

        const anomalies = [];

        // 1. Volume Anomaly Detection (Z-score method)
        const volumeAnomaly = this.detectVolumeAnomaly(candles);
        if (volumeAnomaly) {
            anomalies.push(volumeAnomaly);
        }

        // 2. Price Anomaly Detection
        const priceAnomaly = this.detectPriceAnomaly(candles);
        if (priceAnomaly) {
            anomalies.push(priceAnomaly);
        }

        // 3. Volatility Spike Detection
        const volatilityAnomaly = this.detectVolatilitySpike(candles);
        if (volatilityAnomaly) {
            anomalies.push(volatilityAnomaly);
        }

        // Calculate severity
        let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (anomalies.length >= 3) {
            severity = 'HIGH';
        } else if (anomalies.length >= 2) {
            severity = 'MEDIUM';
        } else if (anomalies.length === 1) {
            severity = 'LOW';
        }

        const hasAnomaly = anomalies.length > 0;
        const description = hasAnomaly
            ? `Detected ${anomalies.length} anomalies: ${anomalies.map(a => a.type).join(', ')}`
            : 'No anomalies detected';

        return {
            hasAnomaly,
            anomalies,
            severity,
            description,
        };
    }

    /**
     * Detect volume anomalies using Z-score
     */
    private detectVolumeAnomaly(candles: any[]): any | null {
        const volumes = candles.map(c => Number(c.volume));
        const mean = this.calculateMean(volumes);
        const stdDev = this.calculateStdDev(volumes, mean);

        const latestVolume = volumes[0];
        const zScore = (latestVolume - mean) / stdDev;

        // Z-score > 3 indicates significant anomaly
        if (Math.abs(zScore) > 3) {
            return {
                type: 'VOLUME_SPIKE',
                severity: Math.abs(zScore) > 5 ? 'HIGH' : 'MEDIUM',
                zScore: zScore.toFixed(2),
                currentValue: latestVolume,
                average: mean.toFixed(0),
                description: zScore > 0
                    ? `거래량이 평균 대비 ${((latestVolume / mean - 1) * 100).toFixed(1)}% 급증`
                    : `거래량이 평균 대비 ${((1 - latestVolume / mean) * 100).toFixed(1)}% 급감`,
            };
        }

        return null;
    }

    /**
     * Detect price anomalies
     */
    private detectPriceAnomaly(candles: any[]): any | null {
        const closes = candles.map(c => Number(c.close));
        const mean = this.calculateMean(closes);
        const stdDev = this.calculateStdDev(closes, mean);

        const latestClose = closes[0];
        const zScore = (latestClose - mean) / stdDev;

        if (Math.abs(zScore) > 2.5) {
            return {
                type: 'PRICE_ANOMALY',
                severity: Math.abs(zScore) > 4 ? 'HIGH' : 'MEDIUM',
                zScore: zScore.toFixed(2),
                currentValue: latestClose,
                average: mean.toFixed(2),
                description: zScore > 0
                    ? `가격이 평균 대비 비정상적으로 높음 (${((latestClose / mean - 1) * 100).toFixed(1)}%)`
                    : `가격이 평균 대비 비정상적으로 낮음 (${((1 - latestClose / mean) * 100).toFixed(1)}%)`,
            };
        }

        return null;
    }

    /**
     * Detect volatility spikes
     */
    private detectVolatilitySpike(candles: any[]): any | null {
        // Calculate daily returns
        const returns = [];
        for (let i = 0; i < candles.length - 1; i++) {
            const currentClose = Number(candles[i].close);
            const previousClose = Number(candles[i + 1].close);
            const dailyReturn = (currentClose - previousClose) / previousClose;
            returns.push(dailyReturn);
        }

        // Calculate volatility (standard deviation of returns)
        const recentReturns = returns.slice(0, 5); // Last 5 days
        const historicalReturns = returns.slice(5, 30); // Previous 25 days

        const recentVolatility = this.calculateStdDev(recentReturns, this.calculateMean(recentReturns));
        const historicalVolatility = this.calculateStdDev(historicalReturns, this.calculateMean(historicalReturns));

        const volatilityRatio = recentVolatility / historicalVolatility;

        // Volatility spike if recent volatility is 2x historical
        if (volatilityRatio > 2) {
            return {
                type: 'VOLATILITY_SPIKE',
                severity: volatilityRatio > 3 ? 'HIGH' : 'MEDIUM',
                ratio: volatilityRatio.toFixed(2),
                recentVolatility: (recentVolatility * 100).toFixed(2) + '%',
                historicalVolatility: (historicalVolatility * 100).toFixed(2) + '%',
                description: `최근 변동성이 평균 대비 ${volatilityRatio.toFixed(1)}배 증가`,
            };
        }

        return null;
    }

    /**
     * Detect chart patterns (Head and Shoulders, Triangle, etc.)
     */
    async detectChartPatterns(stockId: string): Promise<{
        patterns: any[];
        description: string;
    }> {
        const candles = await prisma.candle.findMany({
            where: {
                stockId,
                timeframe: '1d',
            },
            orderBy: { timestamp: 'desc' },
            take: 60, // 2 months of data
        });

        if (candles.length < 20) {
            return {
                patterns: [],
                description: 'Insufficient data for pattern detection',
            };
        }

        const patterns = [];

        // Detect Double Top/Bottom
        const doublePattern = this.detectDoublePattern(candles);
        if (doublePattern) {
            patterns.push(doublePattern);
        }

        // Detect Triangle Pattern
        const trianglePattern = this.detectTrianglePattern(candles);
        if (trianglePattern) {
            patterns.push(trianglePattern);
        }

        return {
            patterns,
            description: patterns.length > 0
                ? `Detected ${patterns.length} chart pattern(s)`
                : 'No significant patterns detected',
        };
    }

    /**
     * Detect double top/bottom patterns
     */
    private detectDoublePattern(candles: any[]): any | null {
        const highs = candles.map(c => Number(c.high));
        const lows = candles.map(c => Number(c.low));

        // Find local maxima for double top
        const peaks = this.findLocalMaxima(highs, 5);

        if (peaks.length >= 2) {
            const [peak1, peak2] = peaks.slice(0, 2);
            const priceDiff = Math.abs(highs[peak1] - highs[peak2]) / highs[peak1];

            // Double top if peaks are within 3% of each other
            if (priceDiff < 0.03 && Math.abs(peak1 - peak2) >= 10) {
                return {
                    type: 'DOUBLE_TOP',
                    signal: 'BEARISH',
                    confidence: 70,
                    description: '이중 천정 패턴 감지 - 하락 신호',
                    positions: [peak1, peak2],
                };
            }
        }

        // Find local minima for double bottom
        const troughs = this.findLocalMinima(lows, 5);

        if (troughs.length >= 2) {
            const [trough1, trough2] = troughs.slice(0, 2);
            const priceDiff = Math.abs(lows[trough1] - lows[trough2]) / lows[trough1];

            if (priceDiff < 0.03 && Math.abs(trough1 - trough2) >= 10) {
                return {
                    type: 'DOUBLE_BOTTOM',
                    signal: 'BULLISH',
                    confidence: 70,
                    description: '이중 바닥 패턴 감지 - 상승 신호',
                    positions: [trough1, trough2],
                };
            }
        }

        return null;
    }

    /**
     * Detect triangle patterns (ascending/descending/symmetrical)
     */
    private detectTrianglePattern(candles: any[]): any | null {
        if (candles.length < 30) return null;

        const highs = candles.slice(0, 30).map(c => Number(c.high));
        const lows = candles.slice(0, 30).map(c => Number(c.low));

        // Simple linear regression on highs and lows
        const highTrend = this.calculateTrend(highs);
        const lowTrend = this.calculateTrend(lows);

        // Ascending triangle: flat top, rising bottom
        if (Math.abs(highTrend) < 0.001 && lowTrend > 0.002) {
            return {
                type: 'ASCENDING_TRIANGLE',
                signal: 'BULLISH',
                confidence: 65,
                description: '상승 삼각형 패턴 - 강세 신호',
            };
        }

        // Descending triangle: declining top, flat bottom
        if (highTrend < -0.002 && Math.abs(lowTrend) < 0.001) {
            return {
                type: 'DESCENDING_TRIANGLE',
                signal: 'BEARISH',
                confidence: 65,
                description: '하락 삼각형 패턴 - 약세 신호',
            };
        }

        // Symmetrical triangle: converging
        if (highTrend < -0.001 && lowTrend > 0.001) {
            return {
                type: 'SYMMETRICAL_TRIANGLE',
                signal: 'NEUTRAL',
                confidence: 60,
                description: '대칭 삼각형 패턴 - 돌파 대기',
            };
        }

        return null;
    }

    /**
     * Statistical helper functions
     */
    private calculateMean(values: number[]): number {
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    private calculateStdDev(values: number[], mean: number): number {
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const variance = this.calculateMean(squaredDiffs);
        return Math.sqrt(variance);
    }

    private findLocalMaxima(values: number[], window: number = 5): number[] {
        const maxima = [];
        for (let i = window; i < values.length - window; i++) {
            let isMaxima = true;
            for (let j = i - window; j <= i + window; j++) {
                if (j !== i && values[j] >= values[i]) {
                    isMaxima = false;
                    break;
                }
            }
            if (isMaxima) {
                maxima.push(i);
            }
        }
        return maxima;
    }

    private findLocalMinima(values: number[], window: number = 5): number[] {
        const minima = [];
        for (let i = window; i < values.length - window; i++) {
            let isMinima = true;
            for (let j = i - window; j <= i + window; j++) {
                if (j !== i && values[j] <= values[i]) {
                    isMinima = false;
                    break;
                }
            }
            if (isMinima) {
                minima.push(i);
            }
        }
        return minima;
    }

    private calculateTrend(values: number[]): number {
        const n = values.length;
        const indices = Array.from({ length: n }, (_, i) => i);

        const meanX = this.calculateMean(indices);
        const meanY = this.calculateMean(values);

        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < n; i++) {
            numerator += (indices[i] - meanX) * (values[i] - meanY);
            denominator += Math.pow(indices[i] - meanX, 2);
        }

        return numerator / denominator; // Slope
    }

    /**
     * Save pattern detection results
     */
    async savePatternAnalysis(stockId: string): Promise<any> {
        const anomalies = await this.detectAnomalies(stockId);
        const patterns = await this.detectChartPatterns(stockId);

        const results = {
            anomalies,
            patterns,
            timestamp: new Date(),
        };

        const report = await prisma.aIReport.create({
            data: {
                stockId,
                analysisType: 'PATTERN_DETECTION',
                model: 'statistical-ml',
                version: '1.0',
                results,
                riskScore: anomalies.severity === 'HIGH' ? 80 : anomalies.severity === 'MEDIUM' ? 50 : 20,
                confidence: 70,
                summary: `패턴 분석: ${anomalies.description}, ${patterns.description}`,
                recommendation: this.deriveRecommendation(anomalies, patterns),
            },
        });

        this.logger.log(`Pattern analysis saved for stock ${stockId}`);

        return {
            reportId: report.id,
            ...results,
        };
    }

    /**
     * Derive trading recommendation from analysis
     */
    private deriveRecommendation(anomalies: any, patterns: any): 'BUY' | 'SELL' | 'HOLD' {
        const bullishPatterns = patterns.patterns.filter(p => p.signal === 'BULLISH').length;
        const bearishPatterns = patterns.patterns.filter(p => p.signal === 'BEARISH').length;

        if (anomalies.severity === 'HIGH') {
            return 'HOLD'; // High uncertainty
        }

        if (bullishPatterns > bearishPatterns) {
            return 'BUY';
        } else if (bearishPatterns > bullishPatterns) {
            return 'SELL';
        }

        return 'HOLD';
    }
}
