import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, Portfolio, Position, Prisma } from '@stockboom/database';
import { MarketDataService } from '../market-data/market-data.service';

@Injectable()
export class PortfoliosService {
    constructor(private marketDataService: MarketDataService) { }

    async findAll(userId: string): Promise<Portfolio[]> {
        return prisma.portfolio.findMany({
            where: { userId },
            include: {
                brokerAccount: true,
                positions: {
                    include: {
                        stock: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string, userId: string): Promise<Portfolio> {
        const portfolio = await prisma.portfolio.findFirst({
            where: { id, userId },
            include: {
                brokerAccount: true,
                positions: {
                    include: {
                        stock: true,
                    },
                },
                strategies: true,
            },
        });

        if (!portfolio) {
            throw new NotFoundException('Portfolio not found');
        }

        return portfolio;
    }

    async create(userId: string, data: {
        name: string;
        description?: string;
        brokerAccountId: string;
        cashBalance: number;
    }): Promise<Portfolio> {
        // Verify broker account belongs to user
        const brokerAccount = await prisma.brokerAccount.findFirst({
            where: { id: data.brokerAccountId, userId },
        });

        if (!brokerAccount) {
            throw new BadRequestException('Invalid broker account');
        }

        return prisma.portfolio.create({
            data: {
                userId,
                name: data.name,
                description: data.description,
                brokerAccountId: data.brokerAccountId,
                cashBalance: data.cashBalance,
                totalValue: data.cashBalance,
                totalReturn: 0,
                totalReturnPct: 0,
            },
            include: {
                brokerAccount: true,
            },
        });
    }

    async update(id: string, userId: string, data: Prisma.PortfolioUpdateInput): Promise<Portfolio> {
        // Verify ownership
        await this.findOne(id, userId);

        return prisma.portfolio.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, userId: string): Promise<Portfolio> {
        // Verify ownership
        await this.findOne(id, userId);

        return prisma.portfolio.delete({
            where: { id },
        });
    }

    /**
     * Calculate and update portfolio valuation
     */
    async calculateValuation(portfolioId: string, userId: string) {
        const portfolio = await this.findOne(portfolioId, userId);

        let totalPositionValue = 0;

        // Update each position with current price
        for (const position of (portfolio as any).positions) {
            const quote = await this.marketDataService.getQuote(
                position.stock.symbol,
                position.stock.market,
            );

            const currentPrice = quote.data.currentPrice;
            const marketValue = currentPrice * position.quantity;
            const unrealizedPL = marketValue - position.totalCost;
            const unrealizedPLPct = (unrealizedPL / position.totalCost) * 100;

            // Update position
            await prisma.position.update({
                where: { id: position.id },
                data: {
                    currentPrice,
                    marketValue,
                    unrealizedPL,
                    unrealizedPLPct,
                },
            });

            totalPositionValue += marketValue;
        }

        // Update portfolio
        const totalValue = portfolio.cashBalance.add(totalPositionValue);
        const initialValue = portfolio.cashBalance; // This should track initial capital
        const totalReturn = totalValue.sub(initialValue);
        const totalReturnPct = totalReturn.div(initialValue).mul(100);

        return prisma.portfolio.update({
            where: { id: portfolioId },
            data: {
                totalValue,
                totalReturn,
                totalReturnPct,
                lastSyncedAt: new Date(),
            },
            include: {
                positions: {
                    include: {
                        stock: true,
                    },
                },
            },
        });
    }

    /**
     * Add a position to portfolio
     */
    async addPosition(portfolioId: string, userId: string, data: {
        stockId: string;
        quantity: number;
        avgPrice: number;
    }): Promise<Position> {
        // Verify ownership
        await this.findOne(portfolioId, userId);

        const stock = await prisma.stock.findUnique({
            where: { id: data.stockId },
        });

        if (!stock) {
            throw new NotFoundException('Stock not found');
        }

        // Get current price
        const quote = await this.marketDataService.getQuote(stock.symbol, stock.market);
        const currentPrice = quote.data.currentPrice;

        const totalCost = data.avgPrice * data.quantity;
        const marketValue = currentPrice * data.quantity;
        const unrealizedPL = marketValue - totalCost;
        const unrealizedPLPct = (unrealizedPL / totalCost) * 100;

        // Check if position already exists
        const existingPosition = await prisma.position.findUnique({
            where: {
                portfolioId_stockId: {
                    portfolioId,
                    stockId: data.stockId,
                },
            },
        });

        if (existingPosition) {
            // Update existing position (average price)
            const newQuantity = existingPosition.quantity + data.quantity;
            const newTotalCost = existingPosition.totalCost.add(totalCost);
            const newAvgPrice = newTotalCost.div(newQuantity);

            return prisma.position.update({
                where: { id: existingPosition.id },
                data: {
                    quantity: newQuantity,
                    avgPrice: newAvgPrice,
                    totalCost: newTotalCost,
                    currentPrice,
                    marketValue: currentPrice * newQuantity,
                    unrealizedPL: new Prisma.Decimal(currentPrice).mul(newQuantity).sub(newTotalCost),
                    unrealizedPLPct: new Prisma.Decimal(currentPrice).mul(newQuantity).sub(newTotalCost).div(newTotalCost).mul(100),
                },
                include: {
                    stock: true,
                },
            });
        }

        return prisma.position.create({
            data: {
                portfolioId,
                stockId: data.stockId,
                quantity: data.quantity,
                avgPrice: data.avgPrice,
                currentPrice,
                totalCost,
                marketValue,
                unrealizedPL,
                unrealizedPLPct,
            },
            include: {
                stock: true,
            },
        });
    }

    /**
     * Sync portfolio from broker account
     * Fetches real-time data from broker API and updates portfolio
     */
    async syncFromBroker(portfolioId: string, userId: string) {
        const portfolio = await this.findOne(portfolioId, userId);

        try {
            // Get broker account with credentials
            const brokerAccount = await prisma.brokerAccount.findUnique({
                where: { id: portfolio.brokerAccountId },
            });

            if (!brokerAccount || !brokerAccount.isActive) {
                throw new BadRequestException('Broker account not active');
            }

            // Sync balance and positions from broker API
            const syncData = await this.marketDataService.getPortfolioData(
                brokerAccount.broker,
                brokerAccount.id,
            );

            // Update cash balance if changed
            if (syncData.cashBalance !== undefined) {
                await prisma.portfolio.update({
                    where: { id: portfolioId },
                    data: { cashBalance: syncData.cashBalance },
                });
            }

            // Sync positions
            if (syncData.positions && syncData.positions.length > 0) {
                for (const brokerPosition of syncData.positions) {
                    // Find or create stock
                    let stock = await prisma.stock.findUnique({
                        where: { symbol: brokerPosition.symbol },
                    });

                    if (!stock) {
                        // Create new stock entry
                        stock = await prisma.stock.create({
                            data: {
                                symbol: brokerPosition.symbol,
                                name: brokerPosition.name || brokerPosition.symbol,
                                market: brokerPosition.market || 'KOSPI',
                                currentPrice: brokerPosition.currentPrice,
                            },
                        });
                    }

                    // Update or create position
                    const existingPosition = await prisma.position.findUnique({
                        where: {
                            portfolioId_stockId: {
                                portfolioId,
                                stockId: stock.id,
                            },
                        },
                    });

                    const totalCost = brokerPosition.avgPrice * brokerPosition.quantity;
                    const marketValue = brokerPosition.currentPrice * brokerPosition.quantity;
                    const unrealizedPL = marketValue - totalCost;
                    const unrealizedPLPct = (unrealizedPL / totalCost) * 100;

                    if (existingPosition) {
                        // Update existing position
                        await prisma.position.update({
                            where: { id: existingPosition.id },
                            data: {
                                quantity: brokerPosition.quantity,
                                avgPrice: brokerPosition.avgPrice,
                                currentPrice: brokerPosition.currentPrice,
                                totalCost,
                                marketValue,
                                unrealizedPL,
                                unrealizedPLPct,
                            },
                        });
                    } else {
                        // Create new position
                        await prisma.position.create({
                            data: {
                                portfolioId,
                                stockId: stock.id,
                                quantity: brokerPosition.quantity,
                                avgPrice: brokerPosition.avgPrice,
                                currentPrice: brokerPosition.currentPrice,
                                totalCost,
                                marketValue,
                                unrealizedPL,
                                unrealizedPLPct,
                            },
                        });
                    }
                }

                // Remove positions that no longer exist in broker account
                const brokerSymbols = syncData.positions.map(p => p.symbol);
                const currentPositions = await prisma.position.findMany({
                    where: { portfolioId },
                    include: { stock: true },
                });

                for (const position of currentPositions) {
                    if (!brokerSymbols.includes(position.stock.symbol)) {
                        await prisma.position.delete({
                            where: { id: position.id },
                        });
                    }
                }
            }

            // Update portfolio timestamp
            await prisma.portfolio.update({
                where: { id: portfolioId },
                data: { lastSyncedAt: new Date() },
            });

            // Recalculate valuation
            return this.calculateValuation(portfolioId, userId);

        } catch (error) {
            throw new BadRequestException(`Failed to sync portfolio: ${error.message}`);
        }
    }
}
