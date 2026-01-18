import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';

interface NewsArticle {
    id: string;
    title: string;
    summary: string;
    source: string;
    url: string;
    publishedAt: Date;
    sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    sentimentScore?: number;
    keywords?: string[];
    relatedStocks?: string[];
}

interface MarketSentiment {
    overallScore: number;  // 0-100
    label: string;
    positiveNews: number;
    negativeNews: number;
    neutralNews: number;
    topKeywords: string[];
    timestamp: Date;
}

@Injectable()
export class NewsSentimentService {
    private readonly logger = new Logger(NewsSentimentService.name);
    private readonly naverFinanceUrl = 'https://finance.naver.com';
    
    constructor(private httpService: HttpService) {}

    /**
     * Scrape latest finance news from Naver Finance
     */
    async getLatestNews(limit: number = 20): Promise<NewsArticle[]> {
        try {
            const url = `${this.naverFinanceUrl}/news/mainnews.naver`;
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                })
            );
            
            const $ = cheerio.load(response.data);
            const articles: NewsArticle[] = [];
            
            $('ul.newsList li').each((i, el) => {
                if (i >= limit) return false;
                
                const $el = $(el);
                const $link = $el.find('a');
                const title = $link.text().trim();
                const href = $link.attr('href') || '';
                const summary = $el.find('.articleSummary').text().trim();
                const source = $el.find('.press').text().trim();
                const time = $el.find('.wdate').text().trim();
                
                if (title) {
                    const article: NewsArticle = {
                        id: `naver-${Date.now()}-${i}`,
                        title,
                        summary: summary || '',
                        source: source || 'Naver Finance',
                        url: href.startsWith('http') ? href : `${this.naverFinanceUrl}${href}`,
                        publishedAt: this.parseKoreanTime(time),
                    };
                    
                    // Simple sentiment analysis based on keywords
                    const sentiment = this.analyzeSentiment(title + ' ' + summary);
                    article.sentiment = sentiment.label;
                    article.sentimentScore = sentiment.score;
                    article.keywords = this.extractKeywords(title);
                    article.relatedStocks = this.extractStockMentions(title + ' ' + summary);
                    
                    articles.push(article);
                }
            });
            
            return articles;
        } catch (error) {
            this.logger.error(`Failed to fetch news: ${error.message}`);
            return [];
        }
    }

    /**
     * Get news for specific stock
     */
    async getStockNews(symbol: string, limit: number = 10): Promise<NewsArticle[]> {
        try {
            const url = `${this.naverFinanceUrl}/item/news.naver?code=${symbol}`;
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                })
            );
            
            const $ = cheerio.load(response.data);
            const articles: NewsArticle[] = [];
            
            $('table.type5 tbody tr').each((i, el) => {
                if (i >= limit) return false;
                
                const $el = $(el);
                const $link = $el.find('.title a');
                const title = $link.text().trim();
                const href = $link.attr('href') || '';
                const source = $el.find('.info').text().trim();
                const time = $el.find('.date').text().trim();
                
                if (title && !$el.hasClass('relation_tit')) {
                    const sentiment = this.analyzeSentiment(title);
                    
                    articles.push({
                        id: `stock-${symbol}-${Date.now()}-${i}`,
                        title,
                        summary: '',
                        source: source || 'Unknown',
                        url: href.startsWith('http') ? href : `${this.naverFinanceUrl}${href}`,
                        publishedAt: this.parseKoreanTime(time),
                        sentiment: sentiment.label,
                        sentimentScore: sentiment.score,
                        relatedStocks: [symbol],
                    });
                }
            });
            
            return articles;
        } catch (error) {
            this.logger.error(`Failed to fetch stock news for ${symbol}: ${error.message}`);
            return [];
        }
    }

    /**
     * Calculate overall market sentiment
     */
    async getMarketSentiment(): Promise<MarketSentiment> {
        const news = await this.getLatestNews(50);
        
        let positiveCount = 0;
        let negativeCount = 0;
        let neutralCount = 0;
        let totalScore = 0;
        const keywordMap = new Map<string, number>();
        
        for (const article of news) {
            if (article.sentiment === 'POSITIVE') positiveCount++;
            else if (article.sentiment === 'NEGATIVE') negativeCount++;
            else neutralCount++;
            
            totalScore += article.sentimentScore || 50;
            
            article.keywords?.forEach(keyword => {
                keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
            });
        }
        
        const avgScore = news.length > 0 ? totalScore / news.length : 50;
        
        // Get top keywords
        const topKeywords = [...keywordMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([keyword]) => keyword);
        
        let label = '중립';
        if (avgScore >= 70) label = '매우 긍정적';
        else if (avgScore >= 55) label = '긍정적';
        else if (avgScore >= 45) label = '중립';
        else if (avgScore >= 30) label = '부정적';
        else label = '매우 부정적';
        
        return {
            overallScore: Math.round(avgScore),
            label,
            positiveNews: positiveCount,
            negativeNews: negativeCount,
            neutralNews: neutralCount,
            topKeywords,
            timestamp: new Date(),
        };
    }

    /**
     * Simple sentiment analysis based on Korean keywords
     */
    private analyzeSentiment(text: string): { label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; score: number } {
        const positiveWords = [
            '상승', '급등', '호재', '최고', '신고가', '돌파', '성장', '기대', '호조', '강세',
            '반등', '회복', '랠리', '호황', '증가', '확대', 'AI', '혁신', '수혜', '대박',
            '실적개선', '어닝서프라이즈', '목표가상향', '매수추천', '순매수'
        ];
        
        const negativeWords = [
            '하락', '급락', '악재', '폭락', '최저', '위기', '우려', '감소', '쇼크', '약세',
            '손실', '적자', '부진', '하향', '매도', '리스크', '불확실', '충격', '인플레이션',
            '금리인상', '경기침체', '불안', '순매도', '투매', '공매도'
        ];
        
        let positiveScore = 0;
        let negativeScore = 0;
        
        const lowerText = text.toLowerCase();
        
        positiveWords.forEach(word => {
            if (lowerText.includes(word.toLowerCase())) positiveScore += 10;
        });
        
        negativeWords.forEach(word => {
            if (lowerText.includes(word.toLowerCase())) negativeScore += 10;
        });
        
        const score = Math.min(100, Math.max(0, 50 + positiveScore - negativeScore));
        
        let label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
        if (score >= 60) label = 'POSITIVE';
        else if (score <= 40) label = 'NEGATIVE';
        
        return { label, score };
    }

    /**
     * Extract keywords from text
     */
    private extractKeywords(text: string): string[] {
        const keywords: string[] = [];
        const patterns = [
            /삼성전자|SK하이닉스|LG에너지솔루션|네이버|카카오|현대차|기아|셀트리온/g,
            /코스피|코스닥|지수|반도체|2차전지|바이오|AI|인공지능/g,
            /금리|환율|달러|위안/g,
        ];
        
        patterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) keywords.push(...matches);
        });
        
        return [...new Set(keywords)];
    }

    /**
     * Extract stock code mentions from text
     */
    private extractStockMentions(text: string): string[] {
        const stockMap: Record<string, string> = {
            '삼성전자': '005930',
            'SK하이닉스': '000660',
            'LG에너지솔루션': '373220',
            '네이버': '035420',
            '카카오': '035720',
            '현대차': '005380',
            '기아': '000270',
            '셀트리온': '068270',
        };
        
        const mentions: string[] = [];
        Object.entries(stockMap).forEach(([name, code]) => {
            if (text.includes(name)) mentions.push(code);
        });
        
        return mentions;
    }

    /**
     * Parse Korean time format
     */
    private parseKoreanTime(timeStr: string): Date {
        const now = new Date();
        
        if (timeStr.includes('분 전')) {
            const minutes = parseInt(timeStr) || 0;
            return new Date(now.getTime() - minutes * 60000);
        }
        if (timeStr.includes('시간 전')) {
            const hours = parseInt(timeStr) || 0;
            return new Date(now.getTime() - hours * 3600000);
        }
        if (timeStr.includes('일 전')) {
            const days = parseInt(timeStr) || 0;
            return new Date(now.getTime() - days * 86400000);
        }
        
        // Try to parse date format
        const dateMatch = timeStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
        if (dateMatch) {
            return new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
        }
        
        return now;
    }

    /**
     * Check service status
     */
    async checkApiStatus(): Promise<{ connected: boolean; message: string; lastCheck: Date }> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(this.naverFinanceUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 5000,
                })
            );
            
            return {
                connected: response.status === 200,
                message: 'Connected (Web Scraping)',
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                connected: false,
                message: error.message,
                lastCheck: new Date(),
            };
        }
    }
}
