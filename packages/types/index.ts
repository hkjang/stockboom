// Re-export Prisma types
export * from '@stockboom/database';

// Re-export Stock types
export * from './stock.types';

// API Response Types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
    };
}

// Korean Investment & Securities API Types
export interface KISTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface KISQuote {
    symbol: string;
    name: string;
    currentPrice: number;
    changePrice: number;
    changeRate: number;
    volume: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    timestamp: Date;
}

export interface KISOrderRequest {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT';
    price?: number;
}

export interface KISOrderResponse {
    orderId: string;
    status: string;
    message?: string;
}

// Indicator Types
export interface IndicatorValue {
    timestamp: Date;
    value: number | Record<string, number>;
}

export interface SMAIndicator extends IndicatorValue {
    value: number;
}

export interface EMAIndicator extends IndicatorValue {
    value: number;
}

export interface RSIIndicator extends IndicatorValue {
    value: number;
}

export interface MACDIndicator extends IndicatorValue {
    value: {
        macd: number;
        signal: number;
        histogram: number;
    };
}

export interface StochasticIndicator extends IndicatorValue {
    value: {
        k: number;
        d: number;
    };
}

// Trading Signal Types
export type SignalType = 'BUY' | 'SELL' | 'HOLD' | 'STRONG_BUY' | 'STRONG_SELL';

export interface TradingSignal {
    stockId: string;
    signal: SignalType;
    strength: number; // 0-100
    source: string; // 'indicator', 'ai', 'hybrid'
    reasons: string[];
    timestamp: Date;
}

// AI Analysis Types
export interface AIAnalysisRequest {
    stockId: string;
    analysisType: 'NEWS_SUMMARY' | 'RISK_SCORE' | 'PATTERN_DETECTION' | 'PORTFOLIO_OPT';
    data?: any;
}

export interface AIAnalysisResponse {
    riskScore?: number;
    confidence: number;
    summary: string;
    recommendation?: 'BUY' | 'SELL' | 'HOLD';
    details: Record<string, any>;
}

// BullMQ Job Types
export interface DataCollectionJob {
    stockIds: string[];
    timeframe: string;
}

export interface AnalysisJob {
    stockId: string;
    indicators: string[];
    aiAnalysis?: boolean;
}

export interface TradeExecutionJob {
    tradeId: string;
    retry?: number;
}

export interface NotificationJob {
    userId: string;
    type: string;
    title: string;
    message: string;
    channel: 'WEB_PUSH' | 'EMAIL';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

// WebSocket Event Types
export interface WSEvent<T = any> {
    type: string;
    data: T;
    timestamp: Date;
}

export interface PriceUpdateEvent {
    stockId: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
}

export interface TradeExecutionEvent {
    tradeId: string;
    status: string;
    filledQuantity: number;
    avgFillPrice?: number;
}

export interface AlertTriggerEvent {
    alertId: string;
    message: string;
    data: any;
}
