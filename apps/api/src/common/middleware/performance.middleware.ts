import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Performance Monitoring Middleware
 * Tracks API response times and logs slow requests
 */
@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
    private readonly logger = new Logger('PerformanceMonitor');
    private readonly SLOW_REQUEST_THRESHOLD = 1000; // 1 second

    use(req: Request, res: Response, next: NextFunction) {
        const startTime = Date.now();
        const { method, originalUrl } = req;

        // Log when response finishes
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const { statusCode } = res;

            // Log basic info
            this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);

            // Warn on slow requests
            if (duration > this.SLOW_REQUEST_THRESHOLD) {
                this.logger.warn(
                    `SLOW REQUEST: ${method} ${originalUrl} took ${duration}ms`
                );
            }

            // TODO: Store metrics in Redis for dashboard
            // await this.metricsService.recordRequest(method, originalUrl, duration, statusCode);
        });

        next();
    }
}
