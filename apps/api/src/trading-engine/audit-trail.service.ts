import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AuditEvent,
  AuditEventType,
  AuditSeverity,
  AuditFilter,
} from './trading-engine.types';
import { prisma } from '@stockboom/database';

/**
 * Audit Trail Service
 * 모든 거래 활동의 감사 추적 서비스
 */
@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * 감사 이벤트 기록
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          eventType: event.eventType,
          severity: event.severity,
          eventData: {
            action: event.action,
            details: event.details,
            timestamp: event.timestamp.toISOString(),
          },
        },
      });

      // 중요 이벤트는 실시간 알림 발행
      if (event.severity === 'ERROR' || event.severity === 'CRITICAL') {
        this.eventEmitter.emit('audit.critical', event);
      }
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${error.message}`);
    }
  }

  /**
   * 주문 이벤트 기록
   */
  async logOrderEvent(
    userId: string,
    action: string,
    details: Record<string, any>,
    severity: AuditSeverity = 'INFO',
  ): Promise<void> {
    await this.log({
      userId,
      eventType: 'ORDER',
      severity,
      action,
      details,
      timestamp: new Date(),
    });
  }

  /**
   * 전략 실행 이벤트 기록
   */
  async logStrategyEvent(
    userId: string,
    strategyId: string,
    action: string,
    details: Record<string, any>,
    severity: AuditSeverity = 'INFO',
  ): Promise<void> {
    await this.log({
      userId,
      eventType: 'STRATEGY',
      severity,
      action,
      details: { strategyId, ...details },
      timestamp: new Date(),
    });
  }

  /**
   * 리스크 이벤트 기록
   */
  async logRiskEvent(
    userId: string,
    action: string,
    details: Record<string, any>,
    severity: AuditSeverity = 'WARNING',
  ): Promise<void> {
    await this.log({
      userId,
      eventType: 'RISK',
      severity,
      action,
      details,
      timestamp: new Date(),
    });

    // 리스크 이벤트 DB에도 별도 저장
    try {
      await prisma.riskEvent.create({
        data: {
          userId,
          eventType: details.riskType || 'UNKNOWN',
          threshold: details.threshold || null,
          actualValue: details.actualValue || null,
          action: action,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to save risk event: ${error.message}`);
    }
  }

  /**
   * 세션 이벤트 기록
   */
  async logSessionEvent(
    userId: string,
    action: string,
    details: Record<string, any>,
    severity: AuditSeverity = 'INFO',
  ): Promise<void> {
    await this.log({
      userId,
      eventType: 'SESSION',
      severity,
      action,
      details,
      timestamp: new Date(),
    });
  }

  /**
   * 시스템 이벤트 기록
   */
  async logSystemEvent(
    userId: string,
    action: string,
    details: Record<string, any>,
    severity: AuditSeverity = 'INFO',
  ): Promise<void> {
    await this.log({
      userId,
      eventType: 'SYSTEM',
      severity,
      action,
      details,
      timestamp: new Date(),
    });
  }

  /**
   * 감사 로그 조회
   */
  async getAuditLogs(userId: string, filter: AuditFilter = {}): Promise<any[]> {
    const where: any = { userId };

    if (filter.startDate) {
      where.createdAt = { gte: filter.startDate };
    }
    if (filter.endDate) {
      where.createdAt = { ...where.createdAt, lte: filter.endDate };
    }
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      where.eventType = { in: filter.eventTypes };
    }
    if (filter.severity && filter.severity.length > 0) {
      where.severity = { in: filter.severity };
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter.limit || 100,
      skip: filter.offset || 0,
    });
  }

  /**
   * 오늘의 리스크 이벤트 수 조회
   */
  async getTodayRiskEventCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.riskEvent.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });
  }

  /**
   * 최근 중요 이벤트 조회
   */
  async getRecentCriticalEvents(
    userId: string,
    hours: number = 24,
  ): Promise<any[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return prisma.auditLog.findMany({
      where: {
        userId,
        severity: { in: ['ERROR', 'CRITICAL'] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
