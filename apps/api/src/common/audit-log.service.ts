import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@stockboom/database';

export interface AuditLogData {
    userId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    ipAddress: string;
    userAgent?: string;
    details?: Record<string, any>;
    success?: boolean;
    errorMessage?: string;
}

/**
 * Audit Log Service
 * Tracks sensitive operations for security and compliance
 */
@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    /**
     * Log an action to the audit trail
     */
    async log(data: AuditLogData): Promise<void> {
        try {
            await prisma.auditLog.create({
                data: {
                    userId: data.userId,
                    action: data.action,
                    resource: data.resource,
                    resourceId: data.resourceId,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    details: data.details || {},
                    success: data.success ?? true,
                    errorMessage: data.errorMessage,
                },
            });
        } catch (error) {
            // Don't fail the main operation if audit logging fails
            this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
        }
    }

    /**
     * Log a successful login
     */
    async logLogin(userId: string, ipAddress: string, userAgent?: string): Promise<void> {
        await this.log({
            userId,
            action: 'LOGIN',
            ipAddress,
            userAgent,
            success: true,
        });
    }

    /**
     * Log a failed login attempt
     */
    async logLoginFailed(email: string, ipAddress: string, userAgent?: string, reason?: string): Promise<void> {
        await this.log({
            action: 'LOGIN_FAILED',
            ipAddress,
            userAgent,
            details: { email },
            success: false,
            errorMessage: reason,
        });
    }

    /**
     * Log a trade creation
     */
    async logTradeCreate(userId: string, tradeId: string, ipAddress: string, details?: Record<string, any>): Promise<void> {
        await this.log({
            userId,
            action: 'TRADE_CREATE',
            resource: 'trade',
            resourceId: tradeId,
            ipAddress,
            details,
            success: true,
        });
    }

    /**
     * Log a trade cancellation
     */
    async logTradeCancel(userId: string, tradeId: string, ipAddress: string): Promise<void> {
        await this.log({
            userId,
            action: 'TRADE_CANCEL',
            resource: 'trade',
            resourceId: tradeId,
            ipAddress,
            success: true,
        });
    }

    /**
     * Log a settings update
     */
    async logSettingsUpdate(userId: string, settingType: string, ipAddress: string, changes?: Record<string, any>): Promise<void> {
        await this.log({
            userId,
            action: 'SETTINGS_UPDATE',
            resource: settingType,
            ipAddress,
            details: changes,
            success: true,
        });
    }

    /**
     * Get audit logs for a user
     */
    async getLogsForUser(userId: string, options?: { take?: number; skip?: number }) {
        return prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: options?.take ?? 50,
            skip: options?.skip,
        });
    }

    /**
     * Get recent audit logs (for admin)
     */
    async getRecentLogs(options?: { take?: number; action?: string }) {
        return prisma.auditLog.findMany({
            where: options?.action ? { action: options.action } : undefined,
            orderBy: { createdAt: 'desc' },
            take: options?.take ?? 100,
        });
    }
}
