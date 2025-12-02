import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TradesService } from './trades.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTradeDto } from './dto/trade.dto';
import { OrderStatus } from '@stockboom/database';

@ApiTags('trades')
@Controller('trades')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TradesController {
    constructor(private tradesService: TradesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all user trades' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
    async findAll(
        @Request() req,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('status') status?: OrderStatus,
    ) {
        const skip = page && limit ? (page - 1) * limit : undefined;
        const take = limit || 50;

        return this.tradesService.findAll(req.user.userId, {
            skip,
            take,
            status,
        });
    }

    @Get('statistics')
    @ApiOperation({ summary: 'Get trading statistics' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    async getStatistics(
        @Request() req,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.tradesService.getStatistics(req.user.userId, {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get trade by ID' })
    async findOne(@Param('id') id: string, @Request() req) {
        return this.tradesService.findOne(id, req.user.userId);
    }

    @Post()
    @ApiOperation({ summary: 'Create new trade order' })
    async create(@Body() createDto: CreateTradeDto, @Request() req) {
        return this.tradesService.create(req.user.userId, createDto);
    }

    @Put(':id/cancel')
    @ApiOperation({ summary: 'Cancel trade order' })
    async cancel(@Param('id') id: string, @Request() req) {
        return this.tradesService.cancelTrade(id, req.user.userId);
    }
}
