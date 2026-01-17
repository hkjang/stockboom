import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditTrailService } from './audit-trail.service';

/**
 * Circuit Breaker Service
 * 시스템 보호 메커니즘 - 비정상 상황 발생 시 자동 거래 중단
 * 
 * States:
 * - CLOSED: 정상 상태, 모든 거래 허용
 * - OPEN: 트리거됨, 모든 거래 차단
 * - HALF_OPEN: 복구 시도 중, 제한적 거래 허용
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  // 사용자별 서킷 브레이커 상태
  private states = new Map<string, 'CLOSED' | 'OPEN' | 'HALF_OPEN'>();
  private tripReasons = new Map<string, string>();
  private tripTimestamps = new Map<string, Date>();
  private failureCounts = new Map<string, number>();

  // 설정
  private readonly FAILURE_THRESHOLD = 5;  // 연속 실패 횟수 임계값
  private readonly RECOVERY_TIMEOUT = 5 * 60 * 1000;  // 5분 후 복구 시도
  private readonly HALF_OPEN_SUCCESS_THRESHOLD = 3;  // 복구 성공 횟수

  private halfOpenSuccessCount = new Map<string, number>();

  constructor(
    private eventEmitter: EventEmitter2,
    private auditTrailService: AuditTrailService,
  ) {
    // 주기적으로 복구 시도
    setInterval(() => this.attemptAutoRecovery(), 60 * 1000);
  }

  /**
   * 현재 상태 조회
   */
  getState(userId: string): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.states.get(userId) || 'CLOSED';
  }

  /**
   * 서킷 브레이커 트리거 사유 조회
   */
  getTripReason(userId: string): string | undefined {
    return this.tripReasons.get(userId);
  }

  /**
   * 주문 가능 여부 확인
   */
  canPlaceOrder(userId: string): boolean {
    const state = this.getState(userId);
    return state !== 'OPEN';
  }

  /**
   * 서킷 브레이커 트리거
   */
  async trip(
    userId: string,
    reason: string,
    severity: 'WARNING' | 'CRITICAL' = 'CRITICAL',
  ): Promise<void> {
    const previousState = this.getState(userId);
    this.states.set(userId, 'OPEN');
    this.tripReasons.set(userId, reason);
    this.tripTimestamps.set(userId, new Date());

    this.logger.warn(
      `⚡ Circuit breaker TRIPPED for user ${userId}: ${reason}`,
    );

    // 감사 로그
    await this.auditTrailService.logRiskEvent(
      userId,
      'CIRCUIT_BREAKER_TRIPPED',
      {
        reason,
        severity,
        previousState,
        triggeredAt: new Date().toISOString(),
      },
      severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
    );

    // 이벤트 발행 (알림 등)
    this.eventEmitter.emit('circuit-breaker.tripped', {
      userId,
      reason,
      severity,
    });
  }

  /**
   * 실패 기록 (자동 트리거용)
   */
  async recordFailure(userId: string, error: string): Promise<void> {
    const count = (this.failureCounts.get(userId) || 0) + 1;
    this.failureCounts.set(userId, count);

    this.logger.warn(`Failure recorded for user ${userId}: ${count} failures`);

    if (count >= this.FAILURE_THRESHOLD) {
      await this.trip(
        userId,
        `연속 ${count}회 주문 실패: ${error}`,
        'CRITICAL',
      );
    }
  }

  /**
   * 성공 기록 (실패 카운트 리셋)
   */
  recordSuccess(userId: string): void {
    const state = this.getState(userId);
    
    // HALF_OPEN 상태에서 성공 기록
    if (state === 'HALF_OPEN') {
      const successCount = (this.halfOpenSuccessCount.get(userId) || 0) + 1;
      this.halfOpenSuccessCount.set(userId, successCount);

      if (successCount >= this.HALF_OPEN_SUCCESS_THRESHOLD) {
        this.reset(userId);
      }
    }

    // 실패 카운트 리셋
    this.failureCounts.set(userId, 0);
  }

  /**
   * 수동 복구
   */
  async reset(userId: string): Promise<void> {
    const previousState = this.getState(userId);
    const reason = this.tripReasons.get(userId);

    this.states.set(userId, 'CLOSED');
    this.tripReasons.delete(userId);
    this.tripTimestamps.delete(userId);
    this.failureCounts.set(userId, 0);
    this.halfOpenSuccessCount.delete(userId);

    this.logger.log(`✅ Circuit breaker RESET for user ${userId}`);

    // 감사 로그
    await this.auditTrailService.logRiskEvent(
      userId,
      'CIRCUIT_BREAKER_RESET',
      {
        previousState,
        previousReason: reason,
        resetAt: new Date().toISOString(),
      },
      'INFO',
    );

    // 이벤트 발행
    this.eventEmitter.emit('circuit-breaker.reset', { userId });
  }

  /**
   * 복구 시도 (HALF_OPEN 상태로 전환)
   */
  async attemptRecovery(userId: string): Promise<boolean> {
    const state = this.getState(userId);
    
    if (state !== 'OPEN') {
      return true; // 이미 정상 상태
    }

    const tripTime = this.tripTimestamps.get(userId);
    if (!tripTime) {
      return false;
    }

    const elapsed = Date.now() - tripTime.getTime();
    if (elapsed < this.RECOVERY_TIMEOUT) {
      return false; // 아직 타임아웃 안됨
    }

    // HALF_OPEN 상태로 전환
    this.states.set(userId, 'HALF_OPEN');
    this.halfOpenSuccessCount.set(userId, 0);

    this.logger.log(
      `🔄 Circuit breaker entering HALF_OPEN for user ${userId}`,
    );

    await this.auditTrailService.logRiskEvent(
      userId,
      'CIRCUIT_BREAKER_HALF_OPEN',
      {
        tripReason: this.tripReasons.get(userId),
        elapsed: elapsed / 1000,
      },
      'INFO',
    );

    return true;
  }

  /**
   * 모든 사용자 자동 복구 시도
   */
  private async attemptAutoRecovery(): Promise<void> {
    for (const [userId, state] of this.states.entries()) {
      if (state === 'OPEN') {
        await this.attemptRecovery(userId);
      }
    }
  }

  /**
   * 서킷 브레이커 상태 요약
   */
  getStatus(userId: string): {
    state: string;
    reason?: string;
    trippedAt?: Date;
    failureCount: number;
  } {
    return {
      state: this.getState(userId),
      reason: this.tripReasons.get(userId),
      trippedAt: this.tripTimestamps.get(userId),
      failureCount: this.failureCounts.get(userId) || 0,
    };
  }

  /**
   * 강제 트리거 (관리자용)
   */
  async forceTrip(
    userId: string,
    reason: string,
    adminId: string,
  ): Promise<void> {
    await this.trip(userId, `관리자 강제 중단: ${reason}`, 'CRITICAL');
    
    await this.auditTrailService.logSystemEvent(
      userId,
      'ADMIN_FORCE_TRIP',
      { adminId, reason },
      'WARNING',
    );
  }

  /**
   * 강제 복구 (관리자용)
   */
  async forceReset(userId: string, adminId: string): Promise<void> {
    await this.reset(userId);
    
    await this.auditTrailService.logSystemEvent(
      userId,
      'ADMIN_FORCE_RESET',
      { adminId },
      'INFO',
    );
  }
}
