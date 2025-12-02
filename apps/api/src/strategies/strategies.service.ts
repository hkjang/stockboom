import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Strategy, StrategyType, Prisma } from '@stockboom/database';
import { IndicatorsService } from '../analysis/indicators.service';

@Injectable()
export class StrategiesService {
    constructor(private indicatorsService: IndicatorsService) { }

    async findAll(userId: string): Promise<Strategy[]> {
        return prisma.strategy.findMany({
            where: { userId },
            include: {
                portfolio: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string, userId: string): Promise<Strategy> {
        const strategy = await prisma.strategy.findFirst({
            where: { id, userId },
            include: {
                portfolio: true,
                trades: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!strategy) {
            throw new NotFoundException('Strategy not found');
        }

        return strategy;
    }

    async create(userId: string, data: {
        name: string;
        description?: string;
        type: StrategyType;
        config: any;
        portfolioId?: string;
        stopLossPercent?: number;
        takeProfitPercent?: number;
        maxPositionSize?: number;
    }): Promise<Strategy> {
        return prisma.strategy.create({
            data: {
                userId,
                name: data.name,
                description: data.description,
                type: data.type,
                config: data.config,
                portfolioId: data.portfolioId,
                stopLossPercent: data.stopLossPercent,
                takeProfitPercent: data.takeProfitPercent,
                maxPositionSize: data.maxPositionSize,
            },
        });
    }

    async update(id: string, userId: string, data: Prisma.StrategyUpdateInput): Promise<Strategy> {
        // Verify ownership
        await this.findOne(id, userId);

        return prisma.strategy.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, userId: string): Promise<Strategy> {
        // Verify ownership
        await this.findOne(id, userId);

        return prisma.strategy.delete({
            where: { id },
        });
    }

    /**
     * Evaluate if strategy conditions are met for a stock
     */
    async evaluateStrategy(strategyId: string, stockId: string): Promise<{
        shouldTrade: boolean;
        signal: 'BUY' | 'SELL' | 'HOLD';
        reason: string;
    }> {
        const strategy = await prisma.strategy.findUnique({
            where: { id: strategyId },
        });

        if (!strategy || !strategy.isActive) {
            return { shouldTrade: false, signal: 'HOLD', reason: 'Strategy inactive' };
        }

        const config = strategy.config as any;

        // Indicator-based strategy
        if (strategy.type === 'INDICATOR_BASED') {
            const indicators = await this.indicatorsService.getLatestIndicators(stockId);

            // Simple RSI strategy
            if (config.indicator === 'RSI') {
                const rsi = indicators['RSI']?.value?.value;

                if (!rsi) {
                    return { shouldTrade: false, signal: 'HOLD', reason: 'No RSI data' };
                }

                const oversold = config.oversold || 30;
                const overbought = config.overbought || 70;

                if (rsi < oversold) {
                    return { shouldTrade: true, signal: 'BUY', reason: `RSI ${rsi} < ${oversold}` };
                } else if (rsi > overbought) {
                    return { shouldTrade: true, signal: 'SELL', reason: `RSI ${rsi} > ${overbought}` };
                }
            }

            // MACD strategy
            if (config.indicator === 'MACD') {
                const macd = indicators['MACD'];

                if (!macd) {
                    return { shouldTrade: false, signal: 'HOLD', reason: 'No MACD data' };
                }

                if (macd.signal === 'BUY') {
                    return { shouldTrade: true, signal: 'BUY', reason: 'MACD bullish crossover' };
                } else if (macd.signal === 'SELL') {
                    return { shouldTrade: true, signal: 'SELL', reason: 'MACD bearish crossover' };
                }
            }
        }

        // AI-based strategy
        if (strategy.type === 'AI_BASED') {
            const signal = await this.indicatorsService.generateTradingSignal(stockId);

            if (signal.strength >= (config.minStrength || 70)) {
                return {
                    shouldTrade: true,
                    signal: signal.signal.includes('BUY') ? 'BUY' :
                        signal.signal.includes('SELL') ? 'SELL' : 'HOLD',
                    reason: `AI signal: ${signal.signal} (${signal.strength}%)`,
                };
            }
        }

        return { shouldTrade: false, signal: 'HOLD', reason: 'Conditions not met' };
    }

    /**
     * Backtest strategy on historical data
     */
    async backtestStrategy(strategyId: string, userId: string, params: {
        stockId: string;
        startDate: Date;
        endDate: Date;
        initialCapital: number;
    }) {
        // Verify ownership
        await this.findOne(strategyId, userId);

        const { stockId, startDate, endDate, initialCapital } = params;

        // Get historical candles
        const candles = await prisma.candle.findMany({
            where: {
                stockId,
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
                timeframe: '1d',
            },
            orderBy: { timestamp: 'asc' },
        });

        if (candles.length === 0) {
            throw new Error('No historical data available');
        }

        // Simple backtest simulation
        let capital = initialCapital;
        let position = 0;
        let positionPrice = 0;
        const trades = [];

        for (const candle of candles) {
            const evaluation = await this.evaluateStrategy(strategyId, stockId);
            const price = Number(candle.close);

            if (evaluation.shouldTrade) {
                if (evaluation.signal === 'BUY' && position === 0) {
                    // Buy
                    const quantity = Math.floor(capital / price);
                    if (quantity > 0) {
                        position = quantity;
                        positionPrice = price;
                        capital -= quantity * price;
                        trades.push({
                            date: candle.timestamp,
                            type: 'BUY',
                            price,
                            quantity,
                            reason: evaluation.reason,
                        });
                    }
                } else if (evaluation.signal === 'SELL' && position > 0) {
                    // Sell
                    const sellValue = position * price;
                    capital += sellValue;
                    const profit = (price - positionPrice) * position;
                    trades.push({
                        date: candle.timestamp,
                        type: 'SELL',
                        price,
                        quantity: position,
                        profit,
                        reason: evaluation.reason,
                    });
                    position = 0;
                    positionPrice = 0;
                }
            }
        }

        // Close any remaining position
        if (position > 0) {
            const lastPrice = Number(candles[candles.length - 1].close);
            capital += position * lastPrice;
            position = 0;
        }

        const totalReturn = capital - initialCapital;
        const returnPct = (totalReturn / initialCapital) * 100;
        const winningTrades = trades.filter(t => t.type === 'SELL' && t.profit > 0).length;
        const losingTrades = trades.filter(t => t.type === 'SELL' && t.profit < 0).length;
        const winRate = winningTrades / (winningTrades + losingTrades) * 100;

        return {
            initialCapital,
            finalCapital: capital,
            totalReturn,
            returnPct,
            trades: trades.length,
            winningTrades,
            losingTrades,
            winRate: isNaN(winRate) ? 0 : winRate,
            tradeHistory: trades,
        };
    }
}
