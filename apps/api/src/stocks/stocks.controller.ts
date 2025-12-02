import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StocksService } from './stocks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketDataService } from '../market-data/market-data.service';

@ApiTags('stocks')
@Controller('stocks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StocksController {
    constructor(
        private stocksService: StocksService,
        private marketDataService: MarketDataService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all stocks' })
    @ApiQuery({ name: 'market', required: false })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @Query('market') market?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        const skip = page && limit ? (page - 1) * limit : undefined;
        const take = limit || 100;

        return this.stocksService.findAll({
            skip,
            take,
            where: market ? { market } : undefined,
            orderBy: { name: 'asc' },
        });
    }

    @Get('search')
    @ApiOperation({ summary: 'Search stocks by symbol or name' })
    @ApiQuery({ name: 'q', required: true })
    async search(@Query('q') query: string) {
        return this.stocksService.searchStocks(query);
    }

    @Get('market-indices')
    @ApiOperation({ summary: 'Get market indices' })
    async getMarketIndices() {
        return this.marketDataService.getMarketIndices();
    }

    @Get(':symbol/quote')
    @ApiOperation({ summary: 'Get current quote for a stock' })
    async getQuote(@Param('symbol') symbol: string) {
        return this.stocksService.getQuote(symbol);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get stock by ID' })
    async findOne(@Param('id') id: string) {
        return this.stocksService.findOne(id);
    }
}
