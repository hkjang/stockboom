/**
 * Trading Engine Types
 * 자동매매 엔진 타입 정의
 */

// ============================================
// Trading Signal Types
// ============================================

export type SignalSource = 'INDICATOR' | 'AI' | 'MANUAL' | 'CONDITION_SEARCH' | 'SCHEDULED';
export type SignalStrength = 'WEAK' | 'MODERATE' | 'STRONG';

export interface TradingSignal {
  id: string;
  userId: string;
  stockId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  source: SignalSource;
  strength: SignalStrength;
  price: number;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
  confidence: number; // 0-100
  reason: string;
  strategyId?: string;
  createdAt: Date;
  expiresAt?: Date;
}

// ============================================
// Order Request Types
// ============================================

export type OrderPriceType = 
  | 'MARKET'        // 시장가
  | 'LIMIT'         // 지정가
  | 'BEST_LIMIT'    // 최유리지정가
  | 'BEST_MARKET'   // 최유리시장가
  | 'IOC'           // IOC (Immediate or Cancel)
  | 'FOK';          // FOK (Fill or Kill)

export interface OrderRequest {
  userId: string;
  brokerAccountId: string;
  stockId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  priceType: OrderPriceType;
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  strategyId?: string;
  signalId?: string;
  isAutoTrade: boolean;
}

export interface OrderResult {
  success: boolean;
  tradeId?: string;
  brokerOrderId?: string;
  filledQuantity?: number;
  filledPrice?: number;
  message: string;
  error?: string;
}

// ============================================
// Split Order Types
// ============================================

export interface SplitOrderRequest {
  userId: string;
  brokerAccountId: string;
  stockId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  totalQuantity: number;
  splitCount: number;       // 분할 횟수
  intervalSeconds: number;  // 분할 간격 (초)
  priceType: 'MARKET' | 'LIMIT' | 'BEST_LIMIT';
  limitPrice?: number;
  strategyId?: string;
}

export interface SplitOrderResult {
  success: boolean;
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  totalFilledQuantity: number;
  avgFilledPrice: number;
  tradeIds: string[];
  errors: string[];
}

// ============================================
// Scheduled Order Types
// ============================================

export interface ScheduledOrderRequest {
  userId: string;
  brokerAccountId: string;
  stockId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  priceType: OrderPriceType;
  quantity: number;
  price?: number;
  scheduledTime: Date;
  validUntil?: Date;
  strategyId?: string;
}

// ============================================
// Position Types
// ============================================

export interface PositionInfo {
  stockId: string;
  symbol: string;
  name: string;
  quantity: number;
  availableQuantity: number;
  avgPrice: number;
  currentPrice: number;
  purchaseAmount: number;
  evaluationAmount: number;
  profitLoss: number;
  profitLossRate: number;
  weight: number; // Portfolio weight in %
}

export interface PortfolioSummary {
  userId: string;
  totalValue: number;
  cashBalance: number;
  investedAmount: number;
  evaluationAmount: number;
  totalProfitLoss: number;
  totalProfitLossRate: number;
  positions: PositionInfo[];
  lastUpdated: Date;
}

export interface AllocationMap {
  [stockId: string]: {
    symbol: string;
    weight: number;
    amount: number;
  };
}

// ============================================
// Risk Management Types
// ============================================

export interface RiskCheckResult {
  approved: boolean;
  warnings: string[];
  errors: string[];
  suggestedQuantity?: number;
  riskScore: number; // 0-100
}

export interface RiskLimits {
  dailyMaxLoss: number;
  dailyMaxLossPercent: number;
  maxPositionPercent: number;
  maxDailyTrades: number;
  maxOrderValue: number;
}

export interface RiskStatus {
  userId: string;
  dailyProfitLoss: number;
  dailyProfitLossPercent: number;
  dailyTradeCount: number;
  largestPositionPercent: number;
  riskLimits: RiskLimits;
  isCircuitBreakerActive: boolean;
  circuitBreakerReason?: string;
}

export interface LiquidationResult {
  success: boolean;
  liquidatedPositions: number;
  totalAmount: number;
  tradeIds: string[];
  errors: string[];
}

// ============================================
// Auto Trading Session Types
// ============================================

export type AutoTradingStatus = 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';

export interface AutoTradingSession {
  id: string;
  userId: string;
  status: AutoTradingStatus;
  startedAt: Date;
  stoppedAt?: Date;
  activeStrategies: string[];
  totalTrades: number;
  profitLoss: number;
}

export interface AutoTradingConfig {
  userId: string;
  strategyIds: string[];
  riskLimits: Partial<RiskLimits>;
  enableAISignals: boolean;
  enableIndicatorSignals: boolean;
  tradingHoursOnly: boolean;
  pauseOnCircuitBreaker: boolean;
}

// ============================================
// Strategy Execution Types
// ============================================

export interface StrategyExecutionResult {
  strategyId: string;
  success: boolean;
  signal?: TradingSignal;
  tradeResult?: OrderResult;
  duration: number; // ms
  error?: string;
}

export interface StrategyConfig {
  type: string;
  parameters: Record<string, any>;
  symbols: string[];
  timeframe: string;
  enabled: boolean;
}

// ============================================
// Dashboard Types
// ============================================

export interface TodayStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  buyOrders: number;
  sellOrders: number;
  totalVolume: number;
  totalAmount: number;
  realizedProfitLoss: number;
  unrealizedProfitLoss: number;
}

export interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  trades: number;
  winRate: number;
  profitLoss: number;
  avgReturn: number;
  sharpeRatio?: number;
}

// ============================================
// Event Types
// ============================================

export interface PriceSpikeEvent {
  symbol: string;
  stockId: string;
  currentPrice: number;
  previousPrice: number;
  changePercent: number;
  volume: number;
  direction: 'UP' | 'DOWN';
  timestamp: Date;
}

export interface LargeVolumeEvent {
  symbol: string;
  stockId: string;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  price: number;
  timestamp: Date;
}

export interface ExecutionEvent {
  userId: string;
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  timestamp: Date;
}

// ============================================
// Audit Types
// ============================================

export type AuditEventType = 'ORDER' | 'STRATEGY' | 'RISK' | 'SYSTEM' | 'SESSION';
export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface AuditEvent {
  userId: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  severity?: AuditSeverity[];
  limit?: number;
  offset?: number;
}
