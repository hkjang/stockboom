import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from './logger.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';

    // Extract user ID if available
    const userId = (req as any).user?.id;

    // Log request
    this.logger.debug(`--> ${method} ${originalUrl}`, 'HTTP', {
      ip,
      userAgent: userAgent.substring(0, 100),
      userId,
    });

    // Capture response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get('content-length');

      const message = `<-- ${method} ${originalUrl} ${statusCode} ${duration}ms`;
      
      if (statusCode >= 500) {
        this.logger.error(message, undefined, 'HTTP');
      } else if (statusCode >= 400) {
        this.logger.warn(message, 'HTTP');
      } else {
        this.logger.log(message, 'HTTP');
      }
    });

    next();
  }
}

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('Performance');
  }

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const durationMs = Number(endTime - startTime) / 1_000_000;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      // Only log slow requests (>1000ms) or high memory usage (>10MB)
      if (durationMs > 1000 || memoryDelta > 10 * 1024 * 1024) {
        this.logger.warn(`Slow request detected: ${req.method} ${req.originalUrl}`, 'Performance', {
          durationMs: Math.round(durationMs),
          memoryDeltaMB: Math.round(memoryDelta / 1024 / 1024 * 100) / 100,
          heapUsedMB: Math.round(endMemory.heapUsed / 1024 / 1024 * 100) / 100,
        });
      }
    });

    next();
  }
}
