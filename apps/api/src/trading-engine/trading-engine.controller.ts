import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TradingEngineService } from './trading-engine.service';
import { RiskManagerService } from './risk-manager.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { AuditTrailService } from './audit-trail.service';
import { SmartOrderService, SmartOrderRequest } from './smart-order.service';
import { PerformanceAnalyticsService } from './performance-analytics.service';
import { MarketHoursService, MarketType } from './market-hours.service';
import { PositionSizingService, PositionSizeRequest } from './position-sizing.service';
import { MultiStrategyOrchestratorService, StrategyPriority } from './multi-strategy-orchestrator.service';
import {
  AutoTradingConfig,
  ScheduledOrderRequest,
  SplitOrderRequest,
  OrderRequest,
} from './trading-engine.types';

/**
 * Trading Engine Controller
 * 자동매매 엔진 API
 */
@Controller('trading-engine')
@UseGuards(JwtAuthGuard)
export class TradingEngineController {
  constructor(
    private tradingEngineService: TradingEngineService,
    private riskManagerService: RiskManagerService,
    private circuitBreakerService: CircuitBreakerService,
    private auditTrailService: AuditTrailService,
    private smartOrderService: SmartOrderService,
    private performanceAnalyticsService: PerformanceAnalyticsService,
    private marketHoursService: MarketHoursService,
    private positionSizingService: PositionSizingService,
    private multiStrategyService: MultiStrategyOrchestratorService,
  ) {}

  // ============================================
  // 자동매매 세션 관리
  // ============================================

  /**
   * 자동매매 시작
   */
  @Post('auto-trading/start')
  async startAutoTrading(
    @Request() req,
    @Body() config: Omit<AutoTradingConfig, 'userId'>,
  ) {
    return this.tradingEngineService.startAutoTrading({
      ...config,
      userId: req.user.id,
    });
  }

  /**
   * 자동매매 중지
   */
  @Post('auto-trading/stop')
  async stopAutoTrading(@Request() req) {
    await this.tradingEngineService.stopAutoTrading(req.user.id);
    return { success: true, message: '자동매매가 중지되었습니다.' };
  }

  /**
   * 자동매매 일시정지
   */
  @Post('auto-trading/pause')
  async pauseAutoTrading(@Request() req) {
    await this.tradingEngineService.pauseAutoTrading(req.user.id);
    return { success: true, message: '자동매매가 일시정지되었습니다.' };
  }

  /**
   * 자동매매 재개
   */
  @Post('auto-trading/resume')
  async resumeAutoTrading(@Request() req) {
    await this.tradingEngineService.resumeAutoTrading(req.user.id);
    return { success: true, message: '자동매매가 재개되었습니다.' };
  }

  /**
   * 자동매매 상태 조회
   */
  @Get('auto-trading/status')
  async getAutoTradingStatus(@Request() req) {
    return this.tradingEngineService.getAutoTradingStatus(req.user.id);
  }

  // ============================================
  // 주문 실행
  // ============================================

  /**
   * 수동 주문 실행
   */
  @Post('order')
  async executeOrder(
    @Request() req,
    @Body() orderData: Omit<OrderRequest, 'userId' | 'isAutoTrade'>,
  ) {
    return this.tradingEngineService.executeOrder({
      ...orderData,
      userId: req.user.id,
      isAutoTrade: false,
    });
  }

  /**
   * 분할 주문 실행
   */
  @Post('order/split')
  async executeSplitOrder(
    @Request() req,
    @Body() splitOrderData: Omit<SplitOrderRequest, 'userId'>,
  ) {
    return this.tradingEngineService.executeSplitOrder({
      ...splitOrderData,
      userId: req.user.id,
    });
  }

  // ============================================
  // 스마트 주문 (VWAP, TWAP, Iceberg)
  // ============================================

  /**
   * 스마트 주문 실행
   */
  @Post('order/smart')
  async executeSmartOrder(
    @Request() req,
    @Body() orderData: Omit<SmartOrderRequest, 'userId'>,
  ) {
    return this.smartOrderService.executeSmartOrder({
      ...orderData,
      userId: req.user.id,
    });
  }

  /**
   * 활성 스마트 주문 조회
   */
  @Get('order/smart/active')
  async getActiveSmartOrders(@Request() req) {
    return this.smartOrderService.getActiveOrders(req.user.id);
  }

  /**
   * 스마트 주문 취소
   */
  @Delete('order/smart/:orderId')
  async cancelSmartOrder(@Request() req, @Param('orderId') orderId: string) {
    await this.smartOrderService.cancelSmartOrder(orderId, req.user.id);
    return { success: true, message: '스마트 주문이 취소되었습니다.' };
  }

