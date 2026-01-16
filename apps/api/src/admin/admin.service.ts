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

    // ============================================
    // NEW: Extended OpenDART Data Collection
    // ============================================

    /**
     * Collect and save employee status from OpenDART
     */
    async collectEmployees(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found.` };
            }

            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set.` };
            }

            const employees = await this.openDartService.getEmployeeStatus(actualCorpCode, bizYear, reportCode, userId);

            if (!employees || employees.length === 0) {
                return { success: true, count: 0, message: 'No employee data found' };
            }

            const reportDate = new Date();
            let totalMale = 0, totalFemale = 0, totalCount = 0;

            for (const emp of employees) {
                const maleCount = parseInt(String(emp.sm || '0').replace(/,/g, '')) || 0;
                const femaleCount = parseInt(String(emp.sm_w || '0').replace(/,/g, '')) || 0;
                totalMale += maleCount;
                totalFemale += femaleCount;
                totalCount += maleCount + femaleCount;
            }

            await prisma.employee.upsert({
                where: {
                    stockId_bizYear_reportCode: {
                        stockId: stock.id,
                        bizYear,
                        reportCode,
                    },
                },
                update: {
                    maleCount: totalMale,
                    femaleCount: totalFemale,
                    totalCount,
                    reportDate,
                },
                create: {
                    stockId: stock.id,
                    maleCount: totalMale,
                    femaleCount: totalFemale,
                    totalCount,
                    bizYear,
                    reportCode,
                    reportDate,
                },
            });

            return {
                success: true,
                count: 1,
                message: `Saved employee stats for ${stock.name}: ${totalCount} employees`,
                data: { maleCount: totalMale, femaleCount: totalFemale, totalCount },
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect employees for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect and save audit opinion from OpenDART
     */
    async collectAuditOpinion(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found.` };
            }

            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set.` };
            }

            const opinions = await this.openDartService.getAuditOpinion(actualCorpCode, bizYear, reportCode, userId);

            if (!opinions || opinions.length === 0) {
                return { success: true, count: 0, message: 'No audit opinion data found' };
            }

            const reportDate = new Date();
            let savedCount = 0;

            for (const opinion of opinions) {
                try {
                    const parseDecimal = (val: any) => {
                        if (!val || val === '-') return null;
                        const num = parseFloat(String(val).replace(/,/g, ''));
                        return isNaN(num) ? null : num;
                    };

                    await prisma.auditOpinion.upsert({
                        where: {
                            stockId_bizYear_reportCode: {
                                stockId: stock.id,
                                bizYear,
                                reportCode,
                            },
                        },
                        update: {
                            auditorName: opinion.adtor || '',
                            opinionType: opinion.adt_a || '',
                            auditFee: parseDecimal(opinion.adt_reprt),
                            nonAuditFee: parseDecimal(opinion.n_adt_reprt),
                            reportDate,
                        },
                        create: {
                            stockId: stock.id,
                            auditorName: opinion.adtor || '',
                            opinionType: opinion.adt_a || '',
                            auditFee: parseDecimal(opinion.adt_reprt),
                            nonAuditFee: parseDecimal(opinion.n_adt_reprt),
                            bizYear,
                            reportCode,
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to save audit opinion`);
                }
            }

            return {
                success: true,
                count: savedCount,
                message: `Saved ${savedCount} audit opinion records for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect audit opinion for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect and save capital changes (증자/감자) from OpenDART
     */
    async collectCapitalChanges(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found.` };
            }

            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set.` };
            }

            const changes = await this.openDartService.getCapitalChanges(actualCorpCode, bizYear, reportCode, userId);

            if (!changes || changes.length === 0) {
                return { success: true, count: 0, message: 'No capital change data found' };
            }

            const reportDate = new Date();
            let savedCount = 0;

            for (const change of changes) {
                try {
                    const changeDate = change.stck_issu_dcis_de
                        ? new Date(change.stck_issu_dcis_de.replace(/(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3'))
                        : new Date();

                    await prisma.capitalChange.upsert({
                        where: {
                            stockId_changeType_changeDate_reportCode: {
                                stockId: stock.id,
                                changeType: change.isu_dcrs_stle || '증자',
                                changeDate,
                                reportCode,
                            },
                        },
                        update: {
                            issuePrice: change.isu_pric ? parseFloat(String(change.isu_pric).replace(/,/g, '')) : null,
                            sharesIssued: change.isu_stock_totqy ? BigInt(String(change.isu_stock_totqy).replace(/,/g, '')) : null,
                            totalAmount: change.isu_amt ? parseFloat(String(change.isu_amt).replace(/,/g, '')) : null,
                            reason: change.rm || null,
                            reportDate,
                        },
                        create: {
                            stockId: stock.id,
                            changeType: change.isu_dcrs_stle || '증자',
                            changeDate,
                            issuePrice: change.isu_pric ? parseFloat(String(change.isu_pric).replace(/,/g, '')) : null,
                            sharesIssued: change.isu_stock_totqy ? BigInt(String(change.isu_stock_totqy).replace(/,/g, '')) : null,
                            totalAmount: change.isu_amt ? parseFloat(String(change.isu_amt).replace(/,/g, '')) : null,
                            reason: change.rm || null,
                            bizYear,
                            reportCode,
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to save capital change`);
                }
            }

            return {
                success: true,
                count: savedCount,
                message: `Saved ${savedCount} capital change records for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect capital changes for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect and save treasury stock data from OpenDART
     */
    async collectTreasuryStock(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found.` };
            }

            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set.` };
            }

            const treasuryData = await this.openDartService.getTreasuryStock(actualCorpCode, bizYear, reportCode, userId);

            if (!treasuryData || treasuryData.length === 0) {
                return { success: true, count: 0, message: 'No treasury stock data found' };
            }

            const reportDate = new Date();
            let savedCount = 0;

            for (const ts of treasuryData) {
                try {
                    const transactionDate = ts.acqs_de
                        ? new Date(ts.acqs_de.replace(/(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3'))
                        : null;

                    await prisma.treasuryStock.upsert({
                        where: {
                            stockId_transactionType_transactionDate_reportCode: {
                                stockId: stock.id,
                                transactionType: ts.acqs_mth || '취득',
                                transactionDate: transactionDate || new Date(),
                                reportCode,
                            },
                        },
                        update: {
                            shares: ts.trmend_qy ? BigInt(String(ts.trmend_qy).replace(/,/g, '')) : BigInt(0),
                            amount: ts.trmend_amt ? parseFloat(String(ts.trmend_amt).replace(/,/g, '')) : null,
                            purpose: ts.acqs_pp || null,
                            reportDate,
                        },
                        create: {
                            stockId: stock.id,
                            transactionType: ts.acqs_mth || '취득',
                            shares: ts.trmend_qy ? BigInt(String(ts.trmend_qy).replace(/,/g, '')) : BigInt(0),
                            amount: ts.trmend_amt ? parseFloat(String(ts.trmend_amt).replace(/,/g, '')) : null,
                            transactionDate,
                            purpose: ts.acqs_pp || null,
                            bizYear,
                            reportCode,
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    this.logger.warn(`Failed to save treasury stock`);
                }
            }

            return {
                success: true,
                count: savedCount,
                message: `Saved ${savedCount} treasury stock records for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect treasury stock for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect and save insider trading data from OpenDART
     */
    async collectInsiderTrading(corpCode: string, userId?: string) {
        try {
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found.` };
            }

            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set.` };
            }

            const insiderData = await this.openDartService.getInsiderTrading(actualCorpCode, userId);

            if (!insiderData || insiderData.length === 0) {
                return { success: true, count: 0, message: 'No insider trading data found' };
            }

            let savedCount = 0;

            for (const insider of insiderData) {
                try {
                    const transactionDate = insider.acqs_de
                        ? new Date(insider.acqs_de.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
                        : new Date();
                    const reportDate = insider.rcept_dt
                        ? new Date(insider.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
                        : new Date();

                    await prisma.insiderTrading.create({
                        data: {
                            stockId: stock.id,
                            reporterName: insider.nm || '',
                            position: insider.ofcps || '',
                            relationship: insider.relate || null,
                            transactionType: insider.chg_rson || '취득',
                            shares: BigInt(String(insider.stkqy || '0').replace(/,/g, '') || '0'),
                            price: insider.pric ? parseFloat(String(insider.pric).replace(/,/g, '')) : null,
                            sharesAfter: insider.trmend_qy ? BigInt(String(insider.trmend_qy).replace(/,/g, '')) : null,
                            transactionDate,
                            reportDate,
                        },
                    });
                    savedCount++;
                } catch (err) {
                    // May fail on duplicate - that's OK
                }
            }

            return {
                success: true,
                count: savedCount,
                message: `Saved ${savedCount} insider trading records for ${stock.name}`,
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect insider trading for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Collect and save financial summary from OpenDART
     */
    async collectFinancialSummary(corpCode: string, bizYear: string, reportCode: string = '11011', userId?: string) {
        try {
            const stock = await this.findStockByCode(corpCode);
            if (!stock) {
                return { success: false, count: 0, message: `Stock with code ${corpCode} not found.` };
            }

            const actualCorpCode = stock.corpCode;
            if (!actualCorpCode) {
                return { success: false, count: 0, message: `Stock ${stock.name} does not have a corpCode set.` };
            }

            const financialData = await this.openDartService.getFinancialSummary(actualCorpCode, bizYear, reportCode, userId);

            if (!financialData || financialData.length === 0) {
                return { success: true, count: 0, message: 'No financial summary data found' };
            }

            const reportDate = new Date();
            const parseAmount = (val: any) => {
                if (!val || val === '-') return null;
                const num = parseFloat(String(val).replace(/,/g, ''));
                return isNaN(num) ? null : num;
            };

            // Map report code to quarter
            const quarterMap: Record<string, string> = {
                '11011': '4Q',
                '11012': '2Q',
                '11013': '1Q',
                '11014': '3Q',
            };
            const quarter = quarterMap[reportCode] || '4Q';

            // Find specific accounts from the data
            let totalAssets: number | null = null, totalLiabilities: number | null = null, totalEquity: number | null = null, capital: number | null = null;
            let revenue: number | null = null, operatingProfit: number | null = null, netIncome: number | null = null;
            let eps: number | null = null, bps: number | null = null;

            for (const item of financialData) {
                const accountName = item.account_nm || '';
                const currentValue = parseAmount(item.thstrm_amount);

                if (accountName.includes('자산총계')) totalAssets = currentValue;
                else if (accountName.includes('부채총계')) totalLiabilities = currentValue;
                else if (accountName.includes('자본총계')) totalEquity = currentValue;
                else if (accountName.includes('자본금') && !accountName.includes('총계')) capital = currentValue;
                else if (accountName.includes('매출액')) revenue = currentValue;
                else if (accountName.includes('영업이익')) operatingProfit = currentValue;
                else if (accountName.includes('당기순이익') || accountName.includes('분기순이익')) netIncome = currentValue;
                else if (accountName.includes('기본주당이익') || accountName.includes('주당순이익')) eps = currentValue;
                else if (accountName.includes('주당순자산')) bps = currentValue;
            }

            await prisma.financialSummary.upsert({
                where: {
                    stockId_bizYear_quarter_isConsolidated: {
                        stockId: stock.id,
                        bizYear,
                        quarter,
                        isConsolidated: true,
                    },
                },
                update: {
                    totalAssets, totalLiabilities, totalEquity, capital,
                    revenue, operatingProfit, netIncome,
                    eps, bps,
                    reportDate,
                },
                create: {
                    stockId: stock.id,
                    totalAssets, totalLiabilities, totalEquity, capital,
                    revenue, operatingProfit, netIncome,
                    eps, bps,
                    bizYear,
                    quarter,
                    reportCode,
                    reportDate,
                    isConsolidated: true,
                },
            });

            return {
                success: true,
                count: 1,
                message: `Saved financial summary for ${stock.name} (${bizYear} ${quarter})`,
                data: { totalAssets, totalLiabilities, totalEquity, revenue, operatingProfit, netIncome, eps, bps },
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect financial summary for ${corpCode}`, error);
            throw error;
        }
    }

    /**
     * Get collected employees for a stock
     */
    async getStockEmployees(stockId: string, bizYear?: string) {
        const where: any = { stockId };
        if (bizYear) where.bizYear = bizYear;

        return prisma.employee.findMany({
            where,
            orderBy: { bizYear: 'desc' },
        });
    }

    /**
     * Get collected financial summaries for a stock
     */
    async getStockFinancials(stockId: string, bizYear?: string) {
        const where: any = { stockId };
        if (bizYear) where.bizYear = bizYear;

        return prisma.financialSummary.findMany({
            where,
            orderBy: [{ bizYear: 'desc' }, { quarter: 'desc' }],
        });
    }

    /**
     * Get collected insider trading for a stock
     */
    async getStockInsiderTrading(stockId: string, limit: number = 50) {
        return prisma.insiderTrading.findMany({
            where: { stockId },
            orderBy: { transactionDate: 'desc' },
            take: limit,
        });
    }

    /**
     * Search disclosures from OpenDART
     */
    async searchDisclosures(
        corpCode: string,
        bgnDe?: string,
        endDe?: string,
        pblntfTy?: string,
        userId?: string
    ) {
        try {
            const disclosures = await this.openDartService.getDisclosureList(
                bgnDe || '',
                endDe || '',
                corpCode,
                userId
            );

            return {
                success: true,
                list: disclosures || [],
                total_count: disclosures?.length || 0,
            };
        } catch (error: any) {
            this.logger.error(`Failed to search disclosures for ${corpCode}`, error);
            return {
                success: false,
                list: [],
                total_count: 0,
                message: error.message || 'Failed to search disclosures',
            };
        }
    }

    /**
     * Collect major event reports from OpenDART
     * Phase 3: Capital increase, merger, spinoff, etc.
     */
    async collectMajorEvents(
        corpCode: string,
        bgnDe: string,
        endDe: string,
        userId?: string
    ) {
        this.logger.log(`Collecting major events for corpCode: ${corpCode}`);

        try {
            // Find stock by corpCode
            const stock = await prisma.stock.findFirst({
                where: { corpCode },
            });

            if (!stock) {
                return { success: false, message: 'Stock not found for this corpCode' };
            }

            // Get all major event reports
            const events = await this.openDartService.getMajorEventReports(
                corpCode,
                bgnDe,
                endDe,
                userId
            );

            let totalInserted = 0;

            // Process capital increase events
            for (const event of events.capitalIncrease || []) {
                await prisma.majorEvent.upsert({
                    where: {
                        id: `${stock.id}_CAPITAL_INCREASE_${event.rcept_no || event.rcept_dt}`,
                    },
                    create: {
                        id: `${stock.id}_CAPITAL_INCREASE_${event.rcept_no || event.rcept_dt}`,
                        stockId: stock.id,
                        eventType: 'CAPITAL_INCREASE',
                        eventSubType: event.piric_nstk_ostk_cnt || '유상증자',
                        shares: event.nstk_ostk_cnt ? BigInt(event.nstk_ostk_cnt.replace(/,/g, '')) : null,
                        amount: event.fdpp_fclt ? parseFloat(event.fdpp_fclt.replace(/,/g, '')) : null,
                        pricePerShare: event.slprc ? parseFloat(event.slprc.replace(/,/g, '')) : null,
                        boardDecisionDate: event.bd_od ? new Date(event.bd_od.replace(/\./g, '-')) : null,
                        reportDate: event.rcept_dt ? new Date(event.rcept_dt.substring(0, 4) + '-' + event.rcept_dt.substring(4, 6) + '-' + event.rcept_dt.substring(6, 8)) : new Date(),
                        purpose: event.ic_mthn,
                        receiptNumber: event.rcept_no,
                    },
                    update: {},
                });
                totalInserted++;
            }

            // Process bonus issue events
            for (const event of events.bonusIssue || []) {
                await prisma.majorEvent.upsert({
                    where: {
                        id: `${stock.id}_BONUS_ISSUE_${event.rcept_no || event.rcept_dt}`,
                    },
                    create: {
                        id: `${stock.id}_BONUS_ISSUE_${event.rcept_no || event.rcept_dt}`,
                        stockId: stock.id,
                        eventType: 'BONUS_ISSUE',
                        shares: event.nstk_ostk_cnt ? BigInt(event.nstk_ostk_cnt.replace(/,/g, '')) : null,
                        boardDecisionDate: event.bd_od ? new Date(event.bd_od.replace(/\./g, '-')) : null,
                        reportDate: event.rcept_dt ? new Date(event.rcept_dt.substring(0, 4) + '-' + event.rcept_dt.substring(4, 6) + '-' + event.rcept_dt.substring(6, 8)) : new Date(),
                        receiptNumber: event.rcept_no,
                    },
                    update: {},
                });
                totalInserted++;
            }

            // Process merger events
            for (const event of events.merger || []) {
                await prisma.majorEvent.upsert({
                    where: {
                        id: `${stock.id}_MERGER_${event.rcept_no || event.rcept_dt}`,
                    },
                    create: {
                        id: `${stock.id}_MERGER_${event.rcept_no || event.rcept_dt}`,
                        stockId: stock.id,
                        eventType: 'MERGER',
                        eventSubType: event.mrgr_form,
                        targetCompany: event.cmpny_nm,
                        amount: event.mrgr_at ? parseFloat(event.mrgr_at.replace(/,/g, '')) : null,
                        boardDecisionDate: event.bd_od ? new Date(event.bd_od.replace(/\./g, '-')) : null,
                        effectiveDate: event.mrgr_pd_de ? new Date(event.mrgr_pd_de.replace(/\./g, '-')) : null,
                        reportDate: event.rcept_dt ? new Date(event.rcept_dt.substring(0, 4) + '-' + event.rcept_dt.substring(4, 6) + '-' + event.rcept_dt.substring(6, 8)) : new Date(),
                        receiptNumber: event.rcept_no,
                    },
                    update: {},
                });
                totalInserted++;
            }

            // Process spinoff events
            for (const event of events.spinoff || []) {
                await prisma.majorEvent.upsert({
                    where: {
                        id: `${stock.id}_SPINOFF_${event.rcept_no || event.rcept_dt}`,
                    },
                    create: {
                        id: `${stock.id}_SPINOFF_${event.rcept_no || event.rcept_dt}`,
                        stockId: stock.id,
                        eventType: 'SPINOFF',
                        eventSubType: event.dv_atn,
                        targetCompany: event.nw_estbs_cmpny_nm,
                        boardDecisionDate: event.bd_od ? new Date(event.bd_od.replace(/\./g, '-')) : null,
                        effectiveDate: event.dv_de ? new Date(event.dv_de.replace(/\./g, '-')) : null,
                        reportDate: event.rcept_dt ? new Date(event.rcept_dt.substring(0, 4) + '-' + event.rcept_dt.substring(4, 6) + '-' + event.rcept_dt.substring(6, 8)) : new Date(),
                        receiptNumber: event.rcept_no,
                    },
                    update: {},
                });
                totalInserted++;
            }

            // Process capital reduction events
            for (const event of events.capitalReduction || []) {
                await prisma.majorEvent.upsert({
                    where: {
                        id: `${stock.id}_CAPITAL_REDUCTION_${event.rcept_no || event.rcept_dt}`,
                    },
                    create: {
                        id: `${stock.id}_CAPITAL_REDUCTION_${event.rcept_no || event.rcept_dt}`,
                        stockId: stock.id,
                        eventType: 'CAPITAL_REDUCTION',
                        eventSubType: event.cr_rs,
                        shares: event.cr_stk_cnt ? BigInt(event.cr_stk_cnt.replace(/,/g, '')) : null,
                        boardDecisionDate: event.bd_od ? new Date(event.bd_od.replace(/\./g, '-')) : null,
                        reportDate: event.rcept_dt ? new Date(event.rcept_dt.substring(0, 4) + '-' + event.rcept_dt.substring(4, 6) + '-' + event.rcept_dt.substring(6, 8)) : new Date(),
                        purpose: event.cr_rs,
                        receiptNumber: event.rcept_no,
                    },
                    update: {},
                });
                totalInserted++;
            }

            // Process treasury stock events
            for (const event of events.treasuryStock || []) {
                await prisma.majorEvent.upsert({
                    where: {
                        id: `${stock.id}_TREASURY_STOCK_${event.rcept_no || event.rcept_dt}`,
                    },
                    create: {
                        id: `${stock.id}_TREASURY_STOCK_${event.rcept_no || event.rcept_dt}`,
                        stockId: stock.id,
                        eventType: 'TREASURY_STOCK',
                        eventSubType: event.aq_dp_atn,
                        shares: event.aq_dp_stk_cnt ? BigInt(event.aq_dp_stk_cnt.replace(/,/g, '')) : null,
                        amount: event.aq_dp_at ? parseFloat(event.aq_dp_at.replace(/,/g, '')) : null,
                        boardDecisionDate: event.bd_od ? new Date(event.bd_od.replace(/\./g, '-')) : null,
                        reportDate: event.rcept_dt ? new Date(event.rcept_dt.substring(0, 4) + '-' + event.rcept_dt.substring(4, 6) + '-' + event.rcept_dt.substring(6, 8)) : new Date(),
                        purpose: event.aq_dp_ppn,
                        receiptNumber: event.rcept_no,
                    },
                    update: {},
                });
                totalInserted++;
            }

            return {
                success: true,
                collected: totalInserted,
                details: {
                    capitalIncrease: events.capitalIncrease?.length || 0,
                    bonusIssue: events.bonusIssue?.length || 0,
                    capitalReduction: events.capitalReduction?.length || 0,
                    merger: events.merger?.length || 0,
                    spinoff: events.spinoff?.length || 0,
                    treasuryStock: events.treasuryStock?.length || 0,
                },
            };
        } catch (error: any) {
            this.logger.error(`Failed to collect major events for ${corpCode}`, error);
            return {
                success: false,
                message: error.message || 'Failed to collect major events',
            };
        }
    }

    /**
     * Get collected major events for a stock
     */
    async getStockMajorEvents(stockId: string, eventType?: string, limit: number = 50) {
        return prisma.majorEvent.findMany({
            where: {
                stockId,
                ...(eventType && { eventType }),
            },
            orderBy: { reportDate: 'desc' },
            take: limit,
        });
    }

    // =====================================
    // System Settings Management
    // =====================================

    /**
     * Get all system settings
     */
    async getSystemSettings() {
        const settings = await prisma.systemSettings.findMany({
            orderBy: [{ category: 'asc' }, { key: 'asc' }],
        });

        // Mask secret values
        return settings.map(setting => ({
            ...setting,
            value: setting.isSecret ? (setting.value ? '••••••••' : null) : setting.value,
        }));
    }

    /**
     * Get a single system setting by key
     */
    async getSystemSettingByKey(key: string) {
        return prisma.systemSettings.findUnique({
            where: { key },
        });
    }

    /**
     * Update a system setting
     */
    async updateSystemSetting(key: string, value: string | null, description?: string) {
        return prisma.systemSettings.upsert({
            where: { key },
            update: { 
                value,
                ...(description && { description }),
            },
            create: {
                key,
                value,
                description,
            },
        });
    }

    /**
     * Update multiple system settings at once
     */
    async updateSystemSettings(settings: { key: string; value: string | null; description?: string; category?: string; isSecret?: boolean }[]) {
        const results = await Promise.all(
            settings.map(async (setting) => {
                return prisma.systemSettings.upsert({
                    where: { key: setting.key },
                    update: { 
                        value: setting.value,
                        ...(setting.description && { description: setting.description }),
                        ...(setting.category && { category: setting.category }),
                        ...(setting.isSecret !== undefined && { isSecret: setting.isSecret }),
                    },
                    create: {
                        key: setting.key,
                        value: setting.value,
                        description: setting.description,
                        category: setting.category || 'general',
                        isSecret: setting.isSecret || false,
                    },
                });
            })
        );

        return { success: true, updated: results.length };
    }

    /**
     * Delete a system setting
     */
    async deleteSystemSetting(key: string) {
        return prisma.systemSettings.delete({
            where: { key },
        });
    }

    /**
     * Get environment variable status (read-only, masked)
     */
    getEnvStatus() {
        const envVars = [
            // Database
            { key: 'DATABASE_URL', category: 'database', isSecret: true },
            // Redis
            { key: 'REDIS_HOST', category: 'redis', isSecret: false },
            { key: 'REDIS_PORT', category: 'redis', isSecret: false },
            { key: 'REDIS_PASSWORD', category: 'redis', isSecret: true },
            // JWT
            { key: 'JWT_SECRET', category: 'auth', isSecret: true },
            { key: 'JWT_EXPIRES_IN', category: 'auth', isSecret: false },
            // KIS API
            { key: 'KIS_APP_KEY', category: 'api', isSecret: true },
            { key: 'KIS_APP_SECRET', category: 'api', isSecret: true },
            { key: 'KIS_ACCOUNT_NUMBER', category: 'api', isSecret: true },
            { key: 'KIS_MOCK_MODE', category: 'api', isSecret: false },
            // OpenAI
            { key: 'OPENAI_API_KEY', category: 'api', isSecret: true },
            // Email
            { key: 'SMTP_HOST', category: 'notification', isSecret: false },
            { key: 'SMTP_PORT', category: 'notification', isSecret: false },
            { key: 'SMTP_USER', category: 'notification', isSecret: false },
            { key: 'SMTP_PASSWORD', category: 'notification', isSecret: true },
            // VAPID
            { key: 'VAPID_PUBLIC_KEY', category: 'notification', isSecret: false },
            { key: 'VAPID_PRIVATE_KEY', category: 'notification', isSecret: true },
            // Application
            { key: 'NODE_ENV', category: 'general', isSecret: false },
            { key: 'API_PORT', category: 'general', isSecret: false },
            { key: 'WEB_PORT', category: 'general', isSecret: false },
            { key: 'API_URL', category: 'general', isSecret: false },
            { key: 'WEB_URL', category: 'general', isSecret: false },
            // Encryption
            { key: 'ENCRYPTION_KEY', category: 'security', isSecret: true },
        ];

        return envVars.map(({ key, category, isSecret }) => {
            const value = process.env[key];
            const hasValue = !!value && value.trim() !== '';

            return {
                key,
                category,
                isSecret,
                hasValue,
                value: hasValue 
                    ? (isSecret ? '••••••••' : value) 
                    : null,
                status: hasValue ? 'configured' : 'not_set',
            };
        });
    }

    /**
     * Initialize default system settings
     */
    async initializeDefaultSettings() {
        const defaultSettings = [
            // API Keys
            { key: 'OPENDART_API_KEY', value: '', description: 'OpenDART API 키 (https://opendart.fss.or.kr/)', category: 'api', isSecret: true },
            { key: 'KIS_APP_KEY', value: '', description: '한국투자증권 App Key', category: 'api', isSecret: true },
            { key: 'KIS_APP_SECRET', value: '', description: '한국투자증권 App Secret', category: 'api', isSecret: true },
            { key: 'KIS_ACCOUNT_NUMBER', value: '', description: '한국투자증권 계좌번호', category: 'api', isSecret: true },
            { key: 'KIS_MOCK_MODE', value: 'true', description: '한국투자증권 모의투자 모드 사용', category: 'api', isSecret: false },
            { key: 'OPENAI_API_KEY', value: '', description: 'OpenAI API 키 (AI 분석용)', category: 'api', isSecret: true },
            { key: 'YAHOO_API_KEY', value: '', description: 'Yahoo Finance API 키 (선택)', category: 'api', isSecret: true },
            
            // Trading Settings
            { key: 'AUTO_TRADE_ENABLED', value: 'false', description: '자동매매 활성화', category: 'trading', isSecret: false },
            { key: 'MAX_DAILY_TRADES', value: '100', description: '일일 최대 거래 수', category: 'trading', isSecret: false },
            { key: 'DEFAULT_STOP_LOSS_PERCENT', value: '5', description: '기본 손절 비율 (%)', category: 'trading', isSecret: false },
            { key: 'DEFAULT_TAKE_PROFIT_PERCENT', value: '10', description: '기본 익절 비율 (%)', category: 'trading', isSecret: false },
            { key: 'MAX_POSITION_PERCENT', value: '20', description: '최대 포지션 비율 (%)', category: 'trading', isSecret: false },
            
            // Notification Settings
            { key: 'NOTIFICATION_ENABLED', value: 'true', description: '알림 활성화', category: 'notification', isSecret: false },
            { key: 'EMAIL_NOTIFICATION_ENABLED', value: 'false', description: '이메일 알림 활성화', category: 'notification', isSecret: false },
            { key: 'PUSH_NOTIFICATION_ENABLED', value: 'true', description: '푸시 알림 활성화', category: 'notification', isSecret: false },
            { key: 'SMTP_HOST', value: 'smtp.gmail.com', description: 'SMTP 서버 주소', category: 'notification', isSecret: false },
            { key: 'SMTP_PORT', value: '587', description: 'SMTP 포트', category: 'notification', isSecret: false },
            { key: 'SMTP_USER', value: '', description: 'SMTP 사용자 이메일', category: 'notification', isSecret: false },
            { key: 'SMTP_PASSWORD', value: '', description: 'SMTP 비밀번호', category: 'notification', isSecret: true },
            { key: 'VAPID_PUBLIC_KEY', value: '', description: 'VAPID 공개 키 (웹 푸시용)', category: 'notification', isSecret: false },
            { key: 'VAPID_PRIVATE_KEY', value: '', description: 'VAPID 비밀 키 (웹 푸시용)', category: 'notification', isSecret: true },
            
            // Data Collection Settings
            { key: 'DATA_COLLECTION_ENABLED', value: 'true', description: '데이터 수집 활성화', category: 'data', isSecret: false },
            { key: 'CANDLE_COLLECTION_INTERVAL', value: '1', description: '캔들 데이터 수집 간격 (분)', category: 'data', isSecret: false },
            { key: 'PRICE_UPDATE_INTERVAL', value: '5', description: '가격 업데이트 간격 (분)', category: 'data', isSecret: false },
            { key: 'NEWS_COLLECTION_ENABLED', value: 'true', description: '뉴스 수집 활성화', category: 'data', isSecret: false },
            
            // General Settings
            { key: 'MAINTENANCE_MODE', value: 'false', description: '유지보수 모드', category: 'general', isSecret: false },
            { key: 'DEBUG_MODE', value: 'false', description: '디버그 모드', category: 'general', isSecret: false },
            { key: 'LOG_LEVEL', value: 'info', description: '로그 레벨 (debug, info, warn, error)', category: 'general', isSecret: false },
            { key: 'SESSION_TIMEOUT', value: '7', description: '세션 만료 시간 (일)', category: 'general', isSecret: false },
            
            // Security Settings
            { key: 'MAX_LOGIN_ATTEMPTS', value: '5', description: '최대 로그인 시도 횟수', category: 'security', isSecret: false },
            { key: 'LOCKOUT_DURATION', value: '30', description: '계정 잠금 시간 (분)', category: 'security', isSecret: false },
            { key: 'REQUIRE_2FA', value: 'false', description: '2단계 인증 필수', category: 'security', isSecret: false },
        ];

        const results = await Promise.all(
            defaultSettings.map(async (setting) => {
                // Only create if not exists
                const existing = await prisma.systemSettings.findUnique({
                    where: { key: setting.key },
                });

                if (!existing) {
                    return prisma.systemSettings.create({
                        data: setting,
                    });
                }

                return existing;
            })
        );

        return { initialized: results.length, settings: results.map(s => s.key) };
    }

    // =====================================
    // Automated Data Collection
    // =====================================

    /**
     * Get data collection status for a stock
     */
    async getStockDataCollectionStatus(stockId: string) {
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
            select: {
                id: true,
                symbol: true,
                name: true,
                corpCode: true,
                corpName: true,
                _count: {
                    select: {
                        executives: true,
                        majorShareholders: true,
                        dividends: true,
                        employees: true,
                        auditOpinions: true,
                        capitalChanges: true,
                        treasuryStocks: true,
                        insiderTradings: true,
                        financialSummaries: true,
                        majorEvents: true,
                    }
                }
            }
        });

        if (!stock) return null;

        return {
            ...stock,
            dataStatus: {
                executives: stock._count.executives > 0,
                majorShareholders: stock._count.majorShareholders > 0,
                dividends: stock._count.dividends > 0,
                employees: stock._count.employees > 0,
                auditOpinions: stock._count.auditOpinions > 0,
                capitalChanges: stock._count.capitalChanges > 0,
                treasuryStocks: stock._count.treasuryStocks > 0,
                insiderTradings: stock._count.insiderTradings > 0,
                financialSummaries: stock._count.financialSummaries > 0,
                majorEvents: stock._count.majorEvents > 0,
            },
            counts: stock._count,
        };
    }

    /**
     * Collect all available OpenDART data for a stock
     * Tries multiple report codes and years for better success rate
     */
    async collectAllDataForStock(
        stockId: string,
        bizYear: string,
        reportCode: string = '11011',
        userId?: string
    ) {
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
            select: { id: true, symbol: true, name: true, corpCode: true }
        });

        if (!stock || !stock.corpCode) {
            return { success: false, message: 'Stock not found or corpCode not set' };
        }

        const results: any = {
            stockId: stock.id,
            stockName: stock.name,
            symbol: stock.symbol,
            corpCode: stock.corpCode,
            bizYear,
            collected: {},
            errors: [],
        };

        // Report codes: 11011=사업보고서, 11012=반기보고서, 11013=1분기, 11014=3분기
        const reportCodes = ['11011', '11012', '11013', '11014'];
        // Years to try: current year-1, current year-2
        const currentYear = new Date().getFullYear();
        const yearsToTry = [bizYear, (parseInt(bizYear) - 1).toString()];

        // Helper function to try collecting with fallback
        const collectWithFallback = async (
            taskName: string,
            collectFn: (corpCode: string, year: string, code: string, userId?: string) => Promise<any>
        ) => {
            // Try all combinations until we find data
            for (const year of yearsToTry) {
                for (const code of reportCodes) {
                    try {
                        const result = await collectFn(stock.corpCode!, year, code, userId);
                        if (result.count && result.count > 0) {
                            this.logger.log(`[Collect] ${taskName} SUCCESS: year=${year}, code=${code}, count=${result.count}`);
                            return result;
                        }
                        // count is 0 or undefined - continue to next combination
                    } catch (error: any) {
                        // Continue to next combination on error
                    }
                }
            }
            return { success: true, count: 0, message: `No ${taskName} data found after trying all combinations` };
        };

        // Tasks that require bizYear and reportCode - use fallback logic
        const fallbackTasks = [
            { name: 'executives', fn: this.collectExecutives.bind(this) },
            { name: 'outsideDirectors', fn: this.collectOutsideDirectors.bind(this) },
            { name: 'majorShareholders', fn: this.collectMajorShareholders.bind(this) },
            { name: 'dividends', fn: this.collectDividends.bind(this) },
            { name: 'employees', fn: this.collectEmployees.bind(this) },
            { name: 'auditOpinion', fn: this.collectAuditOpinion.bind(this) },
            { name: 'financialSummary', fn: this.collectFinancialSummary.bind(this) },
        ];

        // Run fallback tasks
        for (const task of fallbackTasks) {
            try {
                const result = await collectWithFallback(task.name, task.fn) as any;
                results.collected[task.name] = {
                    success: result.success !== false,
                    count: result.count || 0,
                };
            } catch (error: any) {
                this.logger.error(`[collectAllDataForStock] ${task.name} failed: ${error.message}`);
                results.collected[task.name] = { success: false, error: error.message };
                results.errors.push({ task: task.name, error: error.message });
            }
        }

        // Insider trading doesn't require bizYear/reportCode
        try {
            const result = await this.collectInsiderTrading(stock.corpCode!, userId) as any;
            results.collected.insiderTrading = {
                success: result.success !== false,
                count: result.count || 0,
            };
        } catch (error: any) {
            this.logger.error(`[collectAllDataForStock] insiderTrading failed: ${error.message}`);
            results.collected.insiderTrading = { success: false, error: error.message };
            results.errors.push({ task: 'insiderTrading', error: error.message });
        }


        // Collect major events separately (needs date range)
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 3);
            const bgnDe = startDate.toISOString().split('T')[0].replace(/-/g, '');
            const endDe = endDate.toISOString().split('T')[0].replace(/-/g, '');

            const majorEventsResult = await this.collectMajorEvents(stock.corpCode!, bgnDe, endDe, userId);
            results.collected.majorEvents = {
                success: majorEventsResult.success !== false,
                count: majorEventsResult.collected || 0,
            };
        } catch (error: any) {
            results.collected.majorEvents = { success: false, error: error.message };
            results.errors.push({ task: 'majorEvents', error: error.message });
        }

        results.success = results.errors.length === 0;
        results.totalCollected = Object.values(results.collected)
            .filter((c: any) => c.success)
            .reduce((sum: number, c: any) => sum + (c.count || 0), 0);

        // Update lastDataCollectionAt to track that we attempted collection
        await prisma.stock.update({
            where: { id: stockId },
            data: { lastDataCollectionAt: new Date() },
        });

        return results;
    }

    /**
     * Batch collect data for multiple stocks
     */
    async batchCollectData(
        stockIds: string[],
        bizYear: string,
        reportCode: string = '11011',
        userId?: string
    ) {
        const results: any[] = [];
        let processed = 0;
        const total = stockIds.length;

        for (const stockId of stockIds) {
            try {
                const result = await this.collectAllDataForStock(stockId, bizYear, reportCode, userId);
                results.push(result);
                processed++;
                this.logger.log(`Batch collection progress: ${processed}/${total}`);
            } catch (error: any) {
                results.push({
                    stockId,
                    success: false,
                    error: error.message,
                });
                processed++;
            }
        }

        return {
            total,
            processed,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
        };
    }

    /**
     * Get stocks with missing data
     * Excludes stocks that have been attempted within the last 24 hours
     */
    async getStocksWithMissingData(dataType?: string) {
        // Exclude stocks that were collected within the last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const stocks = await prisma.stock.findMany({
            where: {
                corpCode: { not: null },
                // Only KOSPI and KOSDAQ (exclude KONEX, ETF, etc.)
                market: { in: ['KOSPI', 'KOSDAQ'] },
                // Exclude investment companies, funds, etc.
                NOT: {
                    OR: [
                        { name: { contains: '투자회사' } },
                        { name: { contains: '투자신탁' } },
                        { name: { contains: '펀드' } },
                        { name: { contains: 'ETF' } },
                        { name: { contains: 'ETN' } },
                        { name: { contains: '리츠' } },
                        { name: { contains: 'REIT' } },
                        { name: { contains: '스팩' } },
                        { name: { contains: 'SPAC' } },
                    ]
                },
                OR: [
                    { lastDataCollectionAt: null },
                    { lastDataCollectionAt: { lt: oneDayAgo } },
                ],
            },
            select: {
                id: true,
                symbol: true,
                name: true,
                corpCode: true,
                market: true,
                lastDataCollectionAt: true,
                _count: {
                    select: {
                        executives: true,
                        majorShareholders: true,
                        dividends: true,
                        employees: true,
                        auditOpinions: true,
                        financialSummaries: true,
                        insiderTradings: true,
                        majorEvents: true,
                    }
                }
            },
            take: 100,
        });

        return stocks.map(stock => ({
            id: stock.id,
            symbol: stock.symbol,
            name: stock.name,
            corpCode: stock.corpCode,
            missingData: {
                executives: stock._count.executives === 0,
                majorShareholders: stock._count.majorShareholders === 0,
                dividends: stock._count.dividends === 0,
                employees: stock._count.employees === 0,
                auditOpinions: stock._count.auditOpinions === 0,
                financialSummaries: stock._count.financialSummaries === 0,
                insiderTradings: stock._count.insiderTradings === 0,
                majorEvents: stock._count.majorEvents === 0,
            },
            counts: stock._count,
            hasAnyMissing: Object.values(stock._count).some(c => c === 0),
        })).filter(stock => {
            if (!dataType) return stock.hasAnyMissing;
            return (stock.missingData as any)[dataType] === true;
        });
    }

    /**
     * Auto collect missing data for all stocks
     * This method finds all stocks with missing data and collects them automatically
     */
    async autoCollectMissingData(
        bizYear?: string,
        reportCode: string = '11011',
        limit: number = 10,
        userId?: string
    ) {
        // Default to previous year if not specified
        const targetYear = bizYear || (new Date().getFullYear() - 1).toString();
        
        this.logger.log(`[AutoCollect] Starting auto collection for bizYear: ${targetYear}, limit: ${limit}`);

        // Get stocks with missing data
        const stocksWithMissingData = await this.getStocksWithMissingData();
        const stocksToProcess = stocksWithMissingData.slice(0, limit);

        if (stocksToProcess.length === 0) {
            this.logger.log('[AutoCollect] No stocks with missing data found');
            return {
                success: true,
                message: 'No stocks with missing data',
                processed: 0,
                results: [],
            };
        }

        this.logger.log(`[AutoCollect] Found ${stocksWithMissingData.length} stocks with missing data, processing ${stocksToProcess.length}`);

        const results: any[] = [];
        let processed = 0;
        let successful = 0;
        let failed = 0;
        let totalCollected = 0;

        for (const stock of stocksToProcess) {
            try {
                this.logger.log(`[AutoCollect] Processing ${stock.name} (${stock.symbol})`);
                
                const result = await this.collectAllDataForStock(
                    stock.id,
                    targetYear,
                    reportCode,
                    userId
                );

                processed++;
                if (result.success) {
                    successful++;
                    totalCollected += result.totalCollected || 0;
                } else {
                    failed++;
                }

                results.push({
                    stockId: stock.id,
                    symbol: stock.symbol,
                    name: stock.name,
                    success: result.success,
                    totalCollected: result.totalCollected || 0,
                    errors: result.errors || [],
                });

                this.logger.log(`[AutoCollect] Completed ${stock.name}: ${result.totalCollected || 0} records collected`);

                // Add small delay between API calls to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error: any) {
                processed++;
                failed++;
                this.logger.error(`[AutoCollect] Failed to collect for ${stock.name}: ${error.message}`);
                
                results.push({
                    stockId: stock.id,
                    symbol: stock.symbol,
                    name: stock.name,
                    success: false,
                    totalCollected: 0,
                    errors: [{ task: 'all', error: error.message }],
                });
            }
        }

        const summary = {
            success: true,
            message: `Auto collection completed: ${successful}/${processed} stocks successful`,
            bizYear: targetYear,
            totalStocksWithMissingData: stocksWithMissingData.length,
            processed,
            successful,
            failed,
            totalCollected,
            results,
        };

        this.logger.log(`[AutoCollect] Completed: ${JSON.stringify({
            processed,
            successful,
            failed,
            totalCollected
        })}`);

        return summary;
    }
}

