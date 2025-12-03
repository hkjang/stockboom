import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma, DataSourceConfig } from '@stockboom/database';

/**
 * Data Source Configuration Service
 * Manages which API source to use for different metrics
 */
@Injectable()
export class DataSourceService {
    private readonly logger = new Logger(DataSourceService.name);
    private configCache: Map<string, DataSourceConfig> = new Map();

    /**
     * Get data source configuration for a specific metric type
     */
    async getConfig(metricType: string): Promise<DataSourceConfig> {
        // Check cache first
        if (this.configCache.has(metricType)) {
            return this.configCache.get(metricType)!;
        }

        // Fetch from database
        let config = await prisma.dataSourceConfig.findUnique({
            where: { metricType },
        });

        // If not found, use default configuration
        if (!config) {
            config = await this.createDefaultConfig(metricType);
        }

        // Cache the config
        this.configCache.set(metricType, config);
        return config;
    }

    /**
     * Get all data source configurations
     */
    async getAllConfigs(): Promise<DataSourceConfig[]> {
        return prisma.dataSourceConfig.findMany({
            orderBy: { metricType: 'asc' },
        });
    }

    /**
     * Update data source configuration
     */
    async updateConfig(
        metricType: string,
        data: {
            primarySource?: string;
            fallbackSources?: string[];
            isActive?: boolean;
            config?: any;
        }
    ): Promise<DataSourceConfig> {
        const updated = await prisma.dataSourceConfig.update({
            where: { metricType },
            data,
        });

        // Invalidate cache
        this.configCache.delete(metricType);

        this.logger.log(`Updated data source config for ${metricType}`);
        return updated;
    }

    /**
     * Create a new data source configuration
     */
    async createConfig(data: {
        metricType: string;
        primarySource: string;
        fallbackSources?: string[];
        isActive?: boolean;
        config?: any;
    }): Promise<DataSourceConfig> {
        return prisma.dataSourceConfig.create({
            data: {
                metricType: data.metricType,
                primarySource: data.primarySource,
                fallbackSources: data.fallbackSources || [],
                isActive: data.isActive ?? true,
                config: data.config,
            },
        });
    }

    /**
     * Initialize default configurations
     */
    async initializeDefaults(): Promise<void> {
        const defaults = [
            {
                metricType: 'price',
                primarySource: 'kis',
                fallbackSources: ['yahoo'],
            },
            {
                metricType: 'volume',
                primarySource: 'kis',
                fallbackSources: ['yahoo'],
            },
            {
                metricType: 'candles',
                primarySource: 'kis',
                fallbackSources: ['yahoo'],
            },
            {
                metricType: 'company_info',
                primarySource: 'opendart',
                fallbackSources: [],
            },
            {
                metricType: 'financials',
                primarySource: 'opendart',
                fallbackSources: [],
            },
        ];

        for (const config of defaults) {
            try {
                await prisma.dataSourceConfig.upsert({
                    where: { metricType: config.metricType },
                    update: {},
                    create: config,
                });
            } catch (error) {
                this.logger.error(`Failed to initialize config for ${config.metricType}`, error);
            }
        }

        this.logger.log('Initialized data source configurations');
    }

    /**
     * Create default configuration for a metric type
     */
    private async createDefaultConfig(metricType: string): Promise<DataSourceConfig> {
        const defaults: Record<string, { primarySource: string; fallbackSources: string[] }> = {
            price: { primarySource: 'kis', fallbackSources: ['yahoo'] },
            volume: { primarySource: 'kis', fallbackSources: ['yahoo'] },
            candles: { primarySource: 'kis', fallbackSources: ['yahoo'] },
            company_info: { primarySource: 'opendart', fallbackSources: [] },
            financials: { primarySource: 'opendart', fallbackSources: [] },
        };

        const defaultConfig = defaults[metricType] || {
            primarySource: 'yahoo',
            fallbackSources: [],
        };

        return this.createConfig({
            metricType,
            ...defaultConfig,
        });
    }

    /**
     * Clear configuration cache
     */
    clearCache(): void {
        this.configCache.clear();
        this.logger.log('Cleared data source config cache');
    }
}
