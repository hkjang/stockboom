/**
 * Multi-Strategy Orchestrator Service
 * 멀티 전략 오케스트레이터
 * 
 * 전문가급 기능:
 * - 여러 전략 동시 실행
 * - 전략 우선순위 관리
 * - 전략 간 충돌 해결
 * - 자본 배분 최적화
 * - 전략 상태 모니터링
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@stockboom/database';

export type StrategyPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type StrategyStatus = 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';

export interface StrategyInstance {
  id: string;
  strategyId: string;
  name: string;
  type: string;
  priority: StrategyPriority;
  status: StrategyStatus;
  capitalAllocation: number;  // 배정된 자본 비율 (0-100)
  currentCapital: number;     // 현재 사용 중인 자본
  dailyPnL: number;
  totalPnL: number;
  tradesCount: number;
  winRate: number;
  lastSignalTime?: Date;
  lastError?: string;
  config: Record<string, any>;
}

export interface StrategySignal {
  strategyId: string;
  stockId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  strength: number;         // 0-100
  suggestedQuantity: number;
  suggestedPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  timestamp: Date;
}

export interface ConflictResolution {
  type: 'PRIORITY' | 'STRENGTH' | 'AVERAGE' | 'CANCEL';
  result: StrategySignal | null;
  conflictingSignals: StrategySignal[];
}

@Injectable()
export class MultiStrategyOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(MultiStrategyOrchestratorService.name);
  
  // 활성 전략 인스턴스
  private strategies: Map<string, StrategyInstance> = new Map();
  
  // 신호 큐 (우선순위 기반)
  private signalQueue: StrategySignal[] = [];
  
  // 우선순위 가중치
  private readonly priorityWeights = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  constructor(private eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    await this.loadActiveStrategies();
  }

  /**
   * 활성 전략 로드
   */
  private async loadActiveStrategies(): Promise<void> {
    const strategies = await prisma.strategy.findMany({
      where: { isActive: true },
      include: { portfolio: true },
    });

    for (const strategy of strategies) {
      const config = strategy.config as any || {};
      
      this.strategies.set(strategy.id, {
        id: strategy.id,
        strategyId: strategy.id,
        name: strategy.name,
        type: strategy.type,
        priority: config.priority || 'MEDIUM',
        status: 'STOPPED',
        capitalAllocation: config.capitalAllocation || 10,
        currentCapital: 0,
        dailyPnL: 0,
        totalPnL: 0,
        tradesCount: 0,
        winRate: Number(strategy.winRate) || 0,
        config,
      });
    }

    this.logger.log(`Loaded ${this.strategies.size} active strategies`);
  }

  /**
   * 전략 시작
   */
  async startStrategy(strategyId: string): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    instance.status = 'RUNNING';
    instance.lastError = undefined;
    
    this.eventEmitter.emit('strategy.started', { strategyId });
    this.logger.log(`Strategy ${instance.name} started`);
  }

  /**
   * 전략 중지
   */
  async stopStrategy(strategyId: string): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) return;

    instance.status = 'STOPPED';
    this.eventEmitter.emit('strategy.stopped', { strategyId });
    this.logger.log(`Strategy ${instance.name} stopped`);
  }

  /**
   * 전략 일시정지
   */
  async pauseStrategy(strategyId: string): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) return;

    instance.status = 'PAUSED';
    this.eventEmitter.emit('strategy.paused', { strategyId });
  }

  /**
   * 모든 전략 시작
   */
  async startAllStrategies(): Promise<void> {
    for (const [id, instance] of this.strategies) {
      if (instance.status === 'STOPPED') {
        await this.startStrategy(id);
      }
    }
    this.logger.log('All strategies started');
  }

  /**
   * 모든 전략 중지
   */
  async stopAllStrategies(): Promise<void> {
    for (const [id] of this.strategies) {
      await this.stopStrategy(id);
    }
    this.logger.log('All strategies stopped');
  }

  /**
   * 전략 신호 수신 및 큐 추가
   */
  @OnEvent('strategy.signal')
  async handleStrategySignal(signal: StrategySignal): Promise<void> {
    const instance = this.strategies.get(signal.strategyId);
    if (!instance || instance.status !== 'RUNNING') {
      return;
    }

    // 우선순위에 따른 위치에 삽입
    this.insertSignalByPriority(signal, instance.priority);
    instance.lastSignalTime = new Date();

    // 신호 처리 트리거
    await this.processSignalQueue();
  }

  /**
   * 우선순위 기반 신호 삽입
   */
  private insertSignalByPriority(signal: StrategySignal, priority: StrategyPriority): void {
    const weight = this.priorityWeights[priority];
    
    let insertIndex = this.signalQueue.length;
    for (let i = 0; i < this.signalQueue.length; i++) {
      const existingInstance = this.strategies.get(this.signalQueue[i].strategyId);
      const existingWeight = this.priorityWeights[existingInstance?.priority || 'LOW'];
      
      if (weight > existingWeight) {
        insertIndex = i;
        break;
      }
    }

    this.signalQueue.splice(insertIndex, 0, signal);
  }

  /**
   * 신호 큐 처리
   */
  async processSignalQueue(): Promise<void> {
    if (this.signalQueue.length === 0) return;

    // 같은 종목에 대한 충돌 신호 확인
    const groupedByStock = new Map<string, StrategySignal[]>();
    for (const signal of this.signalQueue) {
      const existing = groupedByStock.get(signal.stockId) || [];
      existing.push(signal);
      groupedByStock.set(signal.stockId, existing);
    }

    const resolvedSignals: StrategySignal[] = [];

    for (const [stockId, signals] of groupedByStock) {
      if (signals.length === 1) {
        resolvedSignals.push(signals[0]);
      } else {
        // 충돌 해결
        const resolution = this.resolveConflict(signals);
        if (resolution.result) {
          resolvedSignals.push(resolution.result);
        }
        
        this.eventEmitter.emit('strategy.conflict', {
          stockId,
          resolution,
        });
      }
    }

    // 해결된 신호 실행
    for (const signal of resolvedSignals) {
      await this.executeSignal(signal);
    }

    // 큐 클리어
    this.signalQueue = [];
  }

  /**
   * 신호 충돌 해결
   */
  private resolveConflict(signals: StrategySignal[]): ConflictResolution {
    // 서로 다른 방향의 신호가 있는지 확인
    const buySignals = signals.filter(s => s.action === 'BUY');
    const sellSignals = signals.filter(s => s.action === 'SELL');

    if (buySignals.length > 0 && sellSignals.length > 0) {
      // 충돌 - 우선순위로 결정
      const highestPriorityBuy = this.getHighestPrioritySignal(buySignals);
      const highestPrioritySell = this.getHighestPrioritySignal(sellSignals);

      const buyInstance = this.strategies.get(highestPriorityBuy.strategyId);
      const sellInstance = this.strategies.get(highestPrioritySell.strategyId);

      const buyWeight = this.priorityWeights[buyInstance?.priority || 'LOW'] * highestPriorityBuy.strength;
      const sellWeight = this.priorityWeights[sellInstance?.priority || 'LOW'] * highestPrioritySell.strength;

      if (buyWeight > sellWeight) {
        return {
          type: 'PRIORITY',
          result: highestPriorityBuy,
          conflictingSignals: signals,
        };
      } else if (sellWeight > buyWeight) {
        return {
          type: 'PRIORITY',
          result: highestPrioritySell,
          conflictingSignals: signals,
        };
      } else {
        // 동일하면 취소
        return {
          type: 'CANCEL',
          result: null,
          conflictingSignals: signals,
        };
      }
    }

    // 같은 방향 - 가장 강한 신호 선택
    const strongest = signals.reduce((max, s) => 
      s.strength > max.strength ? s : max
    );

    return {
      type: 'STRENGTH',
      result: strongest,
      conflictingSignals: signals,
    };
  }

  /**
   * 가장 높은 우선순위 신호 선택
   */
  private getHighestPrioritySignal(signals: StrategySignal[]): StrategySignal {
    return signals.reduce((highest, signal) => {
      const currentInstance = this.strategies.get(signal.strategyId);
      const highestInstance = this.strategies.get(highest.strategyId);
      
      const currentWeight = this.priorityWeights[currentInstance?.priority || 'LOW'];
      const highestWeight = this.priorityWeights[highestInstance?.priority || 'LOW'];
      
      return currentWeight > highestWeight ? signal : highest;
    });
  }

  /**
   * 신호 실행
   */
  private async executeSignal(signal: StrategySignal): Promise<void> {
    if (signal.action === 'HOLD') return;

    const instance = this.strategies.get(signal.strategyId);
    if (!instance) return;

    // 자본 할당 확인
    if (!this.checkCapitalAllocation(signal, instance)) {
      this.logger.warn(`Insufficient capital allocation for strategy ${instance.name}`);
      return;
    }

    // 주문 이벤트 발행
    this.eventEmitter.emit('trading.order', {
      strategyId: signal.strategyId,
      stockId: signal.stockId,
      symbol: signal.symbol,
      side: signal.action,
      quantity: signal.suggestedQuantity,
      price: signal.suggestedPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      source: 'MULTI_STRATEGY',
      reason: signal.reason,
    });

    instance.tradesCount++;
    this.logger.log(`Signal executed: ${signal.action} ${signal.symbol} (${instance.name})`);
  }

  /**
   * 자본 할당 확인
   */
  private checkCapitalAllocation(signal: StrategySignal, instance: StrategyInstance): boolean {
    // 간단한 확인 - 실제로는 더 정교한 로직 필요
    const estimatedValue = signal.suggestedQuantity * (signal.suggestedPrice || 0);
    const totalCapital = instance.currentCapital;
    const maxAllocation = totalCapital * (instance.capitalAllocation / 100);
    
    return estimatedValue <= maxAllocation || maxAllocation === 0;
  }

  /**
   * 전략 우선순위 변경
   */
  async setStrategyPriority(strategyId: string, priority: StrategyPriority): Promise<void> {
    const instance = this.strategies.get(strategyId);
    if (!instance) return;

    instance.priority = priority;
    
    // DB에도 저장
    await prisma.strategy.update({
      where: { id: strategyId },
      data: {
        config: {
          ...(instance.config || {}),
          priority,
        },
      },
    });

    this.logger.log(`Strategy ${instance.name} priority changed to ${priority}`);
  }

  /**
   * 자본 할당 비율 변경
   */
  async setCapitalAllocation(strategyId: string, percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Capital allocation must be between 0 and 100');
    }

    const instance = this.strategies.get(strategyId);
    if (!instance) return;

    instance.capitalAllocation = percentage;
    
    await prisma.strategy.update({
      where: { id: strategyId },
      data: {
        config: {
          ...(instance.config || {}),
          capitalAllocation: percentage,
        },
      },
    });
  }

  /**
   * 전략 상태 조회
   */
  getStrategyStatus(strategyId: string): StrategyInstance | undefined {
    return this.strategies.get(strategyId);
  }

  /**
   * 모든 전략 상태 조회
   */
  getAllStrategiesStatus(): StrategyInstance[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 전략 성과 요약
   */
  getPerformanceSummary(): {
    totalStrategies: number;
    runningStrategies: number;
    totalPnL: number;
    todayPnL: number;
    totalTrades: number;
    avgWinRate: number;
  } {
    const instances = Array.from(this.strategies.values());
    const running = instances.filter(s => s.status === 'RUNNING');

    return {
      totalStrategies: instances.length,
      runningStrategies: running.length,
      totalPnL: instances.reduce((sum, s) => sum + s.totalPnL, 0),
      todayPnL: instances.reduce((sum, s) => sum + s.dailyPnL, 0),
      totalTrades: instances.reduce((sum, s) => sum + s.tradesCount, 0),
      avgWinRate: instances.length > 0
        ? instances.reduce((sum, s) => sum + s.winRate, 0) / instances.length
        : 0,
    };
  }

  /**
   * 일일 PnL 리셋 (매일 자정)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyPnL(): Promise<void> {
    for (const instance of this.strategies.values()) {
      instance.dailyPnL = 0;
    }
    this.logger.log('Daily PnL reset for all strategies');
  }

  /**
   * 전략 성과 업데이트 이벤트 핸들러
   */
  @OnEvent('trade.completed')
  async handleTradeCompleted(payload: { strategyId: string; pnl: number; isWin: boolean }): Promise<void> {
    const instance = this.strategies.get(payload.strategyId);
    if (!instance) return;

    instance.dailyPnL += payload.pnl;
    instance.totalPnL += payload.pnl;

    // 승률 재계산 (간단한 exponential moving average)
    const alpha = 0.1;
    instance.winRate = instance.winRate * (1 - alpha) + (payload.isWin ? 100 : 0) * alpha;
  }

  /**
   * 전략 오류 핸들러
   */
  @OnEvent('strategy.error')
  async handleStrategyError(payload: { strategyId: string; error: string }): Promise<void> {
    const instance = this.strategies.get(payload.strategyId);
    if (!instance) return;

    instance.status = 'ERROR';
    instance.lastError = payload.error;
    
    this.logger.error(`Strategy ${instance.name} error: ${payload.error}`);
    
    this.eventEmitter.emit('alert.strategy.error', {
      strategyId: payload.strategyId,
      strategyName: instance.name,
      error: payload.error,
    });
  }
}
