import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { TradingEngineService } from './trading-engine.service';
import { PositionManagerService } from './position-manager.service';
import { RiskManagerService } from './risk-manager.service';
import { SignalProcessorService } from './signal-processor.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { AuditTrailService } from './audit-trail.service';
import { SmartOrderService } from './smart-order.service';
import { PerformanceAnalyticsService } from './performance-analytics.service';
import { MarketHoursService } from './market-hours.service';
import { PositionSizingService } from './position-sizing.service';
import { AutoRebalancingService } from './auto-rebalancing.service';
import { SmartAlertService } from './smart-alert.service';
import { BacktestingService } from './backtesting.service';
import { MultiStrategyOrchestratorService } from './multi-strategy-orchestrator.service';
import { DashboardController } from './dashboard.controller';
import { TradingEngineController } from './trading-engine.controller';

import { MarketDataModule } from '../market-data/market-data.module';
import { StrategiesModule } from '../strategies/strategies.module';
import { AnalysisModule } from '../analysis/analysis.module';

/**
 * Trading Engine Module
 * 자동매매 핵심 엔진 모듈
 * 
 * 포함 기능:
 * - 자동매매 엔진 (TradingEngineService)
 * - 포지션 관리 (PositionManagerService)
 * - 리스크 관리 (RiskManagerService)
 * - 신호 처리 (SignalProcessorService)
 * - 서킷 브레이커 (CircuitBreakerService)
 * - 감사 추적 (AuditTrailService)
 * - 스마트 주문 (SmartOrderService)
 * - 성과 분석 (PerformanceAnalyticsService)
 * - 시장 시간 자동화 (MarketHoursService)
 * - 포지션 사이징 (PositionSizingService)
 * - 자동 리밸런싱 (AutoRebalancingService)
 * - 스마트 알림 (SmartAlertService)
 * - 백테스팅 (BacktestingService)
 */
@Module({
  imports: [
    MarketDataModule,
    StrategiesModule,
    AnalysisModule,
    BullModule.registerQueue(
      { name: 'trading' },
      { name: 'scheduled-orders' },
      { name: 'split-orders' },
      { name: 'smart-orders' },
    ),
  ],
  controllers: [
    TradingEngineController,
    DashboardController,
  ],
  providers: [
    TradingEngineService,
    PositionManagerService,
    RiskManagerService,
    SignalProcessorService,
    CircuitBreakerService,
    AuditTrailService,
    SmartOrderService,
    PerformanceAnalyticsService,
    MarketHoursService,
    PositionSizingService,
    AutoRebalancingService,
    SmartAlertService,
    BacktestingService,
    MultiStrategyOrchestratorService,
  ],
  exports: [
    TradingEngineService,
    PositionManagerService,
    RiskManagerService,
    SignalProcessorService,
    CircuitBreakerService,
    AuditTrailService,
    SmartOrderService,
    PerformanceAnalyticsService,
    MarketHoursService,
    PositionSizingService,
    AutoRebalancingService,
    SmartAlertService,
    BacktestingService,
    MultiStrategyOrchestratorService,
  ],
})
export class TradingEngineModule {}
