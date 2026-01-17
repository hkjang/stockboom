/**
 * Position Sizing Service
 * 동적 포지션 사이징 서비스
 * 
 * 전문가급 포지션 사이징 알고리즘:
 * - Kelly Criterion (최적 베팅 비율)
 * - ATR 기반 변동성 조정
 * - 최대 손실 기반 역산
 * - 포트폴리오 비중 제한
 * - 리스크 패리티 (동일 리스크 기여)
 */

import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@stockboom/database';
import { KisApiService } from '../market-data/kis-api.service';
import { IndicatorsService } from '../analysis/indicators.service';

export interface PositionSizeRequest {
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  
  // 가격 정보
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // 전략 정보
  winRate?: number;          // 승률 (0-1)
  avgWin?: number;           // 평균 수익률
  avgLoss?: number;          // 평균 손실률
  
  // 제한 조건
  maxPositionPercent?: number;   // 최대 포트폴리오 비중 (%)
  maxRiskPercent?: number;       // 최대 리스크 (%)
}

export interface PositionSizeResult {
  quantity: number;
  amount: number;
  positionPercent: number;    // 포트폴리오 대비 %
  riskAmount: number;         // 리스크 금액
  riskPercent: number;        // 포트폴리오 대비 리스크 %
  
  sizing: {
    method: string;
    kellyFraction?: number;
    atrMultiple?: number;
    riskRewardRatio?: number;
  };
  
  adjustments: string[];      // 적용된 조정 사항
}

@Injectable()
export class PositionSizingService {
  private readonly logger = new Logger(PositionSizingService.name);

  // 기본 설정
  private readonly DEFAULT_MAX_POSITION_PERCENT = 10;  // 한 종목 최대 10%
  private readonly DEFAULT_MAX_RISK_PERCENT = 2;       // 거래당 최대 2% 리스크
  private readonly KELLY_FRACTION = 0.25;              // Kelly의 1/4 사용 (보수적)

  constructor(
    private kisApiService: KisApiService,
    private indicatorsService: IndicatorsService,
  ) {}