  // ============================================
  // 포지션 사이징
  // ============================================

  /**
   * 최적 포지션 크기 계산
   */
  @Post('position-sizing/calculate')
  async calculatePositionSize(
    @Request() req,
    @Body() sizeRequest: Omit<PositionSizeRequest, 'userId'>,
  ) {
    return this.positionSizingService.calculateOptimalSize({
      ...sizeRequest,
      userId: req.user.id,
    });
  }

  /**
   * 리스크 패리티 배분 계산
   */
  @Post('position-sizing/risk-parity')
  async calculateRiskParity(
    @Request() req,
    @Body() data: { symbols: string[]; targetRiskPercent?: number },
  ) {
    return this.positionSizingService.calculateRiskParity(
      req.user.id,
      data.symbols,
      data.targetRiskPercent,
    );
  }

  // ============================================
  // 예약 주문
  // ============================================

  /**
   * 예약 주문 생성
   */
  @Post('scheduled-order')
  async createScheduledOrder(
    @Request() req,
    @Body() orderData: Omit<ScheduledOrderRequest, 'userId'>,
  ) {
    // scheduledTime을 Date로 변환
    const scheduledTime = new Date(orderData.scheduledTime);
    const validUntil = orderData.validUntil
      ? new Date(orderData.validUntil)
      : undefined;

    const orderId = await this.tradingEngineService.createScheduledOrder({
      ...orderData,
      userId: req.user.id,
      scheduledTime,
      validUntil,
    });

    return {
      success: true,
      scheduledOrderId: orderId,
      message: '예약 주문이 생성되었습니다.',
    };
  }

  // ============================================
  // 시장 시간
  // ============================================

  /**
   * 시장 상태 조회
   */
  @Get('market/status')
  async getMarketStatus(@Query('market') market?: MarketType) {
    return this.marketHoursService.getMarketStatus(market || 'KRX');
  }

  /**
   * 거래 가능 여부 조회
   */
  @Get('market/can-trade')
  async canTrade(@Query('market') market?: MarketType) {
    return {
      canTrade: this.marketHoursService.canTrade(market || 'KRX'),
      isOpen: this.marketHoursService.isMarketOpen(market || 'KRX'),
      session: this.marketHoursService.getCurrentSession(market || 'KRX'),
    };
  }

  // ============================================
  // 성과 분석
  // ============================================

  /**
   * 성과 대시보드
   */
  @Get('performance/dashboard')
  async getPerformanceDashboard(@Request() req) {
    return this.performanceAnalyticsService.getPerformanceDashboard(req.user.id);
  }

