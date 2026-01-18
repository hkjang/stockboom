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
     * Calculate ATR (Average True Range) - 변동성 지표
     */
    calculateATR(candles: CandleData[], period: number = 14): number[] {
        if (candles.length < 2) return [];

        const trueRanges: number[] = [];
        
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;
            
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);
        }

        // Calculate ATR using EMA of True Range
        return this.calculateEMA(trueRanges, period);
    }

    /**
     * Calculate ADX (Average Directional Index) - 추세 강도 지표
     */
    calculateADX(candles: CandleData[], period: number = 14): { adx: number[]; plusDI: number[]; minusDI: number[] } {
        if (candles.length < period + 1) return { adx: [], plusDI: [], minusDI: [] };

        const plusDMs: number[] = [];
        const minusDMs: number[] = [];
        const trs: number[] = [];

        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevHigh = candles[i - 1].high;
            const prevLow = candles[i - 1].low;
            const prevClose = candles[i - 1].close;

            const plusDM = Math.max(0, high - prevHigh);
            const minusDM = Math.max(0, prevLow - low);
            
            if (plusDM > minusDM) {
                plusDMs.push(plusDM);
                minusDMs.push(0);
            } else if (minusDM > plusDM) {
                plusDMs.push(0);
                minusDMs.push(minusDM);
            } else {
                plusDMs.push(0);
                minusDMs.push(0);
            }

            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            trs.push(tr);
        }

        const smoothedTR = this.calculateEMA(trs, period);
        const smoothedPlusDM = this.calculateEMA(plusDMs, period);
        const smoothedMinusDM = this.calculateEMA(minusDMs, period);

        const plusDI: number[] = [];
        const minusDI: number[] = [];
        const dx: number[] = [];

        for (let i = 0; i < smoothedTR.length; i++) {
            const pdi = smoothedTR[i] !== 0 ? (smoothedPlusDM[i] / smoothedTR[i]) * 100 : 0;
            const mdi = smoothedTR[i] !== 0 ? (smoothedMinusDM[i] / smoothedTR[i]) * 100 : 0;
            plusDI.push(pdi);
            minusDI.push(mdi);
            
            const dxVal = (pdi + mdi) !== 0 ? Math.abs(pdi - mdi) / (pdi + mdi) * 100 : 0;
            dx.push(dxVal);
        }

        const adx = this.calculateEMA(dx, period);
        return { adx, plusDI, minusDI };
    }

    /**
     * Calculate VWAP (Volume Weighted Average Price)
     */
    calculateVWAP(candles: CandleData[]): number[] {
        const vwap: number[] = [];
        let cumulativeTPV = 0;
        let cumulativeVolume = 0;

        for (const candle of candles) {
            const typicalPrice = (candle.high + candle.low + candle.close) / 3;
            cumulativeTPV += typicalPrice * candle.volume;
            cumulativeVolume += candle.volume;
            vwap.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice);
        }

        return vwap;
    }

    /**
     * Calculate Williams %R
     */
    calculateWilliamsR(candles: CandleData[], period: number = 14): number[] {
        const result: number[] = [];

        for (let i = period - 1; i < candles.length; i++) {
            const slice = candles.slice(i - period + 1, i + 1);
            const highestHigh = Math.max(...slice.map(c => c.high));
            const lowestLow = Math.min(...slice.map(c => c.low));
            const close = candles[i].close;

            const wr = ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
            result.push(wr);
        }

        return result;
    }

    /**
     * Calculate OBV (On-Balance Volume)
     */
    calculateOBV(candles: CandleData[]): number[] {
        const obv: number[] = [0];

        for (let i = 1; i < candles.length; i++) {
            const prevOBV = obv[i - 1];
            const volume = candles[i].volume;
            const priceChange = candles[i].close - candles[i - 1].close;

            if (priceChange > 0) {
                obv.push(prevOBV + volume);
            } else if (priceChange < 0) {
                obv.push(prevOBV - volume);
            } else {
                obv.push(prevOBV);
            }
        }

        return obv;
    }

    /**
     * Calculate CCI (Commodity Channel Index)
     */
    calculateCCI(candles: CandleData[], period: number = 20): number[] {
        const result: number[] = [];
        const tps = candles.map(c => (c.high + c.low + c.close) / 3);
        const smaTPs = this.calculateSMA(tps, period);

        for (let i = period - 1; i < tps.length; i++) {
            const smaIndex = i - period + 1;
            const smaTP = smaTPs[smaIndex];
            const slice = tps.slice(i - period + 1, i + 1);
            
            const meanDeviation = slice.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
            const cci = meanDeviation !== 0 ? (tps[i] - smaTP) / (0.015 * meanDeviation) : 0;
            result.push(cci);
        }

        return result;
    }

    /**
     * Detect Golden Cross / Death Cross
     */
    detectCrossover(shortMA: number[], longMA: number[]): ('GOLDEN' | 'DEATH' | 'NONE')[] {
        const signals: ('GOLDEN' | 'DEATH' | 'NONE')[] = [];
        const minLen = Math.min(shortMA.length, longMA.length);

        for (let i = 1; i < minLen; i++) {
            const prevShort = shortMA[i - 1];
            const prevLong = longMA[i - 1];
            const currShort = shortMA[i];
            const currLong = longMA[i];

            if (prevShort <= prevLong && currShort > currLong) {
                signals.push('GOLDEN');
            } else if (prevShort >= prevLong && currShort < currLong) {
                signals.push('DEATH');
            } else {
                signals.push('NONE');
            }
        }

        return signals;
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
