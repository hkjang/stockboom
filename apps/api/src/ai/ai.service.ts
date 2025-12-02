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

            const result = JSON.parse(response.choices[0].message.content);

            // Save AI report
            await prisma.aIReport.create({
                data: {
                    stockId: news.stockId,
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

        const reports = [];
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
                    reports.push(existingReport);
                    totalSentimentScore += Number(existingReport.results['sentimentScore'] || 0);
                    totalRiskScore += Number(existingReport.riskScore || 0);
                } else {
                    // Analyze new
                    const analysis = await this.analyzeNews(news.id);
                    reports.push(analysis);
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

        const report = JSON.parse(response.choices[0].message.content);

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