  /**
   * 최적 포지션 크기 계산
   */
  async calculateOptimalSize(request: PositionSizeRequest): Promise<PositionSizeResult> {
    this.logger.debug(`Calculating position size for ${request.symbol}`);

    const adjustments: string[] = [];

    // 포트폴리오 정보 조회
    const portfolioInfo = await this.getPortfolioInfo(request.userId);
    const { totalEquity, availableCash } = portfolioInfo;

    // 최대 비중/리스크 설정
    const maxPositionPercent = request.maxPositionPercent || this.DEFAULT_MAX_POSITION_PERCENT;
    const maxRiskPercent = request.maxRiskPercent || this.DEFAULT_MAX_RISK_PERCENT;

    // 1. Kelly Criterion 기반 수량
    let kellySize = 0;
    let kellyFraction: number | undefined;
    
    if (request.winRate && request.avgWin && request.avgLoss) {
      kellyFraction = this.calculateKellyFraction(
        request.winRate,
        request.avgWin,
        request.avgLoss,
      );
      kellySize = Math.floor((totalEquity * kellyFraction * this.KELLY_FRACTION) / request.entryPrice);
      adjustments.push(`Kelly: ${(kellyFraction * 100).toFixed(1)}% → 적용 ${(kellyFraction * this.KELLY_FRACTION * 100).toFixed(1)}%`);
    }

    // 2. ATR 기반 수량 (변동성 조정)
    let atrSize = 0;
    let atrMultiple: number | undefined;
    
    try {
      const atr = await this.calculateATR(request.symbol);
      if (atr > 0) {
        // 리스크 금액 = 총 자본 * 최대 리스크 %
        const riskAmount = totalEquity * (maxRiskPercent / 100);
        // ATR의 2배를 예상 손실로 가정
        atrMultiple = 2;
        const expectedLoss = atr * atrMultiple;
        atrSize = Math.floor(riskAmount / expectedLoss);
        adjustments.push(`ATR(${atr.toFixed(0)}) 기반 변동성 조정`);
      }
    } catch {
      // ATR 계산 실패 시 무시
    }

    // 3. 손절가 기반 수량
    let stopLossSize = 0;
    let riskRewardRatio: number | undefined;
    
    if (request.stopLoss) {
      const riskPerShare = Math.abs(request.entryPrice - request.stopLoss);
      if (riskPerShare > 0) {
        const riskAmount = totalEquity * (maxRiskPercent / 100);
        stopLossSize = Math.floor(riskAmount / riskPerShare);
        adjustments.push(`손절가(${request.stopLoss.toLocaleString()}원) 기반 리스크 관리`);
        
        if (request.takeProfit) {
          const rewardPerShare = Math.abs(request.takeProfit - request.entryPrice);
          riskRewardRatio = rewardPerShare / riskPerShare;
          adjustments.push(`R:R = 1:${riskRewardRatio.toFixed(1)}`);
        }
      }
    }

    // 4. 최대 비중 기반 수량
    const maxPositionAmount = totalEquity * (maxPositionPercent / 100);
    const maxPositionSize = Math.floor(maxPositionAmount / request.entryPrice);

    // 5. 가용 현금 기반 수량
    const cashBasedSize = Math.floor(availableCash / request.entryPrice);

    // 최종 수량 결정 (가장 보수적인 값 선택)
    const candidates = [
      { method: 'Kelly', size: kellySize },
      { method: 'ATR', size: atrSize },
      { method: 'StopLoss', size: stopLossSize },
      { method: 'MaxPosition', size: maxPositionSize },
      { method: 'Cash', size: cashBasedSize },
    ].filter(c => c.size > 0);

    if (candidates.length === 0) {
      return {
        quantity: 0,
        amount: 0,
        positionPercent: 0,
        riskAmount: 0,
        riskPercent: 0,
        sizing: { method: 'NONE' },
        adjustments: ['가용 자금 부족'],
      };
    }

    // 최소값 선택 (가장 보수적)
    candidates.sort((a, b) => a.size - b.size);
    const selected = candidates[0];
    const quantity = selected.size;
    const amount = quantity * request.entryPrice;

    // 실제 리스크 계산
    let riskAmount = 0;
    if (request.stopLoss) {
      riskAmount = quantity * Math.abs(request.entryPrice - request.stopLoss);
    } else if (atrMultiple) {
      const atr = await this.calculateATR(request.symbol).catch(() => 0);
      riskAmount = quantity * atr * atrMultiple;
    } else {
      // 기본 5% 손실 가정
      riskAmount = amount * 0.05;
    }

    const positionPercent = (amount / totalEquity) * 100;
    const riskPercent = (riskAmount / totalEquity) * 100;

    adjustments.push(`선택된 방법: ${selected.method}`);

    return {
      quantity,
      amount,
      positionPercent,
      riskAmount,
      riskPercent,
      sizing: {
        method: selected.method,
        kellyFraction,
        atrMultiple,
        riskRewardRatio,
      },
      adjustments,
    };
  }

  /**
   * Kelly Criterion 계산
   * f* = (bp - q) / b
   * b = 평균 수익/평균 손실 비율
   * p = 승률
   * q = 패률 (1 - p)
   */
  private calculateKellyFraction(
    winRate: number,
    avgWin: number,
    avgLoss: number,
  ): number {
    if (avgLoss === 0) return 0;

    const b = avgWin / avgLoss;  // 손익 비율
    const p = winRate;
    const q = 1 - winRate;

    const kelly = (b * p - q) / b;

    // 0-1 사이로 제한
    return Math.max(0, Math.min(1, kelly));
  }

  /**
   * ATR 계산
   */
  private async calculateATR(symbol: string, period: number = 14): Promise<number> {
    const stock = await prisma.stock.findFirst({
      where: { symbol },
    });

    if (!stock) return 0;

    const candles = await prisma.candle.findMany({
      where: { stockId: stock.id, timeframe: '1d' },
      orderBy: { timestamp: 'desc' },
      take: period + 1,
    });

    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 0; i < candles.length - 1; i++) {
      const current = candles[i];
      const previous = candles[i + 1];

      const tr = Math.max(
        Number(current.high) - Number(current.low),
        Math.abs(Number(current.high) - Number(previous.close)),
        Math.abs(Number(current.low) - Number(previous.close)),
      );

      trueRanges.push(tr);
    }

