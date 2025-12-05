import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, Watchlist, Stock } from '@stockboom/database';

@Injectable()
export class WatchlistService {
    async findAll(userId: string): Promise<(Watchlist & { stock: Stock })[]> {
        return prisma.watchlist.findMany({
            where: { userId },
            include: {
                stock: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async addToWatchlist(userId: string, stockId: string, note?: string): Promise<Watchlist> {
        // Check if stock exists
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
        });

        if (!stock) {
            throw new NotFoundException('Stock not found');
        }

        // Check if already in watchlist
        const existing = await prisma.watchlist.findUnique({
            where: {
                userId_stockId: {
                    userId,
                    stockId,
                },
            },
        });

        if (existing) {
            throw new ConflictException('Stock already in watchlist');
        }

        return prisma.watchlist.create({
            data: {
                userId,
                stockId,
                note,
            },
        });
    }

    async removeFromWatchlist(userId: string, stockId: string): Promise<void> {
        const watchlistItem = await prisma.watchlist.findUnique({
            where: {
                userId_stockId: {
                    userId,
                    stockId,
                },
            },
        });

        if (!watchlistItem) {
            throw new NotFoundException('Stock not in watchlist');
        }

        await prisma.watchlist.delete({
            where: {
                userId_stockId: {
                    userId,
                    stockId,
                },
            },
        });
    }

    async isInWatchlist(userId: string, stockId: string): Promise<boolean> {
        const item = await prisma.watchlist.findUnique({
            where: {
                userId_stockId: {
                    userId,
                    stockId,
                },
            },
        });

        return !!item;
    }

    async updateNote(userId: string, stockId: string, note: string): Promise<Watchlist> {
        const watchlistItem = await prisma.watchlist.findUnique({
            where: {
                userId_stockId: {
                    userId,
                    stockId,
                },
            },
        });

        if (!watchlistItem) {
            throw new NotFoundException('Stock not in watchlist');
        }

        return prisma.watchlist.update({
            where: {
                userId_stockId: {
                    userId,
                    stockId,
                },
            },
            data: { note },
        });
    }
}