  /**
   * 성과 지표 조회
   */
  @Get('performance/metrics')
  async getPerformanceMetrics(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.performanceAnalyticsService.getUserPerformance(
      req.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * 거래 일지 조회
   */
  @Get('performance/journal')
  async getTradeJournal(
    @Request() req,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('symbol') symbol?: string,
    @Query('strategyId') strategyId?: string,
  ) {
    return this.performanceAnalyticsService.getTradeJournal(req.user.id, {
      limit: limit ? parseInt(limit as any) : undefined,
      offset: offset ? parseInt(offset as any) : undefined,
      symbol,
      strategyId,
    });
  }

  /**
   * 전략별 성과 비교
   */
  @Get('performance/strategies')
  async getStrategyPerformance(@Request() req) {
    return this.performanceAnalyticsService.getStrategyPerformance(req.user.id);
  }

  /**
   * 일별 PnL 히스토리
   */
  @Get('performance/daily-pnl')
  async getDailyPnL(
    @Request() req,
    @Query('days') days?: number,
  ) {
    return this.performanceAnalyticsService.getDailyPnLHistory(
      req.user.id,
      days ? parseInt(days as any) : 30,
    );
  }

  // ============================================
  // 리스크 관리
  // ============================================

  /**
   * 리스크 현황 조회
   */
  @Get('risk/status')
  async getRiskStatus(@Request() req) {
    return this.riskManagerService.getRiskStatus(req.user.id);
  }

  /**
   * 주문 리스크 검증 (사전 검토)
   */
  @Post('risk/validate')
  async validateOrder(@Request() req, @Body() orderData: Partial<OrderRequest>) {
    return this.riskManagerService.validateOrder({
      ...orderData,
      userId: req.user.id,
    } as OrderRequest);
  }

  /**
   * 긴급 청산
   */
  @Post('risk/emergency-liquidation')
  async emergencyLiquidation(@Request() req, @Body() body: { reason: string }) {
    return this.riskManagerService.emergencyLiquidation(
      req.user.id,
      body.reason,
    );
  }

  // ============================================
  // 서킷 브레이커
  // ============================================

  /**
   * 서킷 브레이커 상태 조회
   */
  @Get('circuit-breaker/status')
  async getCircuitBreakerStatus(@Request() req) {
    return this.circuitBreakerService.getStatus(req.user.id);
  }

  /**
   * 서킷 브레이커 수동 리셋
   */
  @Post('circuit-breaker/reset')
  async resetCircuitBreaker(@Request() req) {
    await this.circuitBreakerService.reset(req.user.id);
    return { success: true, message: '서킷 브레이커가 리셋되었습니다.' };
  }

  // ============================================
  // 감사 로그
  // ============================================

  /**
   * 감사 로그 조회
   */
  @Get('audit-logs')
  async getAuditLogs(
    @Request() req,
    @Body()
    filter?: {
      startDate?: string;
      endDate?: string;
      eventTypes?: string[];
      limit?: number;
    },
  ) {
    return this.auditTrailService.getAuditLogs(req.user.id, {
      startDate: filter?.startDate ? new Date(filter.startDate) : undefined,
      endDate: filter?.endDate ? new Date(filter.endDate) : undefined,
      eventTypes: filter?.eventTypes as any,
      limit: filter?.limit,
    });
  }

  /**
   * 최근 중요 이벤트 조회
   */
  @Get('audit-logs/critical')
  async getCriticalEvents(@Request() req) {
    return this.auditTrailService.getRecentCriticalEvents(req.user.id);
  }

  // ============================================
  // 멀티 전략 관리
  // ============================================

  /**
   * 모든 전략 상태 조회
   */
  @Get('strategies/status')
  async getAllStrategiesStatus() {
    return this.multiStrategyService.getAllStrategiesStatus();
  }

  /**
   * 전략 성과 요약
   */
  @Get('strategies/performance')
  async getStrategiesPerformance() {
    return this.multiStrategyService.getPerformanceSummary();
  }

  /**
   * 특정 전략 상태 조회
   */
  @Get('strategies/:id/status')
  async getStrategyStatus(@Param('id') strategyId: string) {
    return this.multiStrategyService.getStrategyStatus(strategyId);
  }

  /**
   * 전략 시작
   */
  @Post('strategies/:id/start')
  async startStrategy(@Param('id') strategyId: string) {
    await this.multiStrategyService.startStrategy(strategyId);
    return { success: true, message: '전략이 시작되었습니다.' };
  }

  /**
   * 전략 중지
   */
  @Post('strategies/:id/stop')
  async stopStrategy(@Param('id') strategyId: string) {
    await this.multiStrategyService.stopStrategy(strategyId);
    return { success: true, message: '전략이 중지되었습니다.' };
  }

  /**
   * 전략 일시정지
   */
  @Post('strategies/:id/pause')
  async pauseStrategy(@Param('id') strategyId: string) {
    await this.multiStrategyService.pauseStrategy(strategyId);
    return { success: true, message: '전략이 일시정지되었습니다.' };
  }

  /**
   * 모든 전략 시작
   */
  @Post('strategies/start-all')
  async startAllStrategies() {
    await this.multiStrategyService.startAllStrategies();
    return { success: true, message: '모든 전략이 시작되었습니다.' };
  }

  /**
   * 모든 전략 중지
   */
  @Post('strategies/stop-all')
  async stopAllStrategies() {
    await this.multiStrategyService.stopAllStrategies();
    return { success: true, message: '모든 전략이 중지되었습니다.' };
  }

  /**
   * 전략 우선순위 설정
   */
  @Post('strategies/:id/priority')
  async setStrategyPriority(
    @Param('id') strategyId: string,
    @Body() body: { priority: StrategyPriority },
  ) {
    await this.multiStrategyService.setStrategyPriority(strategyId, body.priority);
    return { success: true, message: '우선순위가 변경되었습니다.' };
  }

  /**
   * 전략 자본 배분 설정
   */
  @Post('strategies/:id/capital')
  async setCapitalAllocation(
    @Param('id') strategyId: string,
    @Body() body: { percentage: number },
  ) {
    await this.multiStrategyService.setCapitalAllocation(strategyId, body.percentage);
    return { success: true, message: '자본 배분이 변경되었습니다.' };
  }
}

