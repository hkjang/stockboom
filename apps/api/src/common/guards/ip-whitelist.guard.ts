import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma } from '@stockboom/database';

/**
 * Decorator to require IP whitelist check on specific endpoints
 */
export const IP_WHITELIST_KEY = 'ipWhitelist';
export const RequireIpWhitelist = () => {
    return (target: any, key?: string, descriptor?: any) => {
        Reflect.defineMetadata(IP_WHITELIST_KEY, true, descriptor?.value || target);
        return descriptor;
    };
};

/**
 * IP Whitelist Guard
 * Verifies that requests come from allowed IP addresses for users who have enabled IP whitelisting.
 * Apply to sensitive endpoints like trading, settings changes, etc.
 */
@Injectable()
export class IpWhitelistGuard implements CanActivate {
    private readonly logger = new Logger(IpWhitelistGuard.name);

    constructor(private reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if endpoint requires IP whitelist verification
        const requiresWhitelist = this.reflector.get<boolean>(
            IP_WHITELIST_KEY,
            context.getHandler(),
        );

        // If endpoint doesn't require whitelist, allow
        if (!requiresWhitelist) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // If no user (not authenticated), let other guards handle it
        if (!user?.id) {
            return true;
        }

        // Get user's IP whitelist settings
        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                ipWhitelistEnabled: true,
                allowedIps: true,
            },
        });

        // If user doesn't have whitelist enabled, allow
        if (!userData?.ipWhitelistEnabled) {
            return true;
        }

        // Get client IP
        const clientIp = this.getClientIp(request);

        // Check if client IP is in the allowed list
        const allowedIps = userData.allowedIps || [];

        if (allowedIps.length === 0) {
            // If whitelist is enabled but empty, this is a configuration error
            this.logger.warn(`User ${user.id} has IP whitelist enabled but no IPs configured`);
            throw new ForbiddenException(
                'IP whitelist is enabled but no IPs are configured. Please add your IP address in settings.',
            );
        }

        const isAllowed = allowedIps.some(ip => this.matchIp(clientIp, ip));

        if (!isAllowed) {
            this.logger.warn(
                `Access denied for user ${user.id} from IP ${clientIp}. Allowed IPs: ${allowedIps.join(', ')}`,
            );
            throw new ForbiddenException(
                `Access denied. Your IP address (${clientIp}) is not in the allowed list.`,
            );
        }

        return true;
    }

    /**
     * Get client IP from request, handling proxies
     */
    private getClientIp(request: any): string {
        const forwardedFor = request.headers['x-forwarded-for'];
        if (forwardedFor) {
            // Get the first IP in the chain (original client)
            return forwardedFor.split(',')[0].trim();
        }

        return request.ip ||
            request.connection?.remoteAddress ||
            request.socket?.remoteAddress ||
            'unknown';
    }

    /**
     * Match IP address (supports CIDR notation in future)
     */
    private matchIp(clientIp: string, allowedIp: string): boolean {
        // Normalize IPv6 localhost
        const normalizedClientIp = clientIp === '::1' ? '127.0.0.1' : clientIp;
        const normalizedAllowedIp = allowedIp === '::1' ? '127.0.0.1' : allowedIp;

        // Simple exact match for now
        // TODO: Add CIDR support (e.g., 192.168.1.0/24)
        return normalizedClientIp === normalizedAllowedIp;
    }
}
