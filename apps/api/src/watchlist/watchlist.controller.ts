import {
    Controller,
    Get,
    Post,
    Delete,
    Patch,
    Param,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WatchlistService } from './watchlist.service';

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
    constructor(private readonly watchlistService: WatchlistService) { }

    @Get()
    async getWatchlist(@Request() req: any) {
        return this.watchlistService.findAll(req.user.userId);
    }

    @Post(':stockId')
    async addToWatchlist(
        @Request() req: any,
        @Param('stockId') stockId: string,
        @Body() body: { note?: string },
    ) {
        return this.watchlistService.addToWatchlist(
            req.user.userId,
            stockId,
            body.note,
        );
    }

    @Delete(':stockId')
    async removeFromWatchlist(
        @Request() req: any,
        @Param('stockId') stockId: string,
    ) {
        await this.watchlistService.removeFromWatchlist(req.user.userId, stockId);
        return { success: true };
    }

    @Get(':stockId/check')
    async checkWatchlist(
        @Request() req: any,
        @Param('stockId') stockId: string,
    ) {
        const inWatchlist = await this.watchlistService.isInWatchlist(
            req.user.userId,
            stockId,
        );
        return { inWatchlist };
    }

    @Patch(':stockId/note')
    async updateNote(
        @Request() req: any,
        @Param('stockId') stockId: string,
        @Body() body: { note: string },
    ) {
        return this.watchlistService.updateNote(
            req.user.userId,
            stockId,
            body.note,
        );
    }
}
