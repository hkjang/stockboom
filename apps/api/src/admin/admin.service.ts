import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { prisma } from '@stockboom/database';
import * as os from 'os';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserApiKeysService, UserApiKeysDto } from '../user-api-keys/user-api-keys.service';
import { OpenDartService } from '../market-data/opendart.service';
import { MarketDataService } from '../market-data/market-data.service';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        @InjectQueue('trading') private tradingQueue: Queue,
        @InjectQueue('analysis') private analysisQueue: Queue,
        @InjectQueue('data-collection') private dataCollectionQueue: Queue,
        @InjectQueue('notification') private notificationQueue: Queue,
        private userApiKeysService: UserApiKeysService,
        private openDartService: OpenDartService,
        private marketDataService: MarketDataService,
    ) { }

    /**
     * Get system statistics for admin dashboard
     */
    async getSystemStats() {
        const [
            totalUsers,
            activeTrades,
            recentUsers,
            recentTrades,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.trade.count({
                where: {
                    status: { in: ['PENDING', 'SUBMITTED', 'PARTIALLY_FILLED'] },
                },
            }),
            prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true,
                },
            }),
            prisma.trade.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    stock: true,
                },
            }),
        ]);

        // Get queue job counts
        const queueJobs = await this.getQueueJobCounts();

        return {
            totalUsers,
            activeTrades,
            queueJobs: queueJobs.total,
            apiRequestsPerMin: 0, // TODO: Implement with Redis counter
            recentUsers,
            recentTrades,
        };
    }

    /**
     * Get system metrics (CPU, memory, disk)
     */
    async getSystemMetrics() {
        const cpus = os.cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        // Calculate CPU usage (simplified)
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

        // Get error logs from last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const errorLogs = await this.getRecentErrors(oneHourAgo);

        return {
            cpu: Math.round(cpuUsage),
            memory: Math.round((usedMemory / totalMemory) * 100),
            disk: 45, // TODO: Implement actual disk usage check
            errorLogs,
        };
    }

    /**
     * Get queue status for all queues
     */
    async getQueueStatus() {
        const queues = [
            { name: 'trading', queue: this.tradingQueue },
            { name: 'analysis', queue: this.analysisQueue },
            { name: 'data-collection', queue: this.dataCollectionQueue },
            { name: 'notification', queue: this.notificationQueue },
        ];

        const queueStatus = await Promise.all(
            queues.map(async ({ name, queue }) => {
                const [waiting, active, completed, failed] = await Promise.all([
                    queue.getWaitingCount(),
                    queue.getActiveCount(),
                    queue.getCompletedCount(),
                    queue.getFailedCount(),
                ]);

                return {
                    name,
                    waiting,
                    active,
                    completed,
                    failed,
                };
            })
        );

        return queueStatus;
    }

    /**
     * Get all users for admin management
     */
    async getAllUsers() {
        return prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                twoFactorEnabled: true,
                isActive: true,
                createdAt: true,
                lastLoginAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Update user status
     */
    async updateUserStatus(userId: string, isActive: boolean) {
        return prisma.user.update({
            where: { id: userId },
            data: { isActive },
        });
    }

    /**
     * Update user details
     */
    async updateUser(userId: string, data: { name?: string; email?: string }) {
        return prisma.user.update({
            where: { id: userId },
            data,
        });
    }

    /**
     * Delete user
     */
    async deleteUser(userId: string) {
        return prisma.user.delete({
            where: { id: userId },
        });
    }

    /**
     * Reset user password
     */
    async resetUserPassword(userId: string) {
        // Generate random 8-character password
        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hashedPassword },
        });

        return { success: true, tempPassword };
    }

    /**
     * Get failed jobs for a queue
     */
    async getFailedJobs(queueName: string, limit: number = 10) {
        const queueMap = {
            trading: this.tradingQueue,
            analysis: this.analysisQueue,
            'data-collection': this.dataCollectionQueue,
            notification: this.notificationQueue,
        };

        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error('Invalid queue name');
        }

        const failedJobs = await queue.getFailed(0, limit - 1);

        return failedJobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            failedReason: job.failedReason,
            stacktrace: job.stacktrace,
            timestamp: job.timestamp,
            attemptsMade: job.attemptsMade,
        }));
    }

    /**
     * Retry failed job
     */
    async retryFailedJob(queueName: string, jobId: string) {
        const queueMap = {
            trading: this.tradingQueue,
            analysis: this.analysisQueue,
            'data-collection': this.dataCollectionQueue,
            notification: this.notificationQueue,
        };

        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error('Invalid queue name');
        }

        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error('Job not found');
        }

        await job.retry();
        return { success: true, jobId };
    }

    /**
     * Clear completed jobs from queue
     */
    async clearCompletedJobs(queueName: string) {
        const queueMap = {
            trading: this.tradingQueue,
            analysis: this.analysisQueue,
            'data-collection': this.dataCollectionQueue,
            notification: this.notificationQueue,
        };

        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error('Invalid queue name');
        }

        await queue.clean(0, 'completed');
        return { success: true, queueName };
    }

    /**
     * Helper: Get total queue job counts
     */
    private async getQueueJobCounts() {
        const queues = [
            this.tradingQueue,
            this.analysisQueue,
            this.dataCollectionQueue,
            this.notificationQueue,
        ];

        let total = 0;
        for (const queue of queues) {
            const [waiting, active] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
            ]);
            total += waiting + active;
        }

        return { total };
    }

    /**
     * Helper: Get recent error logs
     * TODO: Implement proper error logging system
     */
    private async getRecentErrors(since: Date) {
        // Placeholder - implement with proper logging system
        return [];
    }

    /**
     * Bulk create stocks
     */
    async bulkCreateStocks(stocks: any[]) {
        const results: {
            success: any[];
            failed: Array<{ data: any; error: string }>;
        } = {
            success: [],
            failed: [],
        };

        for (const stockData of stocks) {
            try {
                const stock = await prisma.stock.upsert({
                    where: { symbol: stockData.symbol },
                    update: stockData,
                    create: stockData,
                });
                results.success.push(stock);
            } catch (error: any) {
                results.failed.push({
                    data: stockData,
                    error: error.message,
                });
            }
        }

        return results;
    }

    /**
     * Sync stocks from OpenDart
     * TODO: Implement actual OpenDart integration
     */
    async syncStocksFromOpenDart(corpCodes?: string[]) {
        // This will be implemented when OpenDartService is integrated
        return {
            message: 'OpenDart sync not yet implemented',
            corpCodes: corpCodes || [],
        };
    }

    /**
     * Get all stocks for admin management
     */
    /**
     * Get all stocks for admin management with data collection stats
     */
    async getAllStocks(params?: {
        skip?: number;
        take?: number;
        search?: string;
    }) {
        const { skip, take, search } = params || {};

        const where = search ? {
            OR: [
                { symbol: { contains: search, mode: 'insensitive' as any } },
                { name: { contains: search, mode: 'insensitive' as any } },
                { corpName: { contains: search, mode: 'insensitive' as any } },
            ],
        } : {};

        const [stocks, total] = await Promise.all([
            prisma.stock.findMany({
                where,
                skip,
                take: take || 50,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.stock.count({ where }),
        ]);

        // Fetch stats for each stock (in parallel)
        const stocksWithStats = await Promise.all(stocks.map(async (stock) => {
            const [
                candleStats,
                indicatorStats,
                newsStats,
                aiReportStats
            ] = await Promise.all([
                // Candles
                prisma.candle.aggregate({
                    where: { stockId: stock.id },
                    _count: true,
                    _max: { timestamp: true }
                }),
                // Indicators
                prisma.indicator.aggregate({
                    where: { stockId: stock.id },
                    _count: true,
                    _max: { timestamp: true }
                }),
                // News
                prisma.news.aggregate({
                    where: { stockId: stock.id },
                    _count: true,
                    _max: { publishedAt: true }
                }),
                // AI Reports
                prisma.aIReport.aggregate({
                    where: { stockId: stock.id },
                    _count: true,
                    _max: { createdAt: true }
                })
            ]);

            return {
                ...stock,
                stats: {
                    candles: {
                        count: candleStats._count,
                        lastUpdated: candleStats._max.timestamp
                    },
                    indicators: {
                        count: indicatorStats._count,
                        lastUpdated: indicatorStats._max.timestamp
                    },
                    news: {
                        count: newsStats._count,
                        lastUpdated: newsStats._max.publishedAt
                    },
                    aiReports: {
                        count: aiReportStats._count,
                        lastUpdated: aiReportStats._max.createdAt
                    }
                }
            };
        }));

        return { stocks: stocksWithStats, total };
    }

    /**
     * Get stock by ID with all fields
     */
    async getStockById(stockId: string) {
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
        });

        if (!stock) {
            throw new Error(`Stock with ID ${stockId} not found`);
        }

        return stock;
    }

    /**
     * Update stock
     */
    async updateStock(stockId: string, data: Partial<any>) {
        return prisma.stock.update({
            where: { id: stockId },
            data,
        });
    }

    /**
     * Delete stock
     */
    async deleteStock(stockId: string) {
        return prisma.stock.delete({
            where: { id: stockId },
        });
    }

    /**
     * Get user API keys (masked)
     */
    async getUserApiKeys(userId: string) {
        return this.userApiKeysService.getMaskedKeys(userId, userId, true);
    }

    /**
     * Update user API keys
     */
    async updateUserApiKeys(userId: string, data: UserApiKeysDto) {
        await this.userApiKeysService.updateKeys(userId, data, userId, true);
        return { success: true, message: 'User API keys updated' };
    }

    /**
     * Delete user API keys
     */
    async deleteUserApiKeys(userId: string) {
        await this.userApiKeysService.deleteKeys(userId, userId, true);
        return { success: true, message: 'User API keys deleted' };
    }

    /**
     * Sync corporation codes from OpenDart
     */
    async syncCorpCodesFromOpenDart(userId?: string) {
        try {
            const count = await this.openDartService.syncCorpCodesToDatabase(userId);
            return {
                success: true,
                message: `Successfully synced ${count} corporations from OpenDart`,
                count
            };
        } catch (error: any) {
            this.logger.error('Failed to sync corp codes from OpenDart', error);
            throw error;
        }
    }

    /**
     * Process uploaded corporation codes file (ZIP or XML)
     */
    async processUploadedCorpCodes(fileBuffer: Buffer, filename: string, deleteExisting: boolean = false) {
        try {
            this.logger.log(`Processing uploaded file: ${filename}, deleteExisting: ${deleteExisting}`);
            const AdmZip = require('adm-zip');
            const iconv = require('iconv-lite');

            let xmlString: string;

            // Check if file is ZIP (PK header)
            if (fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B) {
                this.logger.log('File is ZIP, extracting XML...');
                const zip = new AdmZip(fileBuffer);
                const entries = zip.getEntries();
                const xmlEntry = entries.find((e: any) => e.entryName.toLowerCase().endsWith('.xml'));

                if (!xmlEntry) {
                    throw new Error('No XML file found in ZIP archive');
                }

                const xmlBuffer = xmlEntry.getData();
                xmlString = iconv.decode(xmlBuffer, 'utf-8');
                this.logger.log(`Extracted ${xmlEntry.entryName} from ZIP`);
            } else {
                // Assume it's XML, decode as UTF-8
                xmlString = iconv.decode(fileBuffer, 'utf-8');
                this.logger.log('Processing XML file directly');
            }

            // Delete existing data if requested
            if (deleteExisting) {
                this.logger.log('Deleting existing corporation codes...');
                await this.openDartService.deleteAllCorpCodes();
            }

            // Use OpenDartService to parse and sync
            const count = await this.openDartService.syncCorpCodesFromXml(xmlString);

            this.logger.log(`Successfully processed uploaded file: ${count} corporations synced`);
            return {
                success: true,
                count,
                message: `Successfully synced ${count} corporation codes from uploaded file`,
                filename,
            };
        } catch (error: any) {
            this.logger.error(`Failed to process uploaded file: ${filename}`, error);
            throw error;
        }
    }

    /**
     * Collect company info from OpenDart for a specific corp code
     */
    async collectCompanyInfo(corpCode: string, userId?: string) {
        try {
            const result = await this.openDartService.collectCompanyInfo(corpCode, userId);
            return result;
        } catch (error: any) {
            this.logger.error(`Failed to collect company info for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Manually update stock price for a symbol
     */
    async manuallyUpdateStockPrice(symbol: string, market?: string, userId?: string) {
        try {
            const quote = await this.marketDataService.updateStockPrice(symbol, market);
            return {
                success: true,
                message: `Successfully updated price for ${symbol}`,
                data: quote
            };
        } catch (error: any) {
            this.logger.error(`Failed to update stock price for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Manually collect candle data for a symbol
     */
    async manuallyCollectCandles(
        symbol: string,
        timeframe: string = '1d',
        market?: string,
        userId?: string
    ) {
        try {
            const candles = await this.marketDataService.syncCandles(symbol, timeframe, market);
            return {
                success: true,
                message: `Successfully collected ${candles.length} candles for ${symbol}`,
                count: candles.length,
                data: candles
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect candles for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get recent data collection jobs
     * TODO: Implement proper job tracking system
     */
    async getDataCollectionJobs(limit: number = 20) {
        // Placeholder - in a real system, this would track job history
        // For now, return queue jobs related to data collection
        const dataCollectionJobs = await this.dataCollectionQueue.getJobs(
            ['completed', 'failed', 'active', 'waiting'],
            0,
            limit - 1
        );

        return await Promise.all(dataCollectionJobs.map(async job => ({
            id: job.id,
            name: job.name,
            status: await job.getState(),
            data: job.data,
            timestamp: job.timestamp,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
        })));
    }

    // =====================================
    // NEW: Data Collection Dashboard Methods
    // =====================================

    /**
     * Get data collection dashboard statistics
     */
    async getDataCollectionStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            totalStocks,
            activeStocks,
            totalCandles,
            todayCandles,
            pendingJobs,
            activeJobs,
            completedJobs,
            failedJobs,
            lastCandle
        ] = await Promise.all([
            prisma.stock.count(),
            prisma.stock.count({ where: { isActive: true } }),
            prisma.candle.count(),
            prisma.candle.count({
                where: { createdAt: { gte: today } }
            }),
            this.dataCollectionQueue.getWaitingCount(),
            this.dataCollectionQueue.getActiveCount(),
            this.dataCollectionQueue.getCompletedCount(),
            this.dataCollectionQueue.getFailedCount(),
            prisma.candle.findFirst({
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true }
            })
        ]);

        return {
            totalStocks,
            activeStocks,
            totalCandles,
            todayCollected: todayCandles,
            pendingJobs,
            activeJobs,
            completedJobs,
            failedJobs,
            lastCollectionTime: lastCandle?.createdAt || null,
            queueHealth: failedJobs > 10 ? 'warning' : pendingJobs > 100 ? 'busy' : 'healthy'
        };
    }

    /**
     * Bulk collect stock data for multiple symbols
     */
    async bulkCollectStockData(
        symbols: string[],
        options: { timeframe?: string; market?: string } = {}
    ) {
        const { timeframe = '1d', market = 'KOSPI' } = options;
        const results: { queued: string[]; failed: { symbol: string; error: string }[] } = {
            queued: [],
            failed: []
        };

        for (const symbol of symbols) {
            try {
                // Find stock in database
                const stock = await prisma.stock.findUnique({ where: { symbol } });

                if (!stock) {
                    results.failed.push({ symbol, error: 'Stock not found' });
                    continue;
                }

                // Queue data collection job
                await this.dataCollectionQueue.add(
                    'collect-candles',
                    {
                        stockId: stock.id,
                        symbol: stock.symbol,
                        timeframe,
                        market: stock.market || market,
                    },
                    {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 2000 },
                    }
                );

                results.queued.push(symbol);
            } catch (error: any) {
                results.failed.push({ symbol, error: error.message });
            }
        }

        return {
            success: true,
            totalQueued: results.queued.length,
            totalFailed: results.failed.length,
            ...results
        };
    }

    /**
     * Collect data for all active stocks
     */
    async collectAllStockData(options: { timeframe?: string; batchSize?: number } = {}) {
        const { timeframe = '1d', batchSize = 50 } = options;

        const stocks = await prisma.stock.findMany({
            where: { isActive: true, isTradable: true },
            select: { id: true, symbol: true, market: true }
        });

        const symbols = stocks.map(s => s.symbol);

        // Queue in batches to avoid overwhelming the system
        const batches: string[][] = [];
        for (let i = 0; i < symbols.length; i += batchSize) {
            batches.push(symbols.slice(i, i + batchSize));
        }

        let totalQueued = 0;
        for (const batch of batches) {
            const result = await this.bulkCollectStockData(batch, { timeframe });
            totalQueued += result.totalQueued;
        }

        return {
            success: true,
            message: `Queued ${totalQueued} stocks for data collection`,
            totalStocks: stocks.length,
            totalQueued,
            timeframe
        };
    }

    /**
     * Get scheduler status and configuration
     */
    async getSchedulerStatus() {
        // Define scheduler configurations (matches data-collection.scheduler.ts)
        const schedulers = [
            { name: '1분 캔들', cron: '*/1 * * * *', timeframe: '1m', description: '1분마다 수집', enabled: true },
            { name: '5분 캔들', cron: '*/5 * * * *', timeframe: '5m', description: '5분마다 수집', enabled: true },
            { name: '15분 캔들', cron: '*/15 * * * *', timeframe: '15m', description: '15분마다 수집', enabled: true },
            { name: '1시간 캔들', cron: '0 * * * *', timeframe: '1h', description: '매 정각 수집', enabled: true },
            { name: '일봉', cron: '0 18 * * 1-5', timeframe: '1d', description: '평일 18시 수집', enabled: true },
            { name: '주봉', cron: '0 18 * * 1', timeframe: '1w', description: '월요일 18시 수집', enabled: true },
        ];

        // Get queue status
        const [waiting, active, completed, failed] = await Promise.all([
            this.dataCollectionQueue.getWaitingCount(),
            this.dataCollectionQueue.getActiveCount(),
            this.dataCollectionQueue.getCompletedCount(),
            this.dataCollectionQueue.getFailedCount()
        ]);

        return {
            schedulers: schedulers.map(s => ({
                ...s,
                nextRun: this.getNextCronRun(s.cron)
            })),
            queueStatus: { waiting, active, completed, failed }
        };
    }

    /**
     * Get improved job history with pagination and filtering
     */
    async getDataCollectionJobsV2(params: {
        page?: number;
        limit?: number;
        status?: string;
        type?: string;
    } = {}) {
        const { page = 1, limit = 20, status, type } = params;
        const offset = (page - 1) * limit;

        // Get jobs from queue based on status filter
        let statuses: Array<'completed' | 'failed' | 'active' | 'waiting' | 'delayed'> =
            ['completed', 'failed', 'active', 'waiting'];

        if (status) {
            statuses = [status as any];
        }

        const allJobs = await this.dataCollectionQueue.getJobs(statuses);

        // Filter by type if specified
        let filteredJobs = allJobs;
        if (type) {
            filteredJobs = allJobs.filter(job => job.name === type);
        }

        // Sort by timestamp descending
        filteredJobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Paginate
        const paginatedJobs = filteredJobs.slice(offset, offset + limit);
        const total = filteredJobs.length;

        const jobs = await Promise.all(paginatedJobs.map(async job => ({
            id: job.id,
            name: job.name,
            status: await job.getState(),
            data: job.data,
            progress: job.progress(),
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
        })));

        return {
            jobs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Retry a specific collection job
     */
    async retryCollectionJob(jobId: string) {
        const job = await this.dataCollectionQueue.getJob(jobId);

        if (!job) {
            throw new Error('Job not found');
        }

        const state = await job.getState();
        if (state !== 'failed') {
            throw new Error(`Cannot retry job in ${state} state`);
        }

        await job.retry();

        return {
            success: true,
            message: `Job ${jobId} has been requeued`,
            jobId
        };
    }

    /**
     * Cancel a pending job
     */
    async cancelCollectionJob(jobId: string) {
        const job = await this.dataCollectionQueue.getJob(jobId);

        if (!job) {
            throw new Error('Job not found');
        }

        const state = await job.getState();
        if (state === 'completed' || state === 'failed') {
            throw new Error(`Cannot cancel job in ${state} state`);
        }

        await job.remove();

        return {
            success: true,
            message: `Job ${jobId} has been cancelled`,
            jobId
        };
    }

    /**
     * Helper: Calculate next cron run time
     */
    private getNextCronRun(cronExpression: string): Date | null {
        try {
            // Simple approximation for common patterns
            const now = new Date();
            const parts = cronExpression.split(' ');

            if (cronExpression.startsWith('*/')) {
                // Every X minutes
                const interval = parseInt(parts[0].substring(2));
                const nextMinute = Math.ceil(now.getMinutes() / interval) * interval;
                const next = new Date(now);
                next.setMinutes(nextMinute, 0, 0);
                if (next <= now) {
                    next.setMinutes(next.getMinutes() + interval);
                }
                return next;
            }

            // For more complex patterns, return approximate next hour
            const next = new Date(now);
            next.setHours(next.getHours() + 1, 0, 0, 0);
            return next;
        } catch {
            return null;
        }
    }

    // ============================================
    // OpenDART Corporate Information Collection
    // ============================================

    /**
     * Helper: Find stock by corpCode, stockCode, or symbol
     */
    private async findStockByCode(code: string) {
        // Try corpCode first (8 digits)
        let stock = await prisma.stock.findFirst({ where: { corpCode: code } });
        if (stock) return stock;

        // Try stockCode
        stock = await prisma.stock.findFirst({ where: { stockCode: code } });
        if (stock) return stock;

        // Try symbol
        stock = await prisma.stock.findFirst({ where: { symbol: code } });
        return stock;
    }

    /**
     * Collect and save executive status from OpenDART
     */
    async collectExecutives(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            // Find stock by corpCode, stockCode, or symbol
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                this.logger.warn(`Stock with code ${corpCode} not found, skipping...`);
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found. Please ensure the stock exists in the database.` };
            }

            // Use the corpCode from the stock record for OpenDART API
            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set. Please sync corp codes first.` };
            }

            // Fetch data from OpenDART
            const executives = await this.openDartService.getExecutiveStatus(actualCorpCode, bizYear, reportCode, userId);

            if (!executives || executives.length === 0) {
                return { success: true, count: 0, message: 'No executive data found' };
            }

            // Save to database with upsert
            let savedCount = 0;
            const reportDate = new Date();

            for (const exec of executives) {
                try {
                    await prisma.executive.upsert({
                        where: {
                            stockId_name_bizYear_reportCode: {
                                stockId: stock.id,
                                name: exec.nm || '',
                                bizYear,
                                reportCode,
                            },
                        },
                        update: {
                            position: exec.ofcps || '',
                            isBoardMember: exec.rgist_exctv_at === 'Y',
                            isAuditCommittee: exec.aud_at === 'Y',
                            tenure: exec.mxmm_shrholdr_relate || null,
                            birthYear: exec.birth_ym || null,
                            gender: exec.sexdstn || null,
                            experience: exec.main_career || null,
                            reportDate,
                        },
                        create: {
                            stockId: stock.id,
                            name: exec.nm || '',
                            position: exec.ofcps || '',
                            isBoardMember: exec.rgist_exctv_at === 'Y',
                            isAuditCommittee: exec.aud_at === 'Y',
                            tenure: exec.mxmm_shrholdr_relate || null,
                            birthYear: exec.birth_ym || null,
                            gender: exec.sexdstn || null,
                            experience: exec.main_career || null,
                            bizYear,
                            reportCode,
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to save executive: ${exec.nm}`);
                }
            }

            return {
                success: true,
                count: savedCount,
                total: executives.length,
                message: `Saved ${savedCount} executives for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect executives for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect and save outside directors from OpenDART
     */
    async collectOutsideDirectors(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            // Find stock by corpCode, stockCode, or symbol
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                this.logger.warn(`Stock with code ${corpCode} not found, skipping...`);
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found. Please ensure the stock exists in the database with a valid corpCode.` };
            }

            // Use the corpCode from the stock record for OpenDART API
            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set. Please sync corp codes first.` };
            }

            const directors = await this.openDartService.getOutsideDirectors(actualCorpCode, bizYear, reportCode, userId);

            if (!directors || directors.length === 0) {
                return { success: true, count: 0, message: 'No outside director data found' };
            }

            let savedCount = 0;
            const reportDate = new Date();

            for (const dir of directors) {
                try {
                    await prisma.outsideDirector.upsert({
                        where: {
                            stockId_name_bizYear_reportCode: {
                                stockId: stock.id,
                                name: dir.nm || '',
                                bizYear,
                                reportCode,
                            },
                        },
                        update: {
                            isIndependent: true,
                            specialization: dir.main_career || null,
                            appointedDate: dir.chrg_job || null,
                            tenure: dir.tenure || null,
                            reportDate,
                        },
                        create: {
                            stockId: stock.id,
                            name: dir.nm || '',
                            isIndependent: true,
                            specialization: dir.main_career || null,
                            appointedDate: dir.chrg_job || null,
                            tenure: dir.tenure || null,
                            bizYear,
                            reportCode,
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to save outside director: ${dir.nm}`);
                }
            }

            return {
                success: true,
                count: savedCount,
                total: directors.length,
                message: `Saved ${savedCount} outside directors for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect outside directors for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect and save major shareholders from OpenDART
     */
    async collectMajorShareholders(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            // Find stock by corpCode, stockCode, or symbol
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                this.logger.warn(`Stock with code ${corpCode} not found, skipping...`);
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found. Please ensure the stock exists in the database with a valid corpCode.` };
            }

            // Use the corpCode from the stock record for OpenDART API
            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set. Please sync corp codes first.` };
            }

            const shareholders = await this.openDartService.getMajorShareholders(actualCorpCode, bizYear, reportCode, userId);

            if (!shareholders || shareholders.length === 0) {
                return { success: true, count: 0, message: 'No shareholder data found' };
            }

            let savedCount = 0;
            const reportDate = new Date();

            for (const sh of shareholders) {
                try {
                    const sharesOwned = BigInt(String(sh.stock_knd || '0').replace(/,/g, '') || '0');
                    const shareRatio = parseFloat(String(sh.bsis_posesn_stock_co || '0').replace(/,/g, '') || '0');

                    await prisma.majorShareholder.upsert({
                        where: {
                            stockId_shareholderName_bizYear_reportCode: {
                                stockId: stock.id,
                                shareholderName: sh.nm || '',
                                bizYear,
                                reportCode,
                            },
                        },
                        update: {
                            relation: sh.relate || null,
                            sharesOwned,
                            shareRatio,
                            isLargeHolder: shareRatio >= 5.0,
                            reportDate,
                        },
                        create: {
                            stockId: stock.id,
                            shareholderName: sh.nm || '',
                            relation: sh.relate || null,
                            sharesOwned,
                            shareRatio,
                            isLargeHolder: shareRatio >= 5.0,
                            bizYear,
                            reportCode,
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to save shareholder: ${sh.nm}`);
                }
            }

            return {
                success: true,
                count: savedCount,
                total: shareholders.length,
                message: `Saved ${savedCount} shareholders for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect major shareholders for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect and save dividend information from OpenDART
     */
    async collectDividends(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            // Find stock by corpCode, stockCode, or symbol
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                this.logger.warn(`Stock with code ${corpCode} not found, skipping...`);
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found. Please ensure the stock exists in the database with a valid corpCode.` };
            }

            // Use the corpCode from the stock record for OpenDART API
            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set. Please sync corp codes first.` };
            }

            const dividends = await this.openDartService.getDividendInfo(actualCorpCode, bizYear, reportCode, userId);

            if (!dividends || dividends.length === 0) {
                return { success: true, count: 0, message: 'No dividend data found' };
            }

            let savedCount = 0;
            const reportDate = new Date();

            for (const div of dividends) {
                try {
                    const parseDecimal = (val: any) => {
                        if (!val || val === '-') return null;
                        const num = parseFloat(String(val).replace(/,/g, ''));
                        return isNaN(num) ? null : num;
                    };

                    await prisma.dividend.upsert({
                        where: {
                            stockId_fiscalYear_dividendType_reportCode: {
                                stockId: stock.id,
                                fiscalYear: bizYear,
                                dividendType: div.se || 'cash',
                                reportCode,
                            },
                        },
                        update: {
                            cashDividend: parseDecimal(div.thstrm),
                            dividendYield: parseDecimal(div.lwfr),
                            dividendPayout: parseDecimal(div.frmtrm),
                            reportDate,
                        },
                        create: {
                            stockId: stock.id,
                            fiscalYear: bizYear,
                            dividendType: div.se || 'cash',
                            cashDividend: parseDecimal(div.thstrm),
                            dividendYield: parseDecimal(div.lwfr),
                            dividendPayout: parseDecimal(div.frmtrm),
                            reportCode,
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to save dividend: ${div.se}`);
                }
            }

            return {
                success: true,
                count: savedCount,
                total: dividends.length,
                message: `Saved ${savedCount} dividend records for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect dividends for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect large holdings (5% or more) from OpenDART
     */
    async collectLargeHoldings(corpCode: string, userId?: string) {
        try {
            // Find stock by corpCode, stockCode, or symbol
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                this.logger.warn(`Stock with code ${corpCode} not found, skipping...`);
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found. Please ensure the stock exists in the database with a valid corpCode.` };
            }

            // Use the corpCode from the stock record for OpenDART API
            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set. Please sync corp codes first.` };
            }

            const holdings = await this.openDartService.getLargeHoldings(actualCorpCode, userId);

            if (!holdings || holdings.length === 0) {
                return { success: true, count: 0, message: 'No large holding data found' };
            }

            let savedCount = 0;
            const reportDate = new Date();
            const bizYear = new Date().getFullYear().toString();

            for (const hold of holdings) {
                try {
                    const sharesOwned = BigInt(String(hold.stkqy || '0').replace(/,/g, '') || '0');
                    const shareRatio = parseFloat(String(hold.stkrt || '0').replace(/,/g, '') || '0');

                    await prisma.majorShareholder.upsert({
                        where: {
                            stockId_shareholderName_bizYear_reportCode: {
                                stockId: stock.id,
                                shareholderName: hold.rpt_opnin_sttn_nm || '',
                                bizYear,
                                reportCode: 'majorstock',
                            },
                        },
                        update: {
                            sharesOwned,
                            shareRatio,
                            isLargeHolder: true,
                            changeType: hold.chg_rson || null,
                            changeDate: hold.rcept_dt ? new Date(hold.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null,
                            reportDate,
                        },
                        create: {
                            stockId: stock.id,
                            shareholderName: hold.rpt_opnin_sttn_nm || '',
                            sharesOwned,
                            shareRatio,
                            isLargeHolder: true,
                            changeType: hold.chg_rson || null,
                            changeDate: hold.rcept_dt ? new Date(hold.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null,
                            bizYear,
                            reportCode: 'majorstock',
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to save large holding: ${hold.rpt_opnin_sttn_nm}`);
                }
            }

            return {
                success: true,
                count: savedCount,
                total: holdings.length,
                message: `Saved ${savedCount} large holdings for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect large holdings for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Get collected executives for a stock
     */
    async getStockExecutives(stockId: string, bizYear?: string) {
        const where: any = { stockId };
        if (bizYear) where.bizYear = bizYear;

        return prisma.executive.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get collected outside directors for a stock
     */
    async getStockOutsideDirectors(stockId: string, bizYear?: string) {
        const where: any = { stockId };
        if (bizYear) where.bizYear = bizYear;

        return prisma.outsideDirector.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get collected shareholders for a stock
     */
    async getStockMajorShareholders(stockId: string, bizYear?: string) {
        const where: any = { stockId };
        if (bizYear) where.bizYear = bizYear;

        return prisma.majorShareholder.findMany({
            where,
            orderBy: [{ shareRatio: 'desc' }, { createdAt: 'desc' }],
        });
    }

    /**
     * Get collected dividends for a stock
     */
    async getStockDividends(stockId: string, fiscalYear?: string) {
        const where: any = { stockId };
        if (fiscalYear) where.fiscalYear = fiscalYear;

        return prisma.dividend.findMany({
            where,
            orderBy: { fiscalYear: 'desc' },
        });
    }
}
