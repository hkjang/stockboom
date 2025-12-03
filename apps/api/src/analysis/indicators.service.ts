import { Injectable } from '@nestjs/common';
import { SMA, EMA, RSI, MACD, Stochastic } from 'technicalindicators';
import { prisma } from '@stockboom/database';

export interface CandleData {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

@Injectable()
export class IndicatorsService {
    /**
     * Calculate Simple Moving Average
     */
    calculateSMA(prices: number[], period: number = 20): number[] {
        return SMA.calculate({ period, values: prices });
    }

    /**
     * Calculate Exponential Moving Average
     */
    calculateEMA(prices: number[], period: number = 12): number[] {
        return EMA.calculate({ period, values: prices });
    }

    /**
     * Calculate RSI (Relative Strength Index)
     */
    calculateRSI(prices: number[], period: number = 14): number[] {
        return RSI.calculate({ period, values: prices });
    }

    /**
     * Calculate MACD
     */
    calculateMACD(prices: number[], config?: {
        fastPeriod?: number;
        slowPeriod?: number;
        signalPeriod?: number;
    }) {
        const { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = config || {};

        return MACD.calculate({
            values: prices,
            fastPeriod,
            slowPeriod,
            signalPeriod,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
        });
    }

    /**
     * Calculate Stochastic Oscillator
     */
    calculateStochastic(candles: CandleData[], period: number = 14, signalPeriod: number = 3) {
        const high = candles.map(c => c.high);
        const low = candles.map(c => c.low);
        const close = candles.map(c => c.close);

        return Stochastic.calculate({
            high,
            low,
            close,
            period,
            signalPeriod,
        });
    }

    /**
     * Calculate Bollinger Bands
     */
    calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
        const sma = this.calculateSMA(prices, period);
        const bands: Array<{ upper: number; middle: number; lower: number }> = [];

        for (let i = period - 1; i < prices.length; i++) {
            const slice = prices.slice(i - period + 1, i + 1);
            const mean = sma[i - period + 1];

            // Calculate standard deviation
            const squareDiffs = slice.map(value => Math.pow(value - mean, 2));
            const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / period;
            const stdDeviation = Math.sqrt(avgSquareDiff);

            bands.push({
                upper: mean + (stdDev * stdDeviation),
                middle: mean,
                lower: mean - (stdDev * stdDeviation),
            });
        }

        return bands;
    }

    /**
     * Store calculated indicators in database
     */
    async storeIndicators(stockId: string, timeframe: string, candles: CandleData[]) {
        const closes = candles.map(c => c.close);
        const timestamps = candles.map(c => c.timestamp);

        // Calculate all indicators
        const sma20 = this.calculateSMA(closes, 20);
        const sma50 = this.calculateSMA(closes, 50);
        const ema12 = this.calculateEMA(closes, 12);
        const rsi = this.calculateRSI(closes, 14);
        const macd = this.calculateMACD(closes);
        const stoch = this.calculateStochastic(candles);

        // Store SMA
        for (let i = 0; i < sma20.length; i++) {
            await prisma.indicator.upsert({
                where: {
                    stockId_type_timeframe_timestamp: {
                        stockId,
                        type: 'SMA_20',
                        timeframe,
                        timestamp: timestamps[i + 19], // offset by period
                    },
                },
                update: {
                    values: { value: sma20[i] },
                },
                create: {
                    stockId,
                    type: 'SMA_20',
                    timeframe,
                    timestamp: timestamps[i + 19],
                    values: { value: sma20[i] },
                },
            });
        }

        // Store RSI with signals
        for (let i = 0; i < rsi.length; i++) {
            const rsiValue = rsi[i];
            let signal = 'HOLD';
            let signalStrength = 50;

            if (rsiValue > 70) {
                signal = 'SELL';
                signalStrength = Math.min(100, 50 + (rsiValue - 70) * 1.5);
            } else if (rsiValue < 30) {
                signal = 'BUY';
                signalStrength = Math.min(100, 50 + (30 - rsiValue) * 1.5);
            }

            await prisma.indicator.upsert({
                where: {
                    stockId_type_timeframe_timestamp: {
                        stockId,
                        type: 'RSI',
                        timeframe,
                        timestamp: timestamps[i + 13], // offset by period
                    },
                },
                update: {
                    values: { value: rsiValue },
                    signal,
                    signalStrength,
                },
                create: {
                    stockId,
                    type: 'RSI',
                    timeframe,
                    timestamp: timestamps[i + 13],
                    values: { value: rsiValue },
                    signal,
                    signalStrength,
                },
            });
        }

        // Store MACD
        for (let i = 0; i < macd.length; i++) {
            const macdData = macd[i];
            if (!macdData) continue;

            let signal = 'HOLD';
            if ((macdData as any)?.MACD > (macdData as any)?.signal) {
                signal = 'BUY';
            } else if ((macdData as any)?.MACD < (macdData as any)?.signal) {
                signal = 'SELL';
            }

            await prisma.indicator.upsert({
                where: {
                    stockId_type_timeframe_timestamp: {
                        stockId,
                        type: 'MACD',
                        timeframe,
                        timestamp: timestamps[i + 25], // offset
                    },
                },
                update: {
                    values: {
                        macd: macdData.MACD,
                        signal: macdData.signal,
                        histogram: macdData.histogram,
                    },
                    signal,
                },
                create: {
                    stockId,
                    type: 'MACD',
                    timeframe,
                    timestamp: timestamps[i + 25],
                    values: {
                        macd: macdData.MACD,
                        signal: macdData.signal,
                        histogram: macdData.histogram,
                    },
                    signal,
                },
            });
        }

        return {
            sma20Count: sma20.length,
            rsiCount: rsi.length,
            macdCount: macd.length,
        };
    }

    /**
     * Get latest indicators for a stock
     */
    async getLatestIndicators(stockId: string, timeframe: string = '1d') {
        const indicators = await prisma.indicator.findMany({
            where: {
                stockId,
                timeframe,
            },
            orderBy: {
                timestamp: 'desc',
            },
            take: 1,
            distinct: ['type'],
        });

        return indicators.reduce((acc, ind) => {
            acc[ind.type] = {
                value: ind.values,
                signal: ind.signal,
                signalStrength: ind.signalStrength,
                timestamp: ind.timestamp,
            };
            return acc;
        }, {} as Record<string, any>);
    }

    /**
     * Generate trading signal based on multiple indicators
     */
    async generateTradingSignal(stockId: string, timeframe: string = '1d') {
        const indicators = await this.getLatestIndicators(stockId, timeframe);

        const signals = {
            rsi: indicators['RSI']?.signal || 'HOLD',
            macd: indicators['MACD']?.signal || 'HOLD',
        };

        // Simple consensus logic
        let overallSignal = 'HOLD';
        let strength = 50;

        if (signals.rsi === 'BUY' && signals.macd === 'BUY') {
            overallSignal = 'STRONG_BUY';
            strength = 80;
        } else if (signals.rsi === 'BUY' || signals.macd === 'BUY') {
            overallSignal = 'BUY';
            strength = 65;
        } else if (signals.rsi === 'SELL' && signals.macd === 'SELL') {
            overallSignal = 'STRONG_SELL';
            strength = 80;
        } else if (signals.rsi === 'SELL' || signals.macd === 'SELL') {
            overallSignal = 'SELL';
            strength = 65;
        }

        return {
            signal: overallSignal,
            strength,
            indicators: signals,
            timestamp: new Date(),
        };
    }
}
