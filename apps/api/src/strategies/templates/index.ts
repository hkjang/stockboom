/**
 * Strategy Templates Index
 * 전략 템플릿 모듈 exports
 */

// Interface
export * from './strategy.interface';

// Strategy Implementations
export { GridStrategy, GridStrategyConfig } from './grid-strategy';
export { TrendFollowingStrategy, TrendFollowingConfig } from './trend-following-strategy';
export { MeanReversionStrategy, MeanReversionConfig } from './mean-reversion-strategy';
export { BreakoutStrategy, BreakoutConfig } from './breakout-strategy';

// Strategy Types
export const STRATEGY_TYPES = {
  GRID: 'GRID',
  TREND_FOLLOWING: 'TREND_FOLLOWING',
  MEAN_REVERSION: 'MEAN_REVERSION',
  BREAKOUT: 'BREAKOUT',
} as const;

export type StrategyTypeKey = keyof typeof STRATEGY_TYPES;
