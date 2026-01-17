/**
 * Market Hours Service
 * 시장 시간 관리 서비스
 * 
 * 자동화 기능:
 * - 장 시작/종료 자동 감지
 * - 프리마켓 준비 작업
 * - 장마감 청산 옵션
 * - 휴장일 처리
 * - 해외 시장 시간대 지원
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma } from '@stockboom/database';

export type MarketSession = 
  | 'PRE_MARKET'    // 프리마켓 (08:00-09:00)
  | 'REGULAR'       // 정규장 (09:00-15:30)
  | 'CLOSING'       // 마감 동시호가 (15:20-15:30)
  | 'AFTER_HOURS'   // 장외 (15:30-18:00)
  | 'CLOSED';       // 휴장

export type MarketType = 'KRX' | 'NYSE' | 'NASDAQ' | 'HKG' | 'TYO';

export interface MarketHours {
  market: MarketType;
  preMarketStart: string;   // HH:mm
  marketOpen: string;
  closingStart: string;
  marketClose: string;
  afterHoursEnd: string;
  timezone: string;
}

export interface MarketStatus {
  market: MarketType;
  session: MarketSession;
  isOpen: boolean;
  nextOpen?: Date;
  nextClose?: Date;
  minutesToOpen?: number;
  minutesToClose?: number;
  isHoliday: boolean;
  holidayName?: string;
}

// 2026년 한국 주식 시장 휴장일
const KRX_HOLIDAYS_2026 = [
  '2026-01-01', // 신정
  '2026-01-27', // 설날 연휴
  '2026-01-28', // 설날
  '2026-01-29', // 설날 연휴
  '2026-03-01', // 삼일절
  '2026-05-05', // 어린이날
  '2026-05-24', // 부처님 오신날 (예상)
  '2026-06-06', // 현충일
  '2026-08-15', // 광복절
  '2026-09-24', // 추석 연휴
  '2026-09-25', // 추석
  '2026-09-26', // 추석 연휴
  '2026-10-03', // 개천절
  '2026-10-09', // 한글날
  '2026-12-25', // 크리스마스
];

@Injectable()
export class MarketHoursService implements OnModuleInit {
  private readonly logger = new Logger(MarketHoursService.name);

  // 시장별 거래 시간
  private readonly MARKET_HOURS: Record<MarketType, MarketHours> = {
    KRX: {
      market: 'KRX',
      preMarketStart: '08:00',
      marketOpen: '09:00',
      closingStart: '15:20',
      marketClose: '15:30',
      afterHoursEnd: '18:00',
      timezone: 'Asia/Seoul',
    },
    NYSE: {
      market: 'NYSE',
      preMarketStart: '04:00',
      marketOpen: '09:30',
      closingStart: '15:50',
      marketClose: '16:00',
      afterHoursEnd: '20:00',
      timezone: 'America/New_York',
    },
    NASDAQ: {
      market: 'NASDAQ',
      preMarketStart: '04:00',
      marketOpen: '09:30',
      closingStart: '15:50',
      marketClose: '16:00',
      afterHoursEnd: '20:00',
      timezone: 'America/New_York',
    },
    HKG: {
      market: 'HKG',
      preMarketStart: '09:00',
      marketOpen: '09:30',
      closingStart: '15:50',
      marketClose: '16:00',
      afterHoursEnd: '17:00',
      timezone: 'Asia/Hong_Kong',
    },
    TYO: {
      market: 'TYO',
      preMarketStart: '08:00',
      marketOpen: '09:00',
      closingStart: '14:50',
      marketClose: '15:00',
      afterHoursEnd: '16:00',
      timezone: 'Asia/Tokyo',
    },
  };

  // 현재 세션 캐시
  private currentSessions = new Map<MarketType, MarketSession>();

  constructor(private eventEmitter: EventEmitter2) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('MarketHoursService initialized');
    
    // 초기 세션 상태 설정
    for (const market of Object.keys(this.MARKET_HOURS) as MarketType[]) {
      const session = this.getCurrentSession(market);
      this.currentSessions.set(market, session);
    }
  }

  /**
   * 현재 세션 조회
   */
  getCurrentSession(market: MarketType = 'KRX'): MarketSession {
    const hours = this.MARKET_HOURS[market];
    const now = this.getMarketTime(market);
    const timeStr = this.formatTime(now);

    // 휴일 체크
    if (this.isHoliday(market, now)) {
      return 'CLOSED';
    }

    // 주말 체크
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'CLOSED';
    }

    // 세션 결정
    if (timeStr >= hours.preMarketStart && timeStr < hours.marketOpen) {
      return 'PRE_MARKET';
    } else if (timeStr >= hours.marketOpen && timeStr < hours.closingStart) {
      return 'REGULAR';
    } else if (timeStr >= hours.closingStart && timeStr < hours.marketClose) {
      return 'CLOSING';
    } else if (timeStr >= hours.marketClose && timeStr < hours.afterHoursEnd) {
      return 'AFTER_HOURS';
    }

    return 'CLOSED';
  }

  /**
   * 시장 상태 조회
   */
  getMarketStatus(market: MarketType = 'KRX'): MarketStatus {
    const hours = this.MARKET_HOURS[market];
    const now = this.getMarketTime(market);
    const session = this.getCurrentSession(market);
    const timeStr = this.formatTime(now);

    const isOpen = session === 'REGULAR' || session === 'CLOSING';
    const holiday = this.getHolidayName(market, now);

    // 다음 시장 오픈/클로즈 시간 계산
    let nextOpen: Date | undefined;
    let nextClose: Date | undefined;
    let minutesToOpen: number | undefined;
    let minutesToClose: number | undefined;

    if (!isOpen) {
      nextOpen = this.getNextMarketOpen(market);
      minutesToOpen = nextOpen 
        ? Math.round((nextOpen.getTime() - now.getTime()) / 60000)
        : undefined;
    } else {
      nextClose = this.parseMarketTime(market, hours.marketClose);
      minutesToClose = nextClose
        ? Math.round((nextClose.getTime() - now.getTime()) / 60000)
        : undefined;
    }

    return {
      market,
      session,
      isOpen,
      nextOpen,
      nextClose,
      minutesToOpen,
      minutesToClose,
      isHoliday: !!holiday,
      holidayName: holiday,
    };
  }

  /**
   * 장 중인지 확인
   */
  isMarketOpen(market: MarketType = 'KRX'): boolean {
    const session = this.getCurrentSession(market);
    return session === 'REGULAR' || session === 'CLOSING';
  }

  /**
   * 거래 가능 여부
   */
  canTrade(market: MarketType = 'KRX'): boolean {
    const session = this.getCurrentSession(market);
    return session === 'REGULAR'; // 마감 동시호가 제외
  }

  /**
   * 다음 장 시작 시간
   */
  getNextMarketOpen(market: MarketType = 'KRX'): Date {
    const hours = this.MARKET_HOURS[market];
    const now = this.getMarketTime(market);
    
    let targetDate = new Date(now);
    
    // 오늘 장 시작 전이면 오늘, 아니면 다음 거래일
    const todayOpen = this.parseMarketTime(market, hours.marketOpen);
    
    if (now < todayOpen && !this.isHoliday(market, now) && now.getDay() !== 0 && now.getDay() !== 6) {
      return todayOpen;
    }
    
    // 다음 거래일 찾기
    for (let i = 1; i <= 7; i++) {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + i);
      
      const dayOfWeek = targetDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !this.isHoliday(market, targetDate)) {
        const [hours, minutes] = this.MARKET_HOURS[market].marketOpen.split(':');
        targetDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return targetDate;
      }
    }
    
    return targetDate;
  }

  /**
   * 휴일 여부 확인
   */
  isHoliday(market: MarketType, date: Date): boolean {
    const dateStr = this.formatDate(date);
    
    if (market === 'KRX') {
      return KRX_HOLIDAYS_2026.includes(dateStr);
    }
    
    // TODO: 다른 시장 휴장일 추가
    return false;
  }

  /**
   * 휴일 이름 조회
   */
  private getHolidayName(market: MarketType, date: Date): string | undefined {
    if (!this.isHoliday(market, date)) return undefined;
    
    const dateStr = this.formatDate(date);
    
    // KRX 휴장일 이름
    const krxHolidayNames: Record<string, string> = {
      '2026-01-01': '신정',
      '2026-01-27': '설날 연휴',
      '2026-01-28': '설날',
      '2026-01-29': '설날 연휴',
      '2026-03-01': '삼일절',
      '2026-05-05': '어린이날',
      '2026-05-24': '부처님 오신날',
      '2026-06-06': '현충일',
      '2026-08-15': '광복절',
      '2026-09-24': '추석 연휴',
      '2026-09-25': '추석',
      '2026-09-26': '추석 연휴',
      '2026-10-03': '개천절',
      '2026-10-09': '한글날',
      '2026-12-25': '크리스마스',
    };
    
    return krxHolidayNames[dateStr];
  }

  /**
   * 시장 시간대 현재 시간
   */
  private getMarketTime(market: MarketType): Date {
    // 실제 구현에서는 timezone 변환 필요
    // 현재는 서버 시간 사용 (Asia/Seoul)
    return new Date();
  }

  /**
   * 시간 문자열 파싱
   */
  private parseMarketTime(market: MarketType, timeStr: string): Date {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    now.setHours(hours, minutes, 0, 0);
    return now;
  }

  /**
   * 시간 포맷팅 (HH:mm)
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 날짜 포맷팅 (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ============================================
  // 자동화 스케줄
  // ============================================

  /**
   * 프리마켓 준비 (08:00)
   */
  @Cron('0 0 8 * * 1-5', { timeZone: 'Asia/Seoul' })
  async onPreMarketStart(): Promise<void> {
    const status = this.getMarketStatus('KRX');
    if (status.isHoliday) return;

    this.logger.log('📊 Pre-market started - Preparing trading session');
    
    this.eventEmitter.emit('market.pre-open', {
      market: 'KRX',
      time: new Date(),
    });

    // 신호 분석 시작
    this.eventEmitter.emit('trading.prepare', {
      market: 'KRX',
      action: 'ANALYZE_SIGNALS',
    });
  }

  /**
   * 장 시작 (09:00)
   */
  @Cron('0 0 9 * * 1-5', { timeZone: 'Asia/Seoul' })
  async onMarketOpen(): Promise<void> {
    const status = this.getMarketStatus('KRX');
    if (status.isHoliday) return;

    this.logger.log('🔔 Market opened - Starting auto trading');
    
    this.currentSessions.set('KRX', 'REGULAR');
    
    this.eventEmitter.emit('market.open', {
      market: 'KRX',
      time: new Date(),
    });

    // 자동매매 세션 활성화
    await this.activateAutoTradingSessions();
  }

  /**
   * 마감 동시호가 시작 (15:20)
   */
  @Cron('0 20 15 * * 1-5', { timeZone: 'Asia/Seoul' })
  async onClosingStart(): Promise<void> {
    const status = this.getMarketStatus('KRX');
    if (status.isHoliday) return;

    this.logger.log('⏰ Closing auction started');
    
    this.currentSessions.set('KRX', 'CLOSING');
    
    this.eventEmitter.emit('market.closing', {
      market: 'KRX',
      time: new Date(),
      minutesToClose: 10,
    });

    // 당일 청산 옵션 처리
    await this.handleEndOfDayClosing();
  }

  /**
   * 장 마감 (15:30)
   */
  @Cron('0 30 15 * * 1-5', { timeZone: 'Asia/Seoul' })
  async onMarketClose(): Promise<void> {
    const status = this.getMarketStatus('KRX');
    if (status.isHoliday) return;

    this.logger.log('🔕 Market closed');
    
    this.currentSessions.set('KRX', 'AFTER_HOURS');
    
    this.eventEmitter.emit('market.close', {
      market: 'KRX',
      time: new Date(),
    });

    // 자동매매 세션 일시정지
    await this.pauseAutoTradingSessions();

    // 당일 성과 집계
    this.eventEmitter.emit('trading.daily-summary', {
      market: 'KRX',
      date: new Date(),
    });
  }

  /**
   * 자동매매 세션 활성화
   */
  private async activateAutoTradingSessions(): Promise<void> {
    const sessions = await prisma.autoTradingSession.findMany({
      where: { status: 'PAUSED' },
    });

    for (const session of sessions) {
      await prisma.autoTradingSession.update({
        where: { id: session.id },
        data: { status: 'RUNNING' },
      });
      
      this.eventEmitter.emit('auto-trading.resumed', {
        userId: session.userId,
        sessionId: session.id,
      });
    }

    this.logger.log(`Activated ${sessions.length} auto-trading sessions`);
  }

  /**
   * 자동매매 세션 일시정지
   */
  private async pauseAutoTradingSessions(): Promise<void> {
    const sessions = await prisma.autoTradingSession.findMany({
      where: { status: 'RUNNING' },
    });

    for (const session of sessions) {
      await prisma.autoTradingSession.update({
        where: { id: session.id },
        data: { status: 'PAUSED' },
      });
      
      this.eventEmitter.emit('auto-trading.paused', {
        userId: session.userId,
        sessionId: session.id,
        reason: 'MARKET_CLOSED',
      });
    }

    this.logger.log(`Paused ${sessions.length} auto-trading sessions`);
  }

  /**
   * 당일 청산 처리
   */
  private async handleEndOfDayClosing(): Promise<void> {
    // 당일 청산 옵션이 활성화된 세션 조회
    const sessions = await prisma.autoTradingSession.findMany({
      where: {
        status: 'RUNNING',
        config: {
          path: ['closePositionsEOD'],
          equals: true,
        },
      },
    });

    for (const session of sessions) {
      this.eventEmitter.emit('trading.close-positions', {
        userId: session.userId,
        reason: 'END_OF_DAY',
      });
    }

    if (sessions.length > 0) {
      this.logger.log(`Initiated EOD closing for ${sessions.length} sessions`);
    }
  }

  /**
   * 세션 상태 변화 감지 (매분)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSessionChanges(): Promise<void> {
    for (const market of ['KRX'] as MarketType[]) {
      const previousSession = this.currentSessions.get(market);
      const currentSession = this.getCurrentSession(market);

      if (previousSession !== currentSession) {
        this.currentSessions.set(market, currentSession);
        
        this.eventEmitter.emit('market.session-changed', {
          market,
          previousSession,
          currentSession,
          time: new Date(),
        });

        this.logger.log(`Market session changed: ${previousSession} -> ${currentSession}`);
      }
    }
  }
}
