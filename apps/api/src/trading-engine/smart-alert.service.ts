/**
 * Smart Alert Service
 * 스마트 알림 서비스
 * 
 * 전문가급 알림:
 * - 가격 목표 도달 알림
 * - 기술적 신호 알림 (RSI/MACD)
 * - AI 추천 알림
 * - 포트폴리오 이벤트 알림
 * - 손익 임계값 알림
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@stockboom/database';

export type AlertType = 
  | 'PRICE_TARGET'      // 목표가 도달
  | 'PRICE_DROP'        // 급락 경고
  | 'PRICE_SURGE'       // 급등 알림
  | 'RSI_OVERSOLD'      // RSI 과매도
  | 'RSI_OVERBOUGHT'    // RSI 과매수
  | 'MACD_CROSS'        // MACD 크로스
  | 'AI_SIGNAL'         // AI 매매 신호
  | 'STOP_LOSS_HIT'     // 손절가 도달
  | 'TAKE_PROFIT_HIT'   // 익절가 도달
  | 'PORTFOLIO_DRIFT'   // 포트폴리오 드리프트
  | 'DAILY_LOSS_LIMIT'  // 일일 손실 한도
  | 'CIRCUIT_BREAKER'   // 서킷 브레이커 발동
  | 'ORDER_FILLED'      // 주문 체결
  | 'ORDER_FAILED'      // 주문 실패
  | 'SESSION_START'     // 매매 세션 시작
  | 'SESSION_END';      // 매매 세션 종료

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface SmartAlert {
  id: string;
  userId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

export interface AlertConfig {
  userId: string;
  enabledTypes: AlertType[];
  priceAlerts: Array<{
    stockId: string;
    symbol: string;
    targetPrice: number;
    direction: 'ABOVE' | 'BELOW';
  }>;
  thresholds: {
    rsiOversold: number;      // 기본 30
    rsiOverbought: number;    // 기본 70
    priceDropPercent: number; // 기본 5%
    priceSurgePercent: number;// 기본 5%
    dailyLossLimit: number;   // 일일 손실 한도 %
  };
  channels: {
    inApp: boolean;
    email: boolean;
    telegram: boolean;
    discord: boolean;
  };
}

@Injectable()
export class SmartAlertService implements OnModuleInit {
  private readonly logger = new Logger(SmartAlertService.name);
  private alertConfigs: Map<string, AlertConfig> = new Map();

  constructor(private eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    await this.loadAlertConfigs();
  }

  /**
   * 알림 설정 로드
   */
  private async loadAlertConfigs(): Promise<void> {
    // 기본 설정으로 초기화 (향후 DB에서 로드)
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      // 기본 알림 설정
      this.alertConfigs.set(user.id, {
        userId: user.id,
        enabledTypes: ['ORDER_FILLED', 'STOP_LOSS_HIT', 'CIRCUIT_BREAKER'],
        priceAlerts: [],
        thresholds: {
          rsiOversold: 30,
          rsiOverbought: 70,
          priceDropPercent: 5,
          priceSurgePercent: 5,
          dailyLossLimit: 5,
        },
        channels: {
          inApp: true,
          email: false,
          telegram: false,
          discord: false,
        },
      });
    }

    this.logger.log(`Loaded alert configs for ${this.alertConfigs.size} users`);
  }

  /**
   * 알림 생성 및 전송
   */
  async createAlert(alert: Omit<SmartAlert, 'id' | 'isRead' | 'createdAt'>): Promise<SmartAlert> {
    const fullAlert: SmartAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isRead: false,
      createdAt: new Date(),
    };

    // DB에 저장 (Prisma AlertType enum 사용)
    await prisma.notification.create({
      data: {
        userId: alert.userId,
        title: alert.title,
        message: alert.message,
        type: 'RISK_WARNING', // 기본 알림 타입
        channel: 'WEB_PUSH',
        data: alert.data || {},
        isRead: false,
      },
    });

    // 채널별 전송
    await this.dispatchAlert(fullAlert);

    this.logger.log(`Alert created: ${alert.type} for user ${alert.userId}`);
    return fullAlert;
  }

  /**
   * 알림 채널별 전송
   */
  private async dispatchAlert(alert: SmartAlert): Promise<void> {
    const config = this.alertConfigs.get(alert.userId);
    if (!config) return;

    // 인앱 알림
    if (config.channels?.inApp !== false) {
      this.eventEmitter.emit('notification.push', {
        userId: alert.userId,
        notification: alert,
      });
    }

    // 이메일 (향후 구현)
    if (config.channels?.email) {
      this.eventEmitter.emit('notification.email', {
        userId: alert.userId,
        subject: `[${alert.severity}] ${alert.title}`,
        body: alert.message,
      });
    }

    // Telegram (향후 구현)
    if (config.channels?.telegram) {
      this.eventEmitter.emit('notification.telegram', {
        userId: alert.userId,
        message: `${this.getSeverityEmoji(alert.severity)} *${alert.title}*\n${alert.message}`,
      });
    }
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'WARNING': return '⚠️';
      case 'INFO': return 'ℹ️';
    }
  }

  /**
   * 가격 알림 체크
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkPriceAlerts(): Promise<void> {
    for (const [userId, config] of this.alertConfigs) {
      if (!config.priceAlerts?.length) continue;

      for (const alert of config.priceAlerts) {
        try {
          const stock = await prisma.stock.findUnique({
            where: { id: alert.stockId },
            select: { currentPrice: true, symbol: true },
          });

          if (!stock?.currentPrice) continue;

          const currentPrice = Number(stock.currentPrice);
          const triggered = alert.direction === 'ABOVE'
            ? currentPrice >= alert.targetPrice
            : currentPrice <= alert.targetPrice;

          if (triggered) {
            await this.createAlert({
              userId,
              type: 'PRICE_TARGET',
              severity: 'INFO',
              title: `목표가 도달: ${stock.symbol}`,
              message: `${stock.symbol}이 목표가 ₩${alert.targetPrice.toLocaleString()}에 도달했습니다. 현재가: ₩${currentPrice.toLocaleString()}`,
              data: { stockId: alert.stockId, symbol: stock.symbol, price: currentPrice },
            });

            // 알림 제거 (일회성)
            config.priceAlerts = config.priceAlerts.filter(a => a !== alert);
          }
        } catch (error) {
          this.logger.error(`Price alert check failed:`, error);
        }
      }
    }
  }

  /**
   * 이벤트 핸들러: AI 신호
   */
  @OnEvent('ai.signal')
  async handleAiSignal(payload: { userId: string; stockId: string; signal: string; confidence: number }): Promise<void> {
    if (payload.confidence < 70) return; // 높은 신뢰도만 알림

    const stock = await prisma.stock.findUnique({ where: { id: payload.stockId } });
    if (!stock) return;

    await this.createAlert({
      userId: payload.userId,
      type: 'AI_SIGNAL',
      severity: payload.confidence >= 85 ? 'WARNING' : 'INFO',
      title: `AI 매매 신호: ${stock.symbol}`,
      message: `${stock.symbol}에 대해 AI가 ${payload.signal} 신호를 감지했습니다. (신뢰도: ${payload.confidence}%)`,
      data: { stockId: payload.stockId, symbol: stock.symbol, signal: payload.signal, confidence: payload.confidence },
    });
  }

  /**
   * 이벤트 핸들러: 주문 체결
   */
  @OnEvent('trade.filled')
  async handleOrderFilled(payload: { userId: string; tradeId: string; symbol: string; side: string; quantity: number; price: number }): Promise<void> {
    await this.createAlert({
      userId: payload.userId,
      type: 'ORDER_FILLED',
      severity: 'INFO',
      title: `주문 체결: ${payload.symbol}`,
      message: `${payload.symbol} ${payload.side === 'BUY' ? '매수' : '매도'} ${payload.quantity}주 @ ₩${payload.price.toLocaleString()}`,
      data: payload,
    });
  }

  /**
   * 이벤트 핸들러: 손절 도달
   */
  @OnEvent('position.stopLoss')
  async handleStopLoss(payload: { userId: string; stockId: string; symbol: string; lossPercent: number }): Promise<void> {
    await this.createAlert({
      userId: payload.userId,
      type: 'STOP_LOSS_HIT',
      severity: 'CRITICAL',
      title: `손절가 도달: ${payload.symbol}`,
      message: `${payload.symbol}이 손절가에 도달했습니다. 손실: ${payload.lossPercent.toFixed(2)}%`,
      data: payload,
    });
  }

  /**
   * 이벤트 핸들러: 서킷 브레이커
   */
  @OnEvent('circuit.break')
  async handleCircuitBreaker(payload: { userId: string; reason: string; details: any }): Promise<void> {
    await this.createAlert({
      userId: payload.userId,
      type: 'CIRCUIT_BREAKER',
      severity: 'CRITICAL',
      title: '🚨 서킷 브레이커 발동',
      message: `자동매매가 긴급 중단되었습니다. 사유: ${payload.reason}`,
      data: payload,
    });
  }

  /**
   * 이벤트 핸들러: 포트폴리오 드리프트
   */
  @OnEvent('portfolio.drift.alert')
  async handlePortfolioDrift(payload: { portfolioId: string; drift: number; message: string }): Promise<void> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: payload.portfolioId },
      select: { userId: true, name: true },
    });

    if (!portfolio) return;

    await this.createAlert({
      userId: portfolio.userId,
      type: 'PORTFOLIO_DRIFT',
      severity: payload.drift > 15 ? 'WARNING' : 'INFO',
      title: `포트폴리오 드리프트: ${portfolio.name}`,
      message: payload.message,
      data: { portfolioId: payload.portfolioId, drift: payload.drift },
    });
  }

  /**
   * 이벤트 핸들러: 일일 손실 한도
   */
  @OnEvent('trading.dailyLossLimit')
  async handleDailyLossLimit(payload: { userId: string; lossPercent: number; limit: number }): Promise<void> {
    await this.createAlert({
      userId: payload.userId,
      type: 'DAILY_LOSS_LIMIT',
      severity: 'CRITICAL',
      title: '⚠️ 일일 손실 한도 도달',
      message: `일일 손실이 ${payload.lossPercent.toFixed(2)}%로 한도(${payload.limit}%)에 도달했습니다. 자동매매를 중단합니다.`,
      data: payload,
    });
  }

  /**
   * RSI 알림 체크 (매 5분)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkRsiAlerts(): Promise<void> {
    // 관심 종목의 RSI 확인 (Watchlist 사용)
    const watchlists = await prisma.watchlist.findMany({
      include: {
        stock: true,
      },
    });

    for (const watchlist of watchlists) {
      const rsi = await this.getLatestRsi(watchlist.stockId);
      if (!rsi) continue;

      const config = this.alertConfigs.get(watchlist.userId);
      const oversoldLevel = config?.thresholds?.rsiOversold || 30;
      const overboughtLevel = config?.thresholds?.rsiOverbought || 70;

      if (rsi <= oversoldLevel) {
        await this.createAlert({
          userId: watchlist.userId,
          type: 'RSI_OVERSOLD',
          severity: 'INFO',
          title: `과매도 신호: ${watchlist.stock.symbol}`,
          message: `${watchlist.stock.symbol}의 RSI가 ${rsi.toFixed(1)}로 과매도 구간에 진입했습니다.`,
          data: { stockId: watchlist.stockId, symbol: watchlist.stock.symbol, rsi },
        });
      } else if (rsi >= overboughtLevel) {
        await this.createAlert({
          userId: watchlist.userId,
          type: 'RSI_OVERBOUGHT',
          severity: 'INFO',
          title: `과매수 신호: ${watchlist.stock.symbol}`,
          message: `${watchlist.stock.symbol}의 RSI가 ${rsi.toFixed(1)}로 과매수 구간에 진입했습니다.`,
          data: { stockId: watchlist.stockId, symbol: watchlist.stock.symbol, rsi },
        });
      }
    }
  }

  private async getLatestRsi(stockId: string): Promise<number | null> {
    const indicator = await prisma.indicator.findFirst({
      where: { stockId, type: 'RSI' },
      orderBy: { timestamp: 'desc' },
    });

    if (!indicator?.values) return null;
    const values = indicator.values as any;
    return values.value || values.rsi || null;
  }

  /**
   * 사용자 알림 설정 업데이트 (메모리에만 저장)
   */
  async updateAlertConfig(userId: string, config: Partial<AlertConfig>): Promise<void> {
    const existing = this.alertConfigs.get(userId) || {} as AlertConfig;
    const updated = { ...existing, ...config, userId };
    this.alertConfigs.set(userId, updated);
    // 향후 DB 저장 기능 추가 가능
  }

  /**
   * 읽지 않은 알림 수 조회
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
