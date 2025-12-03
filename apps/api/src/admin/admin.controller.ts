import { Controller, Get, Patch, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { DataSourceService } from '../data-source/data-source.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { AdminGuard } from '../auth/guards/admin.guard'; // TODO: Implement admin role guard

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard) // TODO: Add AdminGuard
@ApiBearerAuth()
export class AdminController {
    constructor(
        private adminService: AdminService,
        private dataSourceService: DataSourceService,
    ) { }

    @Get('stats')
    @ApiOperation({ summary: 'Get system statistics' })
    async getStats() {
        return this.adminService.getSystemStats();
    }

    @Get('metrics')
    @ApiOperation({ summary: 'Get system metrics (CPU, memory, etc.)' })
    async getMetrics() {
        return this.adminService.getSystemMetrics();
    }

    @Get('queues')
    @ApiOperation({ summary: 'Get queue status' })
    async getQueues() {
        console.log('AdminController.getQueues called');
        return this.adminService.getQueueStatus();
    }

    @Get('users')
    @ApiOperation({ summary: 'Get all users' })
    async getUsers() {
        return this.adminService.getAllUsers();
    }

    @Patch('users/:userId')
    @ApiOperation({ summary: 'Update user' })
    async updateUser(
        @Param('userId') userId: string,
        @Body() body: { isActive?: boolean; name?: string; email?: string },
    ) {
        if (body.isActive !== undefined) {
            return this.adminService.updateUserStatus(userId, body.isActive);
        }
        return this.adminService.updateUser(userId, body);
    }

    @Delete('users/:userId')
    @ApiOperation({ summary: 'Delete user' })
    async deleteUser(@Param('userId') userId: string) {
        return this.adminService.deleteUser(userId);
    }

    @Post('users/:userId/reset-password')
    @ApiOperation({ summary: 'Reset user password' })
    async resetPassword(@Param('userId') userId: string) {
        return this.adminService.resetUserPassword(userId);
    }

    @Get('queues/:queueName/failed')
    @ApiOperation({ summary: 'Get failed jobs for a queue' })
    async getFailedJobs(
        @Param('queueName') queueName: string,
        @Query('limit') limit?: number,
    ) {
        return this.adminService.getFailedJobs(queueName, limit ? parseInt(limit as any) : 10);
    }

    @Post('queues/:queueName/jobs/:jobId/retry')
    @ApiOperation({ summary: 'Retry a failed job' })
    async retryJob(
        @Param('queueName') queueName: string,
        @Param('jobId') jobId: string,
    ) {
        return this.adminService.retryFailedJob(queueName, jobId);
    }

    @Delete('queues/:queueName/completed')
    @ApiOperation({ summary: 'Clear completed jobs from queue' })
    async clearCompleted(@Param('queueName') queueName: string) {
        return this.adminService.clearCompletedJobs(queueName);
    }

    @Get('stocks')
    @ApiOperation({ summary: 'Get all stocks' })
    async getStocks(
        @Query('skip') skip?: string,
        @Query('take') take?: string,
        @Query('search') search?: string,
    ) {
        return this.adminService.getAllStocks({
            skip: skip ? parseInt(skip) : undefined,
            take: take ? parseInt(take) : undefined,
            search,
        });
    }

    @Post('stocks/bulk')
    @ApiOperation({ summary: 'Bulk create stocks' })
    async bulkCreateStocks(@Body() data: { stocks: any[] }) {
        return this.adminService.bulkCreateStocks(data.stocks);
    }

    @Post('stocks/sync-opendart')
    @ApiOperation({ summary: 'Sync stocks from OpenDart' })
    async syncFromOpenDart(@Body() data: { corpCodes?: string[] }) {
        return this.adminService.syncStocksFromOpenDart(data.corpCodes);
    }

    @Delete('stocks/:stockId')
    @ApiOperation({ summary: 'Delete stock' })
    async deleteStock(@Param('stockId') stockId: string) {
        return this.adminService.deleteStock(stockId);
    }

    @Get('users/:userId/api-keys')
    @ApiOperation({ summary: 'Get user API keys (masked)' })
    async getUserApiKeys(@Param('userId') userId: string) {
        return this.adminService.getUserApiKeys(userId);
    }

    @Put('users/:userId/api-keys')
    @ApiOperation({ summary: 'Update user API keys' })
    async updateUserApiKeys(
        @Param('userId') userId: string,
        @Body() data: any
    ) {
        return this.adminService.updateUserApiKeys(userId, data);
    }

    @Delete('users/:userId/api-keys')
    @ApiOperation({ summary: 'Delete user API keys' })
    async deleteUserApiKeys(@Param('userId') userId: string) {
        return this.adminService.deleteUserApiKeys(userId);
    }

    // Data Sources Management
    @Get('data-sources')
    @ApiOperation({ summary: 'Get all data source configurations' })
    async getDataSources() {
        return this.dataSourceService.getAllConfigs();
    }

    @Put('data-sources/:metricType')
    @ApiOperation({ summary: 'Update data source configuration' })
    async updateDataSource(
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

    @Post('data-sources/initialize')
    @ApiOperation({ summary: 'Initialize default data source configurations' })
    async initializeDataSources() {
        await this.dataSourceService.initializeDefaults();
        return { success: true };
    }
}
