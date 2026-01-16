import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@stockboom/database';
import OpenAI from 'openai';

/**
 * AI Service
 * Handles LLM-based news analysis and risk scoring
 */
@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private openai: OpenAI;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');

        if (apiKey) {
            this.openai = new OpenAI({
                apiKey,
            });
            this.logger.log('OpenAI client initialized');
        } else {
            this.logger.warn('OpenAI API key not configured. AI features will be disabled.');
        }
    }

    /**
     * Analyze news article using LLM
     */
    async analyzeNews(newsId: string): Promise<{
        sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
        sentimentScore: number;
        riskScore: number;
        summary: string;
        recommendation: 'BUY' | 'SELL' | 'HOLD';
        confidence: number;
    }> {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const news = await prisma.news.findUnique({
            where: { id: newsId },
            include: { stock: true },
        });

        if (!news) {
            throw new Error('News not found');
        }

        try {
            const startTime = Date.now();
            const prompt = this.buildAnalysisPrompt(news);

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional stock market analyst. Analyze news articles and provide structured insights in JSON format.
                        
Response format:
{
  "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "sentimentScore": number (-100 to 100),
  "riskScore": number (0 to 100, higher means more risk),
  "summary": "Brief 2-3 sentence summary in Korean",
  "recommendation": "BUY" | "SELL" | "HOLD",
  "confidence": number (0 to 100),
  "reasoning": "Brief explanation in Korean"
}`
                    },
                    {
                        role: 'user',
                        content: prompt,
                    }
                ],
                temperature: 0.3, // Lower temperature for more consistent results
                response_format: { type: 'json_object' },
            });

            const result = JSON.parse(response.choices[0].message.content || '{}');

            // Save AI report
            await prisma.aIReport.create({
                data: {
                    stockId: news.stockId!,
                    newsId: news.id,
                    analysisType: 'NEWS_SUMMARY',
                    model: 'gpt-4',
                    version: '1.0',
                    results: result,
                    riskScore: result.riskScore,
                    confidence: result.confidence,
                    summary: result.summary,
                    recommendation: result.recommendation,
                    processingTime: Date.now() - startTime,
                },
            });

            // Update news sentiment
            await prisma.news.update({
                where: { id: newsId },
                data: {
                    sentiment: result.sentiment,
                    sentimentScore: result.sentimentScore,
                },
            });

            this.logger.log(`News analysis completed: ${newsId}`);

            return result;

        } catch (error) {
            this.logger.error(`Failed to analyze news ${newsId}:`, error);
            throw error;
        }
    }

    /**
     * Analyze multiple news articles for a stock
     */
    async analyzeStockNews(stockId: string, limit: number = 10): Promise<{
        overallSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
        averageSentimentScore: number;
        averageRiskScore: number;
        newsCount: number;
        reports: any[];
    }> {
        const recentNews = await prisma.news.findMany({
            where: { stockId },
            orderBy: { publishedAt: 'desc' },
            take: limit,
        });

        const reports: any[] = [];
        let totalSentimentScore = 0;
        let totalRiskScore = 0;

        for (const news of recentNews) {
            try {
                // Check if already analyzed
                const existingReport = await prisma.aIReport.findFirst({
                    where: {
                        newsId: news.id,
                        analysisType: 'NEWS_SUMMARY',
                    },
                });

                if (existingReport) {
                    reports.push(existingReport as any);
                    totalSentimentScore += Number((existingReport.results as any)['sentimentScore'] || 0);
                    totalRiskScore += Number(existingReport.riskScore || 0);
                } else {
                    // Analyze new
                    const analysis = await this.analyzeNews(news.id);
                    reports.push(analysis as any);
                    totalSentimentScore += analysis.sentimentScore;
                    totalRiskScore += analysis.riskScore;
                }
            } catch (error) {
                this.logger.error(`Failed to analyze news ${news.id}:`, error);
            }
        }

        const averageSentimentScore = reports.length > 0 ? totalSentimentScore / reports.length : 0;
        const averageRiskScore = reports.length > 0 ? totalRiskScore / reports.length : 0;

        let overallSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
        if (averageSentimentScore > 20) {
            overallSentiment = 'POSITIVE';
        } else if (averageSentimentScore < -20) {
            overallSentiment = 'NEGATIVE';
        } else {
            overallSentiment = 'NEUTRAL';
        }

        return {
            overallSentiment,
            averageSentimentScore,
            averageRiskScore,
            newsCount: reports.length,
            reports,
        };
    }

    /**
     * Generate comprehensive stock analysis report
     */
    async generateStockReport(stockId: string): Promise<any> {
        const stock = await prisma.stock.findUnique({
            where: { id: stockId },
            include: {
                indicators: {
                    where: { timeframe: '1d' },
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                },
                candles: {
                    where: { timeframe: '1d' },
                    orderBy: { timestamp: 'desc' },
                    take: 30,
                },
            },
        });

        if (!stock) {
            throw new Error('Stock not found');
        }

        // Get news analysis
        const newsAnalysis = await this.analyzeStockNews(stockId, 5);

        // Get latest technical indicators
        const latestIndicator = stock.indicators[0];

        // Generate综合 report with LLM
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const prompt = `다음 주식에 대한 종합 분석 리포트를 작성해주세요:

종목명: ${stock.name} (${stock.symbol})
현재가: ${stock.currentPrice}원

기술적 지표:
${latestIndicator ? JSON.stringify(latestIndicator.values, null, 2) : '데이터 없음'}

뉴스 분석:
- 전체 감정: ${newsAnalysis.overallSentiment}
- 평균 감정 점수: ${newsAnalysis.averageSentimentScore.toFixed(1)}
- 평균 리스크 점수: ${newsAnalysis.averageRiskScore.toFixed(1)}

다음 형식으로 JSON 응답:
{
  "summary": "전체 요약 (3-4문장)",
  "technicalAnalysis": "기술적 분석 요약",
  "fundamentalAnalysis": "펀더멘털 분석 (뉴스 기반)",
  "recommendation": "BUY" | "SELL" | "HOLD",
  "targetPrice": 목표가 (숫자),
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "keyPoints": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"]
}`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional stock analyst. Provide comprehensive stock analysis in Korean.',
                },
                {
                    role: 'user',
                    content: prompt,
                }
            ],
            response_format: { type: 'json_object' },
        });

        const report = JSON.parse(response.choices[0].message.content || '{}');

        // Save comprehensive report
        const startTime = Date.now();
        const aiReport = await prisma.aIReport.create({
            data: {
                stockId,
                analysisType: 'PORTFOLIO_OPT',
                model: 'gpt-4',
                version: '1.0',
                results: report,
                riskScore: report.riskLevel === 'HIGH' ? 80 : report.riskLevel === 'MEDIUM' ? 50 : 20,
                confidence: 75,
                summary: report.summary,
                recommendation: report.recommendation,
                processingTime: Date.now() - startTime,
            },
        });

        return {
            stock: {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.currentPrice,
            },
            newsAnalysis,
            report,
            reportId: aiReport.id,
        };
    }

    /**
     * Build analysis prompt for news
     */
    private buildAnalysisPrompt(news: any): string {
        const startTime = Date.now();
        return `다음 뉴스 기사를 분석해주세요:

제목: ${news.title}
내용: ${news.content}
출처: ${news.source}
${news.stock ? `관련 종목: ${news.stock.name} (${news.stock.symbol})` : ''}

이 뉴스가 주식 시장 및 관련 종목에 미칠 영향을 분석하여 JSON 형식으로 답변해주세요.`;
    }

    /**
     * Analyze corporate disclosure using LLM
     */
    async analyzeDisclosure(disclosureData: {
        corpName: string;
        reportTitle: string;
        reportType: string;
        content?: string;
        rcptNo?: string;
    }): Promise<{
        summary: string;
        impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
        impactScore: number;
        keyPoints: string[];
        riskFactors: string[];
        opportunities: string[];
        investmentRecommendation: string;
        confidence: number;
    }> {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        try {
            const prompt = `다음 기업공시를 분석해주세요:

기업명: ${disclosureData.corpName}
공시제목: ${disclosureData.reportTitle}
공시유형: ${disclosureData.reportType}
${disclosureData.content ? `공시내용 요약: ${disclosureData.content.substring(0, 2000)}` : ''}

다음 형식의 JSON으로 응답해주세요:
{
  "summary": "공시 내용 요약 (한국어, 2-3문장)",
  "impact": "POSITIVE" | "NEGATIVE" | "NEUTRAL" (주가 영향),
  "impactScore": -100 ~ 100 (음수: 부정적, 양수: 긍정적),
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "riskFactors": ["리스크 요인 1", "리스크 요인 2"],
  "opportunities": ["투자 기회 1", "투자 기회 2"],
  "investmentRecommendation": "투자자 권고사항 (한국어, 2-3문장)",
  "confidence": 0-100 (분석 신뢰도)
}`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional Korean stock market analyst specializing in corporate disclosure analysis.
Analyze disclosures and provide investment-relevant insights in Korean.
Focus on:
- Financial impact (earnings, assets, liabilities)
- Strategic implications (M&A, expansion, restructuring)
- Risk assessment
- Investment opportunities

Common disclosure types:
- 사업보고서: Annual comprehensive report
- 반기/분기보고서: Semi-annual/Quarterly reports
- 주요사항보고서: Major event reports (capital changes, M&A)
- 지분공시: Ownership disclosures`,
                    },
                    {
                        role: 'user',
                        content: prompt,
                    }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });

            const result = JSON.parse(response.choices[0].message.content || '{}');

            this.logger.log(`Disclosure analysis completed for: ${disclosureData.corpName}`);

            return {
                summary: result.summary || '분석 결과를 생성할 수 없습니다.',
                impact: result.impact || 'NEUTRAL',
                impactScore: result.impactScore || 0,
                keyPoints: result.keyPoints || [],
                riskFactors: result.riskFactors || [],
                opportunities: result.opportunities || [],
                investmentRecommendation: result.investmentRecommendation || '',
                confidence: result.confidence || 50,
            };

        } catch (error) {
            this.logger.error('Failed to analyze disclosure:', error);
            throw error;
        }
    }

    /**
     * Analyze multiple disclosures and provide comprehensive analysis
     */
    async analyzeDisclosureBatch(disclosures: Array<{
        corpName: string;
        reportTitle: string;
        reportType: string;
        rcptDt: string;
    }>): Promise<{
        overallSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
        averageImpactScore: number;
        analyses: any[];
        summary: string;
    }> {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const disclosureList = disclosures.slice(0, 10).map((d, i) => 
            `${i + 1}. [${d.rcptDt}] ${d.reportTitle}`
        ).join('\n');

        try {
            const prompt = `다음 ${disclosures[0]?.corpName || '기업'}의 최근 공시 목록을 분석하고 종합적인 투자 의견을 제공해주세요:

${disclosureList}

다음 형식의 JSON으로 응답해주세요:
{
  "overallSentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "averageImpactScore": -100 ~ 100,
  "summary": "전체 공시 흐름 요약 (한국어, 3-4문장)",
  "keyTrends": ["주요 트렌드 1", "주요 트렌드 2"],
  "investmentImplication": "투자 시사점 (한국어, 2-3문장)",
  "watchPoints": ["주목할 점 1", "주목할 점 2"]
}`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional Korean stock market analyst. Analyze corporate disclosure patterns and provide investment insights in Korean.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            });

            const result = JSON.parse(response.choices[0].message.content || '{}');

            return {
                overallSentiment: result.overallSentiment || 'NEUTRAL',
                averageImpactScore: result.averageImpactScore || 0,
                analyses: [{
                    keyTrends: result.keyTrends || [],
                    investmentImplication: result.investmentImplication || '',
                    watchPoints: result.watchPoints || [],
                }],
                summary: result.summary || '',
            };

        } catch (error) {
            this.logger.error('Failed to analyze disclosure batch:', error);
            throw error;
        }
    }

    /**
     * Get AI reports for a stock
     */
    async getStockReports(stockId: string, analysisType?: string, limit: number = 10) {
        return prisma.aIReport.findMany({
            where: {
                stockId,
                ...(analysisType && { analysisType }),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                stock: true,
                news: true,
            },
        });
    }
}
