import { Controller, Get, Patch, Post, Put, Delete, Param, Body, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
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

    @Get('stocks/:stockId')
    @ApiOperation({ summary: 'Get stock by ID with all fields' })
    async getStockById(@Param('stockId') stockId: string) {
        return this.adminService.getStockById(stockId);
    }

    @Patch('stocks/:stockId')
    @ApiOperation({ summary: 'Update stock' })
    async updateStock(@Param('stockId') stockId: string, @Body() data: any) {
        return this.adminService.updateStock(stockId, data);
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

    // Manual Data Collection Endpoints
    @Post('data-collection/opendart/corp-codes')
    @ApiOperation({ summary: 'Sync corporation codes from OpenDart' })
    async syncCorpCodes(@Request() req: any) {
        return this.adminService.syncCorpCodesFromOpenDart(req.user.userId);
    }

    @Post('data-collection/opendart/upload-corp-codes')
    @ApiOperation({ summary: 'Upload corporation codes from XML/ZIP file' })
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
        fileFilter: (req, file, cb) => {
            const allowedMimes = [
                'application/xml',
                'text/xml',
                'application/zip',
                'application/x-zip-compressed',
            ];
            const allowedExts = ['.xml', '.zip'];
            const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

            if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error('Only XML and ZIP files are allowed'), false);
            }
        },
    }))
    async uploadCorpCodes(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { deleteExisting?: string },
    ) {
        if (!file) {
            throw new Error('No file uploaded');
        }

        const deleteExisting = body.deleteExisting === 'true';
        return this.adminService.processUploadedCorpCodes(file.buffer, file.originalname, deleteExisting);
    }

    @Post('data-collection/opendart/company-info')
    @ApiOperation({ summary: 'Collect company info from OpenDart' })
    async collectCompanyInfo(@Request() req: any, @Body() data: { corpCode: string }) {
        return this.adminService.collectCompanyInfo(data.corpCode, req.user.userId);
    }

    @Post('data-collection/stocks/price')
    @ApiOperation({ summary: 'Manually update stock price' })
    async updateStockPrice(
        @Request() req: any,
        @Body() data: { symbol: string; market?: string }
    ) {
        return this.adminService.manuallyUpdateStockPrice(
            data.symbol,
            data.market,
            req.user.userId
        );
    }

    @Post('data-collection/stocks/candles')
    @ApiOperation({ summary: 'Manually collect candle data' })
    async collectCandles(
        @Request() req: any,
        @Body() data: {
            symbol: string;
            timeframe?: string;
            market?: string;
        }
    ) {
        return this.adminService.manuallyCollectCandles(
            data.symbol,
            data.timeframe || '1d',
            data.market,
            req.user.userId
        );
    }

    @Get('data-collection/jobs')
    @ApiOperation({ summary: 'Get recent data collection jobs' })
    async getDataCollectionJobs(@Query('limit') limit?: string) {
        return this.adminService.getDataCollectionJobs(
            limit ? parseInt(limit) : 20
        );
    }

    // =====================================
    // NEW: Data Collection Dashboard Endpoints
    // =====================================

    @Get('data-collection/stats')
    @ApiOperation({ summary: 'Get data collection dashboard statistics' })
    async getDataCollectionStats() {
        return this.adminService.getDataCollectionStats();
    }

    @Post('data-collection/bulk-collect')
    @ApiOperation({ summary: 'Bulk collect stock data for multiple symbols' })
    async bulkCollectStockData(
        @Body() data: {
            symbols: string[];
            timeframe?: string;
            market?: string;
        }
    ) {
        return this.adminService.bulkCollectStockData(data.symbols, {
            timeframe: data.timeframe,
            market: data.market
        });
    }

    @Post('data-collection/collect-all')
    @ApiOperation({ summary: 'Collect data for all active stocks' })
    async collectAllStockData(
        @Body() data: { timeframe?: string; batchSize?: number }
    ) {
        return this.adminService.collectAllStockData(data);
    }

    @Get('scheduler/status')
    @ApiOperation({ summary: 'Get scheduler status and configuration' })
    async getSchedulerStatus() {
        return this.adminService.getSchedulerStatus();
    }

    @Get('data-collection/jobs-v2')
    @ApiOperation({ summary: 'Get job history with pagination and filtering' })
    async getDataCollectionJobsV2(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('type') type?: string
    ) {
        return this.adminService.getDataCollectionJobsV2({
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
            status,
            type
        });
    }

    @Post('data-collection/jobs/:jobId/retry')
    @ApiOperation({ summary: 'Retry a failed collection job' })
    async retryCollectionJob(@Param('jobId') jobId: string) {
        return this.adminService.retryCollectionJob(jobId);
    }

    @Delete('data-collection/jobs/:jobId')
    @ApiOperation({ summary: 'Cancel a pending collection job' })
    async cancelCollectionJob(@Param('jobId') jobId: string) {
        return this.adminService.cancelCollectionJob(jobId);
    }

    // =====================================
    // OpenDART Corporate Information Endpoints
    // =====================================

    @Post('data-collection/opendart/executives')
    @ApiOperation({ summary: 'Collect executive status from OpenDart' })
    async collectExecutives(
        @Request() req: any,
        @Body() data: { corpCode: string; bizYear: string; reportCode?: string }
    ) {
        return this.adminService.collectExecutives(
            data.corpCode,
            data.bizYear,
            data.reportCode || '11011',
            req.user.userId
        );
    }

    @Post('data-collection/opendart/outside-directors')
    @ApiOperation({ summary: 'Collect outside directors from OpenDart' })
    async collectOutsideDirectors(
        @Request() req: any,
        @Body() data: { corpCode: string; bizYear: string; reportCode?: string }
    ) {
        return this.adminService.collectOutsideDirectors(
            data.corpCode,
            data.bizYear,
            data.reportCode || '11011',
            req.user.userId
        );
    }

    @Post('data-collection/opendart/major-shareholders')
    @ApiOperation({ summary: 'Collect major shareholders from OpenDart' })
    async collectMajorShareholders(
        @Request() req: any,
        @Body() data: { corpCode: string; bizYear: string; reportCode?: string }
    ) {
        return this.adminService.collectMajorShareholders(
            data.corpCode,
            data.bizYear,
            data.reportCode || '11011',
            req.user.userId
        );
    }

    @Post('data-collection/opendart/dividends')
    @ApiOperation({ summary: 'Collect dividend information from OpenDart' })
    async collectDividends(
        @Request() req: any,
        @Body() data: { corpCode: string; bizYear: string; reportCode?: string }
    ) {
        return this.adminService.collectDividends(
            data.corpCode,
            data.bizYear,
            data.reportCode || '11011',
            req.user.userId
        );
    }

    @Post('data-collection/opendart/large-holdings')
    @ApiOperation({ summary: 'Collect large holdings (5%+) from OpenDart' })
    async collectLargeHoldings(
        @Request() req: any,
        @Body() data: { corpCode: string }
    ) {
        return this.adminService.collectLargeHoldings(
            data.corpCode,
            req.user.userId
        );
    }

    // Retrieved data endpoints
    @Get('stocks/:stockId/executives')
    @ApiOperation({ summary: 'Get collected executives for a stock' })
    async getStockExecutives(
        @Param('stockId') stockId: string,
        @Query('bizYear') bizYear?: string
    ) {
        return this.adminService.getStockExecutives(stockId, bizYear);
    }

    @Get('stocks/:stockId/outside-directors')
    @ApiOperation({ summary: 'Get collected outside directors for a stock' })
    async getStockOutsideDirectors(
        @Param('stockId') stockId: string,
        @Query('bizYear') bizYear?: string
    ) {
        return this.adminService.getStockOutsideDirectors(stockId, bizYear);
    }

    @Get('stocks/:stockId/major-shareholders')
    @ApiOperation({ summary: 'Get collected major shareholders for a stock' })
    async getStockMajorShareholders(
        @Param('stockId') stockId: string,
        @Query('bizYear') bizYear?: string
    ) {
        return this.adminService.getStockMajorShareholders(stockId, bizYear);
    }

    @Get('stocks/:stockId/dividends')
    @ApiOperation({ summary: 'Get collected dividends for a stock' })
    async getStockDividends(
        @Param('stockId') stockId: string,
        @Query('fiscalYear') fiscalYear?: string
    ) {
        return this.adminService.getStockDividends(stockId, fiscalYear);
    }

    // =====================================
    // System Settings Endpoints
    // =====================================

    @Get('settings')
    @ApiOperation({ summary: 'Get all system settings' })
    async getSystemSettings() {
        return this.adminService.getSystemSettings();
    }

    @Put('settings')
    @ApiOperation({ summary: 'Update system settings' })
    async updateSystemSettings(
        @Body() data: { settings: { key: string; value: string | null; description?: string; category?: string; isSecret?: boolean }[] }
    ) {
        return this.adminService.updateSystemSettings(data.settings);
    }

    @Put('settings/:key')
    @ApiOperation({ summary: 'Update a single system setting' })
    async updateSystemSetting(
        @Param('key') key: string,
        @Body() data: { value: string | null; description?: string }
    ) {
        return this.adminService.updateSystemSetting(key, data.value, data.description);
    }

    @Delete('settings/:key')
    @ApiOperation({ summary: 'Delete a system setting' })
    async deleteSystemSetting(@Param('key') key: string) {
        return this.adminService.deleteSystemSetting(key);
    }

    @Get('env-status')
    @ApiOperation({ summary: 'Get environment variable status (read-only)' })
    getEnvStatus() {
        return this.adminService.getEnvStatus();
    }

    @Post('settings/initialize')
    @ApiOperation({ summary: 'Initialize default system settings' })
    async initializeSettings() {
        return this.adminService.initializeDefaultSettings();
    }
}
