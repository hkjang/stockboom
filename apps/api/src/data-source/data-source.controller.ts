import { Controller, Get, Put, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataSourceService } from './data-source.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('DataSource')
@Controller('data-sources')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DataSourceController {
    constructor(private dataSourceService: DataSourceService) { }

    @Get()
    @ApiOperation({ summary: 'Get all data source configurations' })
    async getAllConfigs() {
        return this.dataSourceService.getAllConfigs();
    }

    @Get(':metricType')
    @ApiOperation({ summary: 'Get data source configuration for a metric type' })
    async getConfig(@Param('metricType') metricType: string) {
        return this.dataSourceService.getConfig(metricType);
    }

    @Put(':metricType')
    @ApiOperation({ summary: 'Update data source configuration' })
    async updateConfig(
        @Param('metricType') metricType: string,
        @Body() data: {
            primarySource?: string;
            fallbackSources?: string[];
            isActive?: boolean;
            config?: any;
        }
    ) {
        return this.dataSourceService.updateConfig(metricType, data);
    }

    @Post('initialize')
    @ApiOperation({ summary: 'Initialize default configurations' })
    async initializeDefaults() {
        await this.dataSourceService.initializeDefaults();
        return { success: true };
    }
}
