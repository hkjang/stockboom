import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PortfoliosService } from './portfolios.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePortfolioDto, UpdatePortfolioDto, AddPositionDto } from './dto/portfolio.dto';

@ApiTags('portfolios')
@Controller('portfolios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortfoliosController {
    constructor(private portfoliosService: PortfoliosService) { }

    @Get()
    @ApiOperation({ summary: 'Get all user portfolios' })
    async findAll(@Request() req) {
        return this.portfoliosService.findAll(req.user.userId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get portfolio by ID' })
    async findOne(@Param('id') id: string, @Request() req) {
        return this.portfoliosService.findOne(id, req.user.userId);
    }

    @Post()
    @ApiOperation({ summary: 'Create new portfolio' })
    @ApiResponse({ status: 201, description: 'Portfolio created' })
    async create(@Body() createDto: CreatePortfolioDto, @Request() req) {
        return this.portfoliosService.create(req.user.userId, createDto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update portfolio' })
    async update(
        @Param('id') id: string,
        @Body() updateDto: UpdatePortfolioDto,
        @Request() req,
    ) {
        return this.portfoliosService.update(id, req.user.userId, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete portfolio' })
    async delete(@Param('id') id: string, @Request() req) {
        return this.portfoliosService.delete(id, req.user.userId);
    }

    @Post(':id/valuation')
    @ApiOperation({ summary: 'Calculate portfolio valuation' })
    async calculateValuation(@Param('id') id: string, @Request() req) {
        return this.portfoliosService.calculateValuation(id, req.user.userId);
    }

    @Post(':id/positions')
    @ApiOperation({ summary: 'Add position to portfolio' })
    async addPosition(
        @Param('id') id: string,
        @Body() addPositionDto: AddPositionDto,
        @Request() req,
    ) {
        return this.portfoliosService.addPosition(id, req.user.userId, addPositionDto);
    }

    @Post(':id/sync')
    @ApiOperation({ summary: 'Sync portfolio from broker' })
    async syncFromBroker(@Param('id') id: string, @Request() req) {
        return this.portfoliosService.syncFromBroker(id, req.user.userId);
    }
}
