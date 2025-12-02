import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAlertDto, UpdateAlertDto } from './dto/alert.dto';

@ApiTags('alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AlertsController {
    constructor(private alertsService: AlertsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all user alerts' })
    async findAll(@Request() req) {
        return this.alertsService.findAll(req.user.userId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get alert by ID' })
    async findOne(@Param('id') id: string, @Request() req) {
        return this.alertsService.findOne(id, req.user.userId);
    }

    @Post()
    @ApiOperation({ summary: 'Create new alert' })
    async create(@Body() createDto: CreateAlertDto, @Request() req) {
        return this.alertsService.create(req.user.userId, createDto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update alert' })
    async update(
        @Param('id') id: string,
        @Body() updateDto: UpdateAlertDto,
        @Request() req,
    ) {
        return this.alertsService.update(id, req.user.userId, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete alert' })
    async delete(@Param('id') id: string, @Request() req) {
        return this.alertsService.delete(id, req.user.userId);
    }
}
