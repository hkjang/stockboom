import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { prisma } from '@stockboom/database';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ServiceHealth;
    redis: ServiceHealth;
    memory: MemoryHealth;
  };
}

interface ServiceHealth {
  status: 'ok' | 'down';
  latencyMs?: number;
  error?: string;
}

interface MemoryHealth {
  status: 'ok' | 'warning';
  heapUsedMB: number;
  heapTotalMB: number;
  usagePercent: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startTime: Date;
  private redis: Redis | null = null;

  constructor(private configService: ConfigService) {
    this.startTime = new Date();
    this.initRedis();
  }

  private async initRedis() {
    try {
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
      });
    } catch {
      this.redis = null;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async basicHealth(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with dependency status' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  async detailedHealth(): Promise<HealthStatus> {
    const [dbHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const memoryHealth = this.checkMemory();
    const overallStatus = this.determineOverallStatus(dbHealth, redisHealth, memoryHealth);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      checks: {
        database: dbHealth,
        redis: redisHealth,
        memory: memoryHealth,
      },
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness(): Promise<{ status: string; ready: boolean }> {
    const dbHealth = await this.checkDatabase();
    const ready = dbHealth.status === 'ok';

    return { 
      status: ready ? 'ok' : 'not_ready',
      ready,
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      if (!this.redis) {
        await this.initRedis();
      }
      if (!this.redis) {
        return { status: 'down', error: 'Redis client not initialized' };
      }
      await this.redis.ping();
      return {
        status: 'ok',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkMemory(): MemoryHealth {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100;
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100;
    const usagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

    return {
      status: usagePercent > 90 ? 'warning' : 'ok',
      heapUsedMB,
      heapTotalMB,
      usagePercent,
    };
  }

  private determineOverallStatus(
    db: ServiceHealth,
    redis: ServiceHealth,
    memory: MemoryHealth,
  ): 'ok' | 'degraded' | 'down' {
    if (db.status === 'down') return 'down';
    if (redis.status === 'down' || memory.status === 'warning') return 'degraded';
    return 'ok';
  }
}
