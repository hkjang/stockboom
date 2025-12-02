import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StrategiesService } from './strategies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateStrategyDto, UpdateStrategyDto, BacktestDto } from './dto/strategy.dto';

@ApiTags('strategies')
@Controller('strategies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StrategiesController {
    constructor(private strategiesService: StrategiesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all user strategies' })
    async findAll(@Request() req) {
        return this.strategiesService.findAll(req.user.userId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get strategy by ID' })
    async findOne(@Param('id') id: string, @Request() req) {
        return this.strategiesService.findOne(id, req.user.userId);
    }

    @Post()
    @ApiOperation({ summary: 'Create new strategy' })
    async create(@Body() createDto: CreateStrategyDto, @Request() req) {
        return this.strategiesService.create(req.user.userId, createDto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update strategy' })
    async update(
        @Param('id') id: string,
        @Body() updateDto: UpdateStrategyDto,
        @Request() req,
    ) {
        return this.strategiesService.update(id, req.user.userId, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete strategy' })
    async delete(@Param('id') id: string, @Request() req) {
        return this.strategiesService.delete(id, req.user.userId);
    }

    @Post(':id/backtest')
    @ApiOperation({ summary: 'Backtest strategy on historical data' })
    async backtest(
        @Param('id') id: string,
        @Body() backtestDto: BacktestDto,
        @Request() req,
    ) {
        return this.strategiesService.backtestStrategy(id, req.user.userId, backtestDto);
    }

    @Post(':id/evaluate/:stockId')
    @ApiOperation({ summary: 'Evaluate strategy for a stock' })
    async evaluate(
        @Param('id') id: string,
        @Param('stockId') stockId: string,
    ) {
        return this.strategiesService.evaluateStrategy(id, stockId);
    }
}
