import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma, Stock, Prisma } from '@stockboom/database';
import { MarketDataService } from '../market-data/market-data.service';

@Injectable()
export class StocksService {
    private readonly logger = new Logger(StocksService.name);

    constructor(private marketDataService: MarketDataService) { }

    async findAll(params?: {
        skip?: number;
        take?: number;
        where?: Prisma.StockWhereInput;
        orderBy?: Prisma.StockOrderByWithRelationInput;
    }): Promise<Stock[]> {
        const { skip, take, where, orderBy } = params || {};
        return prisma.stock.findMany({
            skip,
            take,
            where,
            orderBy,
        });
    }

    async findOne(id: string): Promise<Stock> {
        const stock = await prisma.stock.findUnique({
            where: { id },
            include: {
                candles: {
                    take: 100,
                    orderBy: { timestamp: 'desc' },
                },
                indicators: {
                    take: 10,
                    orderBy: { timestamp: 'desc' },
                },
            },
        });

        if (!stock) {
            throw new NotFoundException(`Stock with ID ${id} not found`);
        }

        return stock;
    }

    async findBySymbol(symbol: string): Promise<Stock> {
        const stock = await prisma.stock.findUnique({
            where: { symbol },
        });

        if (!stock) {
            throw new NotFoundException(`Stock with symbol ${symbol} not found`);
        }

        return stock;
    }

    async getQuote(symbol: string) {
        try {
            const stock = await this.findBySymbol(symbol);
            const quote = await this.marketDataService.updateStockPrice(symbol, stock.market);
            return quote;
        } catch (error) {
            this.logger.error(`Failed to get quote for ${symbol}`, error);
            throw error;
        }
    }

    async searchStocks(query: string) {
        // First search in database
        const dbResults = await prisma.stock.findMany({
            where: {
                OR: [
                    { symbol: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: 10,
        });

        // Also search via Yahoo Finance for new stocks
        const yahooResults = await this.marketDataService.searchStocks(query);

        return {
            database: dbResults,
            external: yahooResults,
        };
    }

    async create(data: Prisma.StockCreateInput): Promise<Stock> {
        return prisma.stock.create({ data });
    }

    async update(id: string, data: Prisma.StockUpdateInput): Promise<Stock> {
        return prisma.stock.update({
            where: { id },
            data,
        });
    }

    async delete(id: string): Promise<Stock> {
        return prisma.stock.delete({
            where: { id },
        });
    }
}
