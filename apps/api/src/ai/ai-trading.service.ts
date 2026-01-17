/**
 * AI Trading Service
 * AI 기반 매매 신호 생성 서비스
 * 
 * 책임:
 * - 가격 예측
 * - 종합 매매 추천
 * - 뉴스/공시 감성 분석
 * - 포트폴리오 최적화 제안
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma } from '@stockboom/database';
import { AiService } from './ai.service';
import { PatternDetectionService } from './pattern-detection.service';
import { IndicatorsService } from '../analysis/indicators.service';
import { KisApiService } from '../market-data/kis-api.service';

export type PredictionHorizon = '1H' | '4H' | '1D' | '1W';

export interface PricePrediction {
  stockId: string;
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  confidence: number;       // 0-100
  priceRange: {
    low: number;
    high: number;
  };
  horizon: PredictionHorizon;
  factors: string[];        // 예측 근거
  createdAt: Date;
}

export interface AIRecommendation {
  stockId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  confidence: number;       // 0-100
  targetPrice?: number;
  stopLoss?: number;
  reasons: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  sentiment: {
    news: number;          // -1 to 1
    technical: number;     // -1 to 1
    patterns: number;      // -1 to 1
  };
  createdAt: Date;
  validUntil: Date;
}

export interface SentimentScore {
  stockId: string;
  overall: number;         // -1 to 1
  news: number;            // -1 to 1
  social: number;          // -1 to 1 (future)
  disclosure: number;      // -1 to 1
  newsCount: number;
  trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING';
  updatedAt: Date;
}

export interface PortfolioOptimization {
  userId: string;
  currentAllocation: Record<string, number>;
  suggestedAllocation: Record<string, number>;
  rebalanceActions: Array<{
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    reason: string;
  }>;
  expectedReturn: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  diversificationScore: number;  // 0-100
}

@Injectable()
export class AITradingService {
  private readonly logger = new Logger(AITradingService.name);

  constructor(
    private aiService: AiService,
    private patternService: PatternDetectionService,
    private indicatorsService: IndicatorsService,
    private kisApiService: KisApiService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 가격 예측
   */
  async predictPrice(
    stockId: string,
    horizon: PredictionHorizon = '1D',
  ): Promise<PricePrediction> {
    this.logger.log(`Predicting price for ${stockId} (${horizon})`);

    const stock = await prisma.stock.findUnique({
      where: { id: stockId },
    });

    if (!stock) {
      throw new Error(`Stock not found: ${stockId}`);
    }

    const currentPrice = Number(stock.currentPrice) || 0;

    // 기술적 지표 조회
    const indicators = await this.getLatestIndicators(stockId);
    
    // 패턴 분석
    const patterns = await this.patternService.detectChartPatterns(stockId);
    const anomalies = await this.patternService.detectAnomalies(stockId);

    // 뉴스 감성
    const sentiment = await this.analyzeSentiment(stockId);

    // 종합 예측 계산
    const prediction = this.calculatePricePrediction(
      currentPrice,
      indicators,
      patterns,
      anomalies,
      sentiment,
      horizon,
    );

    return {
      stockId,
      symbol: stock.symbol,
      currentPrice,
      predictedPrice: prediction.price,
      direction: prediction.direction,
      confidence: prediction.confidence,
      priceRange: prediction.range,
      horizon,
      factors: prediction.factors,
      createdAt: new Date(),
    };
  }

  /**
   * 종합 매매 추천
   */
  async generateRecommendation(stockId: string): Promise<AIRecommendation> {
    this.logger.log(`Generating AI recommendation for ${stockId}`);

    const stock = await prisma.stock.findUnique({
      where: { id: stockId },
    });

    if (!stock) {
      throw new Error(`Stock not found: ${stockId}`);
    }

    // 다양한 분석 소스 수집
    const [indicators, patterns, sentiment, aiReport] = await Promise.all([
      this.getLatestIndicators(stockId),
      this.patternService.detectChartPatterns(stockId),
      this.analyzeSentiment(stockId),
      this.aiService.getStockReports(stockId, undefined, 1),
    ]);

    const currentPrice = Number(stock.currentPrice) || 0;

    // 기술적 분석 점수 (-1 to 1)
    const technicalScore = this.calculateTechnicalScore(indicators);

    // 패턴 분석 점수
    const patternScore = this.calculatePatternScore(patterns);

    // 종합 점수
    const compositeScore = (
      technicalScore * 0.35 +
      patternScore * 0.25 +
      sentiment.overall * 0.40
    );

    // 행동 결정
    const { action, strength } = this.determineAction(compositeScore);

    // 목표가 및 손절가 계산
    const targetPrice = this.calculateTargetPrice(currentPrice, action, compositeScore);
    const stopLoss = this.calculateStopLoss(currentPrice, action);

    // 리스크 레벨 결정
    const riskLevel = this.assessRiskLevel(compositeScore, sentiment);

    // 이유 생성
    const reasons = this.generateReasons(
      indicators,
      patterns,
      sentiment,
      aiReport,
    );

    const recommendation: AIRecommendation = {
      stockId,
      symbol: stock.symbol,
      action,
      strength,
      confidence: Math.abs(compositeScore) * 100,
      targetPrice: action !== 'HOLD' ? targetPrice : undefined,
      stopLoss: action !== 'HOLD' ? stopLoss : undefined,
      reasons,
      riskLevel,
      sentiment: {
        news: sentiment.news,
        technical: technicalScore,
        patterns: patternScore,
      },
      createdAt: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24시간 유효
    };

    // 이벤트 발행
    this.eventEmitter.emit('ai.recommendation', recommendation);

    return recommendation;
  }

  /**
   * 뉴스/공시 감성 분석
   */
  async analyzeSentiment(stockId: string): Promise<SentimentScore> {
    const stock = await prisma.stock.findUnique({
      where: { id: stockId },
    });

    if (!stock) {
      throw new Error(`Stock not found: ${stockId}`);
    }

    // 최근 뉴스 7일치 조회
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentNews = await prisma.news.findMany({
      where: {
        stockId,
        publishedAt: { gte: oneWeekAgo },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });

    let newsScore = 0;
    let disclosureScore = 0;

    // 뉴스 감성 점수 계산
    if (recentNews.length > 0) {
      const sentiments = recentNews.map(n => {
        const sentiment = (n.sentiment as any) || { score: 0 };
        return sentiment.score || 0;
      });
      newsScore = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;

      // 최근 뉴스에 더 높은 가중치
      const weightedSum = sentiments.reduce((sum, score, idx) => {
        const weight = 1 - (idx / sentiments.length) * 0.5;
        return sum + score * weight;
      }, 0);
      const weightSum = sentiments.reduce((sum, _, idx) => {
        return sum + (1 - (idx / sentiments.length) * 0.5);
      }, 0);
      newsScore = weightedSum / weightSum;
    }

    // AI 리포트에서 공시 감성 조회
    const aiReports = await prisma.aIReport.findMany({
      where: {
        stockId,
        analysisType: 'NEWS_SUMMARY',
        createdAt: { gte: oneWeekAgo },
      },
      select: { results: true },
      take: 5,
    });

    if (aiReports.length > 0) {
      const disclosureScores = aiReports.map(r => {
        const result = r.results as any;
        return result?.sentimentScore || 0;
      });
      disclosureScore = disclosureScores.reduce((a, b) => a + b, 0) / disclosureScores.length;
    }

    // 종합 점수
    const overall = (newsScore * 0.6 + disclosureScore * 0.4);

    // 추세 방향 결정
    let trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
    if (recentNews.length >= 5) {
      const recentAvg = sentiments => sentiments.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const olderAvg = sentiments => sentiments.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const sentiments = recentNews.map(n => ((n.sentiment as any) || { score: 0 }).score || 0);
      const diff = recentAvg(sentiments) - olderAvg(sentiments);
      if (diff > 0.1) trendDirection = 'IMPROVING';
      else if (diff < -0.1) trendDirection = 'DECLINING';
    }

    return {
      stockId,
      overall,
      news: newsScore,
      social: 0, // 향후 소셜 미디어 분석 추가
      disclosure: disclosureScore,
      newsCount: recentNews.length,
      trendDirection,
      updatedAt: new Date(),
    };
  }

  /**
   * 포트폴리오 최적화 제안
   */
  async optimizePortfolio(userId: string): Promise<PortfolioOptimization> {
    this.logger.log(`Optimizing portfolio for user ${userId}`);

    // 현재 포트폴리오 조회
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      include: {
        positions: {
          include: { stock: true },
        },
      },
    });

    if (portfolios.length === 0) {
      throw new Error('No portfolio found');
    }

    const portfolio = portfolios[0];
    const positions = portfolio.positions;

    // 현재 배분 계산
    const totalValue = positions.reduce(
      (sum, p) => sum + Number(p.marketValue),
      0,
    ) + Number(portfolio.cashBalance);

    const currentAllocation: Record<string, number> = {};
    for (const pos of positions) {
      const weight = (Number(pos.marketValue) / totalValue) * 100;
      currentAllocation[pos.stock.symbol] = weight;
    }

    // 각 포지션 분석
    const recommendations: PortfolioOptimization['rebalanceActions'] = [];
    const suggestedAllocation: Record<string, number> = { ...currentAllocation };

    for (const pos of positions) {
      const rec = await this.generateRecommendation(pos.stockId);
      
      if (rec.action === 'SELL' && rec.strength === 'STRONG') {
        // 강력 매도 추천 → 비중 축소
        const reduceBy = Math.min(suggestedAllocation[pos.stock.symbol] * 0.5, 15);
        suggestedAllocation[pos.stock.symbol] -= reduceBy;
        recommendations.push({
          symbol: pos.stock.symbol,
          action: 'SELL',
          quantity: Math.floor(pos.quantity * 0.3),
          reason: rec.reasons[0] || 'AI 매도 추천',
        });
      } else if (rec.action === 'BUY' && rec.strength === 'STRONG') {
        // 강력 매수 추천 → 비중 확대 (현금 여유 시)
        if (suggestedAllocation[pos.stock.symbol] < 25) {
          suggestedAllocation[pos.stock.symbol] += 5;
          recommendations.push({
            symbol: pos.stock.symbol,
            action: 'BUY',
            quantity: Math.floor(pos.quantity * 0.2),
            reason: rec.reasons[0] || 'AI 매수 추천',
          });
        }
      }
    }

    // 분산 점수 계산
    const weights = Object.values(suggestedAllocation);
    const hhi = weights.reduce((sum, w) => sum + (w / 100) ** 2, 0);
    const diversificationScore = Math.round((1 - hhi) * 100);

    // 리스크 레벨 결정
    const maxWeight = Math.max(...weights);
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (maxWeight > 40) riskLevel = 'HIGH';
    else if (maxWeight < 20) riskLevel = 'LOW';

    return {
      userId,
      currentAllocation,
      suggestedAllocation,
      rebalanceActions: recommendations,
      expectedReturn: 0, // 복잡한 계산 필요
      riskLevel,
      diversificationScore,
    };
  }

  /**
   * 최신 기술적 지표 조회
   */
  private async getLatestIndicators(stockId: string): Promise<any> {
    const indicators = await prisma.indicator.findMany({
      where: { stockId },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });

    const result: Record<string, any> = {};
    for (const ind of indicators) {
      result[ind.type] = ind.values;
    }
    return result;
  }

  /**
   * 가격 예측 계산
   */
  private calculatePricePrediction(
    currentPrice: number,
    indicators: any,
    patterns: any,
    anomalies: any,
    sentiment: SentimentScore,
    horizon: PredictionHorizon,
  ): {
    price: number;
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    confidence: number;
    range: { low: number; high: number };
    factors: string[];
  } {
    const factors: string[] = [];
    let directionScore = 0;

    // RSI 기반
    const rsi = indicators.RSI?.value || 50;
    if (rsi < 30) {
      directionScore += 0.3;
      factors.push(`RSI ${rsi.toFixed(1)} - 과매도 구간`);
    } else if (rsi > 70) {
      directionScore -= 0.3;
      factors.push(`RSI ${rsi.toFixed(1)} - 과매수 구간`);
    }

    // MACD 기반
    const macd = indicators.MACD?.value;
    if (macd) {
      if (macd.macd > macd.signal) {
        directionScore += 0.2;
        factors.push('MACD 골든크로스');
      } else {
        directionScore -= 0.2;
        factors.push('MACD 데드크로스');
      }
    }

    // 패턴 기반
    if (patterns.patterns?.length > 0) {
      for (const pattern of patterns.patterns) {
        if (pattern.type === 'DOUBLE_BOTTOM') {
          directionScore += 0.25;
          factors.push('더블바텀 패턴 감지');
        } else if (pattern.type === 'DOUBLE_TOP') {
          directionScore -= 0.25;
          factors.push('더블탑 패턴 감지');
        }
      }
    }

    // 감성 기반
    directionScore += sentiment.overall * 0.3;
    if (Math.abs(sentiment.overall) > 0.3) {
      factors.push(`뉴스 감성 ${sentiment.overall > 0 ? '긍정적' : '부정적'}`);
    }

    // 방향 결정
    let direction: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    if (directionScore > 0.15) direction = 'UP';
    else if (directionScore < -0.15) direction = 'DOWN';

    // 시간대별 변동률 조정
    const volatilityMultiplier: Record<PredictionHorizon, number> = {
      '1H': 0.5,
      '4H': 1.0,
      '1D': 2.0,
      '1W': 5.0,
    };
    const volatility = volatilityMultiplier[horizon];

    // 예측 가격 계산
    const changePercent = directionScore * volatility * 2; // 최대 ±10% 정도
    const predictedPrice = currentPrice * (1 + changePercent / 100);

    // 가격 범위
    const rangePercent = volatility * 1.5;
    const range = {
      low: currentPrice * (1 - rangePercent / 100),
      high: currentPrice * (1 + rangePercent / 100),
    };

    // 신뢰도
    const confidence = Math.min(100, Math.abs(directionScore) * 100 + 30);

    return { price: predictedPrice, direction, confidence, range, factors };
  }

  /**
   * 기술적 분석 점수 계산
   */
  private calculateTechnicalScore(indicators: any): number {
    let score = 0;

    const rsi = indicators.RSI?.value;
    if (rsi !== undefined) {
      if (rsi < 30) score += 0.4;
      else if (rsi < 40) score += 0.2;
      else if (rsi > 70) score -= 0.4;
      else if (rsi > 60) score -= 0.2;
    }

    const macd = indicators.MACD?.value;
    if (macd) {
      if (macd.histogram > 0) score += 0.3;
      else score -= 0.3;
    }

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * 패턴 분석 점수 계산
   */
  private calculatePatternScore(patterns: any): number {
    let score = 0;

    for (const pattern of patterns.patterns || []) {
      switch (pattern.type) {
        case 'DOUBLE_BOTTOM':
        case 'ASCENDING_TRIANGLE':
          score += 0.4;
          break;
        case 'DOUBLE_TOP':
        case 'DESCENDING_TRIANGLE':
          score -= 0.4;
          break;
        case 'SYMMETRICAL_TRIANGLE':
          break; // 중립
      }
    }

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * 행동 결정
   */
  private determineAction(score: number): {
    action: 'BUY' | 'SELL' | 'HOLD';
    strength: 'STRONG' | 'MODERATE' | 'WEAK';
  } {
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';

    if (score > 0.6) {
      action = 'BUY';
      strength = 'STRONG';
    } else if (score > 0.3) {
      action = 'BUY';
      strength = 'MODERATE';
    } else if (score > 0.1) {
      action = 'BUY';
      strength = 'WEAK';
    } else if (score < -0.6) {
      action = 'SELL';
      strength = 'STRONG';
    } else if (score < -0.3) {
      action = 'SELL';
      strength = 'MODERATE';
    } else if (score < -0.1) {
      action = 'SELL';
      strength = 'WEAK';
    }

    return { action, strength };
  }

  /**
   * 목표가 계산
   */
  private calculateTargetPrice(
    currentPrice: number,
    action: 'BUY' | 'SELL' | 'HOLD',
    score: number,
  ): number {
    const changePercent = Math.abs(score) * 5; // 최대 5%
    if (action === 'BUY') {
      return currentPrice * (1 + changePercent / 100);
    } else if (action === 'SELL') {
      return currentPrice * (1 - changePercent / 100);
    }
    return currentPrice;
  }

  /**
   * 손절가 계산
   */
  private calculateStopLoss(
    currentPrice: number,
    action: 'BUY' | 'SELL' | 'HOLD',
  ): number {
    const stopPercent = 3; // 3% 손절
    if (action === 'BUY') {
      return currentPrice * (1 - stopPercent / 100);
    } else if (action === 'SELL') {
      return currentPrice * (1 + stopPercent / 100);
    }
    return currentPrice;
  }

  /**
   * 리스크 레벨 평가
   */
  private assessRiskLevel(
    score: number,
    sentiment: SentimentScore,
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    const uncertainty = 1 - Math.abs(score);
    const sentimentVolatility = Math.abs(sentiment.news - sentiment.disclosure);

    if (uncertainty > 0.7 || sentimentVolatility > 0.5) return 'HIGH';
    if (uncertainty > 0.4 || sentimentVolatility > 0.3) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 추천 이유 생성
   */
  private generateReasons(
    indicators: any,
    patterns: any,
    sentiment: SentimentScore,
    aiReports: any[],
  ): string[] {
    const reasons: string[] = [];

    // 기술적 지표 기반
    const rsi = indicators.RSI?.value;
    if (rsi < 30) reasons.push(`RSI ${rsi?.toFixed(1)} - 과매도 반등 기대`);
    else if (rsi > 70) reasons.push(`RSI ${rsi?.toFixed(1)} - 과매수 조정 예상`);

    // 패턴 기반
    for (const pattern of patterns.patterns || []) {
      reasons.push(`${pattern.type} 차트 패턴 감지`);
    }

    // 감성 기반
    if (sentiment.overall > 0.3) {
      reasons.push(`긍정적 뉴스 흐름 (${sentiment.newsCount}건)`);
    } else if (sentiment.overall < -0.3) {
      reasons.push(`부정적 뉴스 흐름 (${sentiment.newsCount}건)`);
    }

    if (sentiment.trendDirection === 'IMPROVING') {
      reasons.push('뉴스 감성 개선 추세');
    } else if (sentiment.trendDirection === 'DECLINING') {
      reasons.push('뉴스 감성 악화 추세');
    }

    // AI 리포트 기반
    if (aiReports?.[0]?.results) {
      const report = aiReports[0].results as any;
      if (report.recommendation) {
        reasons.push(`AI 분석 추천: ${report.recommendation}`);
      }
    }

    return reasons.length > 0 ? reasons : ['종합 분석 기반 추천'];
  }
}
