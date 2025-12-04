import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// Custom decorator for rate limiting
export const RATE_LIMIT_KEY = 'rateLimit';
export interface RateLimitOptions {
    points: number; // number of requests
    duration: number; // time window in seconds
}

export const RateLimit = (options: RateLimitOptions) => {
    return (target: any, key?: string, descriptor?: any) => {
        Reflect.defineMetadata(RATE_LIMIT_KEY, options, descriptor?.value || target);
        return descriptor;
    };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
    private store = new Map<string, RateLimitEntry>();
    private cleanupInterval: NodeJS.Timeout;

    // Default rate limit: 100 requests per minute
    private defaultPoints = 100;
    private defaultDuration = 60;

    constructor(private reflector: Reflector) {
        // Cleanup expired entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    onModuleDestroy() {
        clearInterval(this.cleanupInterval);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const key = this.getKey(request);

        // Get rate limit options from decorator or use defaults
        const handler = context.getHandler();
        const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, handler);

        const points = options?.points || this.defaultPoints;
        const duration = options?.duration || this.defaultDuration;

        const now = Date.now();
        const entry = this.store.get(key);

        // Check if entry exists and is still valid
        if (entry && entry.resetTime > now) {
            if (entry.count >= points) {
                const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
                throw new HttpException(
                    {
                        statusCode: HttpStatus.TOO_MANY_REQUESTS,
                        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
                        retryAfter,
                    },
                    HttpStatus.TOO_MANY_REQUESTS
                );
            }
            entry.count++;
        } else {
            // Create new entry
            this.store.set(key, {
                count: 1,
                resetTime: now + duration * 1000,
            });
        }

        // Add rate limit headers to response
        const response = context.switchToHttp().getResponse();
        const currentEntry = this.store.get(key)!;
        response.setHeader('X-RateLimit-Limit', points.toString());
        response.setHeader('X-RateLimit-Remaining', Math.max(0, points - currentEntry.count).toString());
        response.setHeader('X-RateLimit-Reset', Math.ceil(currentEntry.resetTime / 1000).toString());

        return true;
    }

    private getKey(request: any): string {
        // Use user ID if authenticated, otherwise use IP
        const userId = request.user?.id;
        const ip = request.ip || request.connection?.remoteAddress || 'unknown';
        return userId ? `user:${userId}` : `ip:${ip}`;
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (entry.resetTime <= now) {
                this.store.delete(key);
            }
        }
    }
}