    // 평균 진폭
    return trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  }

  /**
   * 포트폴리오 정보 조회
   */
  private async getPortfolioInfo(userId: string): Promise<{
    totalEquity: number;
    availableCash: number;
  }> {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
    });

    if (portfolios.length === 0) {
      return { totalEquity: 0, availableCash: 0 };
    }

    const totalEquity = portfolios.reduce(
      (sum, p) => sum + Number(p.totalValue),
      0,
    );
    const availableCash = portfolios.reduce(
      (sum, p) => sum + Number(p.cashBalance),
      0,
    );

    return { totalEquity, availableCash };
  }

  /**
   * 리스크 패리티 기반 배분 계산
   * 모든 포지션이 동일한 리스크를 기여하도록 조정
   */
  async calculateRiskParity(
    userId: string,
    symbols: string[],
    targetRiskPercent: number = 10,
  ): Promise<Record<string, PositionSizeResult>> {
    this.logger.debug(`Calculating risk parity for ${symbols.length} symbols`);

    const results: Record<string, PositionSizeResult> = {};
    const portfolioInfo = await this.getPortfolioInfo(userId);
    const totalEquity = portfolioInfo.totalEquity;

    // 각 종목의 변동성 계산
    const volatilities: Record<string, number> = {};
    let totalInverseVol = 0;

    for (const symbol of symbols) {
      const atr = await this.calculateATR(symbol);
      const stock = await prisma.stock.findFirst({ where: { symbol } });
      const price = stock ? Number(stock.currentPrice) : 0;
      
      // ATR을 % 변동성으로 변환
      const volPercent = price > 0 ? (atr / price) * 100 : 5;
      volatilities[symbol] = volPercent;
      totalInverseVol += 1 / volPercent;
    }

    // 역변동성 가중 배분
    for (const symbol of symbols) {
      const volPercent = volatilities[symbol];
      const weight = (1 / volPercent) / totalInverseVol;
      const targetAmount = totalEquity * (targetRiskPercent / 100) * weight;
      
      const stock = await prisma.stock.findFirst({ where: { symbol } });
      const price = stock ? Number(stock.currentPrice) : 0;
      const quantity = price > 0 ? Math.floor(targetAmount / price) : 0;

      results[symbol] = {
        quantity,
        amount: quantity * price,
        positionPercent: (quantity * price / totalEquity) * 100,
        riskAmount: quantity * price * (volPercent / 100),
        riskPercent: (quantity * price * (volPercent / 100) / totalEquity) * 100,
        sizing: {
          method: 'RiskParity',
          atrMultiple: volPercent,
        },
        adjustments: [`리스크패리티 가중치: ${(weight * 100).toFixed(1)}%`],
      };
    }

    return results;
  }

  /**
   * 피라미딩 수량 계산
   * 기존 포지션에 추가 진입 시 적정 수량
   */
  async calculatePyramidSize(
    userId: string,
    symbol: string,
    currentQuantity: number,
    currentAvgPrice: number,
    newEntryPrice: number,
    maxPyramidLevels: number = 3,
  ): Promise<PositionSizeResult | null> {
    // 피라미딩은 수익 중일 때만
    if (newEntryPrice <= currentAvgPrice) {
      return null;
    }

    // 추가 진입 수량 = 기존 수량의 50% (피라미드 형태)
    const additionalQty = Math.floor(currentQuantity * 0.5);

    const portfolioInfo = await this.getPortfolioInfo(userId);
    const amount = additionalQty * newEntryPrice;
    const positionPercent = (amount / portfolioInfo.totalEquity) * 100;

    return {
      quantity: additionalQty,
      amount,
      positionPercent,
      riskAmount: 0, // 피라미딩은 이미 수익 중이므로 리스크 낮음
      riskPercent: 0,
      sizing: {
        method: 'Pyramid',
      },
      adjustments: [
        `피라미딩 추가 진입`,
        `기존 ${currentQuantity}주 + ${additionalQty}주`,
      ],
    };
  }

  /**
   * 스케일아웃 수량 계산
   * 부분 익절/손절 수량 결정
   */
  calculateScaleOutQuantity(
    currentQuantity: number,
    scaleOutPercent: number = 50,
  ): number {
    return Math.floor(currentQuantity * (scaleOutPercent / 100));
  }
}
