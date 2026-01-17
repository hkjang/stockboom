/**
 * Strategy Interface
 * 전략 템플릿의 공통 인터페이스
 */

import { TradingSignal } from '../../trading-engine/trading-engine.types';

export type StrategyState = 'IDLE' | 'ACTIVE' | 'PAUSED' | 'ERROR';

/**
 * 전략 설정 기본 인터페이스
 */
export interface BaseStrategyConfig {
  name: string;
  description?: string;
  symbols: string[];           // 대상 종목 목록
  timeframe: string;           // 분석 주기: '1m', '5m', '15m', '1h', '1d'
  enabled: boolean;
  
  // 리스크 관리
  stopLossPercent?: number;    // 손절 %
  takeProfitPercent?: number;  // 익절 %
  maxPositionSize?: number;    // 최대 포지션 금액
  maxPositionsPerSymbol?: number; // 종목당 최대 포지션 수
}

/**
 * 전략 실행 결과
 */
export interface StrategyResult {
  strategyId: string;
  stockId: string;
  symbol: string;
  signal: TradingSignal | null;
  reason: string;
  metadata?: Record<string, any>;
  executedAt: Date;
}

/**
 * 전략 성과 지표
 */
export interface StrategyMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;           // %
  totalProfitLoss: number;
  maxDrawdown: number;       // %
  sharpeRatio?: number;
  averageReturn: number;     // %
  averageHoldingPeriod: number; // 일
}

/**
 * 전략 인터페이스
 */
export interface IStrategy<TConfig extends BaseStrategyConfig = BaseStrategyConfig> {
  // 기본 정보
  readonly id: string;
  readonly type: string;
  readonly name: string;
  
  // 설정
  config: TConfig;
  state: StrategyState;
  
  // 초기화 및 종료
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  
  // 신호 생성
  evaluate(stockId: string): Promise<StrategyResult>;
  
  // 설정 업데이트
  updateConfig(config: Partial<TConfig>): void;
  
  // 상태 조회
  getMetrics(): Promise<StrategyMetrics>;
}

/**
 * 전략 팩토리 인터페이스
 */
export interface IStrategyFactory {
  create(type: string, config: BaseStrategyConfig): Promise<IStrategy>;
  getAvailableTypes(): string[];
}
