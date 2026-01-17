/**
 * Strategy Factory Service
 * 전략 팩토리 - 전략 인스턴스 생성 및 관리
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IndicatorsService } from '../analysis/indicators.service';
import { KisApiService } from '../market-data/kis-api.service';
import {
  IStrategy,
  BaseStrategyConfig,
  IStrategyFactory,
  STRATEGY_TYPES,
} from './templates';
import { GridStrategy, GridStrategyConfig } from './templates/grid-strategy';
import { TrendFollowingStrategy, TrendFollowingConfig } from './templates/trend-following-strategy';
import { MeanReversionStrategy, MeanReversionConfig } from './templates/mean-reversion-strategy';
import { BreakoutStrategy, BreakoutConfig } from './templates/breakout-strategy';

@Injectable()
export class StrategyFactoryService implements IStrategyFactory {
  private readonly logger = new Logger(StrategyFactoryService.name);
  
  // 활성 전략 인스턴스 저장
  private activeStrategies: Map<string, IStrategy> = new Map();

  constructor(
    private indicatorsService: IndicatorsService,
    private kisApiService: KisApiService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 사용 가능한 전략 타입 목록
   */
  getAvailableTypes(): string[] {
    return Object.values(STRATEGY_TYPES);
  }

  /**
   * 전략 타입별 기본 설정
   */
  getDefaultConfig(type: string): Partial<BaseStrategyConfig> {
    switch (type) {
      case STRATEGY_TYPES.GRID:
        return {
          name: '그리드 전략',
          timeframe: '1m',
          enabled: true,
          stopLossPercent: 5,
        } as Partial<GridStrategyConfig>;

      case STRATEGY_TYPES.TREND_FOLLOWING:
        return {
          name: '추세추종 전략',
          timeframe: '1h',
          enabled: true,
          stopLossPercent: 3,
          takeProfitPercent: 6,
        } as Partial<TrendFollowingConfig>;

      case STRATEGY_TYPES.MEAN_REVERSION:
        return {
          name: '평균회귀 전략',
          timeframe: '1d',
          enabled: true,
          stopLossPercent: 2,
        } as Partial<MeanReversionConfig>;

      case STRATEGY_TYPES.BREAKOUT:
        return {
          name: '돌파 전략',
          timeframe: '1h',
          enabled: true,
          stopLossPercent: 2,
          takeProfitPercent: 5,
        } as Partial<BreakoutConfig>;

      default:
        return {
          name: '사용자 정의 전략',
          timeframe: '1d',
          enabled: true,
        };
    }
  }

  /**
   * 전략 인스턴스 생성
   */
  async create(type: string, config: BaseStrategyConfig): Promise<IStrategy> {
    const strategyId = `${type}-${Date.now()}`;
    let strategy: IStrategy;

    this.logger.log(`Creating strategy: ${type} (${strategyId})`);

    switch (type) {
      case STRATEGY_TYPES.GRID:
        strategy = new GridStrategy(
          strategyId,
          config as GridStrategyConfig,
          this.kisApiService,
          this.eventEmitter,
        );
        break;

      case STRATEGY_TYPES.TREND_FOLLOWING:
        strategy = new TrendFollowingStrategy(
          strategyId,
          config as TrendFollowingConfig,
          this.indicatorsService,
          this.kisApiService,
          this.eventEmitter,
        );
        break;

      case STRATEGY_TYPES.MEAN_REVERSION:
        strategy = new MeanReversionStrategy(
          strategyId,
          config as MeanReversionConfig,
          this.indicatorsService,
          this.kisApiService,
          this.eventEmitter,
        );
        break;

      case STRATEGY_TYPES.BREAKOUT:
        strategy = new BreakoutStrategy(
          strategyId,
          config as BreakoutConfig,
          this.indicatorsService,
          this.kisApiService,
          this.eventEmitter,
        );
        break;

      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }

    // 초기화
    await strategy.initialize();

    // 활성 전략 목록에 추가
    this.activeStrategies.set(strategyId, strategy);

    this.logger.log(`Strategy created and initialized: ${strategyId}`);

    return strategy;
  }

  /**
   * 전략 인스턴스 조회
   */
  getStrategy(strategyId: string): IStrategy | undefined {
    return this.activeStrategies.get(strategyId);
  }

  /**
   * 모든 활성 전략 조회
   */
  getAllStrategies(): IStrategy[] {
    return Array.from(this.activeStrategies.values());
  }

  /**
   * 전략 종료 및 제거
   */
  async destroyStrategy(strategyId: string): Promise<void> {
    const strategy = this.activeStrategies.get(strategyId);
    if (strategy) {
      await strategy.dispose();
      this.activeStrategies.delete(strategyId);
      this.logger.log(`Strategy destroyed: ${strategyId}`);
    }
  }

  /**
   * 모든 전략 종료
   */
  async destroyAll(): Promise<void> {
    for (const [id, strategy] of this.activeStrategies) {
      await strategy.dispose();
    }
    this.activeStrategies.clear();
    this.logger.log('All strategies destroyed');
  }

  /**
   * 전략 타입별 설명
   */
  getStrategyDescription(type: string): {
    name: string;
    description: string;
    suitableFor: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const descriptions: Record<string, any> = {
      [STRATEGY_TYPES.GRID]: {
        name: '그리드 매매',
        description: '가격대를 일정 간격으로 나누어 자동 매수/매도하는 전략. 박스권 장세에서 효과적으로 수익을 창출합니다.',
        suitableFor: ['횡보장', '변동성이 낮은 종목', '장기 투자'],
        riskLevel: 'MEDIUM',
      },
      [STRATEGY_TYPES.TREND_FOLLOWING]: {
        name: '추세추종',
        description: '상승/하락 추세를 감지하여 추세 방향으로 진입하는 전략. 명확한 추세가 있는 시장에서 효과적입니다.',
        suitableFor: ['추세장', '모멘텀 종목', '중장기 투자'],
        riskLevel: 'MEDIUM',
      },
      [STRATEGY_TYPES.MEAN_REVERSION]: {
        name: '평균회귀',
        description: '가격이 평균에서 크게 벗어났을 때 평균으로 회귀할 것을 기대하고 역진입하는 전략.',
        suitableFor: ['과매수/과매도 구간', '변동성 높은 종목', '단기 투자'],
        riskLevel: 'HIGH',
      },
      [STRATEGY_TYPES.BREAKOUT]: {
        name: '돌파 매매',
        description: '지지선/저항선 돌파 시 추세 방향으로 진입하는 전략. 거래량 확인으로 가짜 돌파를 필터링합니다.',
        suitableFor: ['신고가 돌파', '박스권 이탈', '중단기 투자'],
        riskLevel: 'HIGH',
      },
    };

    return descriptions[type] || {
      name: '알 수 없음',
      description: '알 수 없는 전략 유형입니다.',
      suitableFor: [],
      riskLevel: 'HIGH',
    };
  }

  /**
   * 활성 전략 수
   */
  getActiveCount(): number {
    return this.activeStrategies.size;
  }
}
