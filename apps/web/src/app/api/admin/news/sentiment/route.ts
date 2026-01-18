import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Mock data - would be replaced with real news sentiment service call
        const sentiment = {
            overallScore: 62,
            label: '긍정적',
            positiveNews: 28,
            negativeNews: 12,
            neutralNews: 10,
            topKeywords: ['반도체', 'AI', '삼성전자', '실적', '금리', 'FOMC', 'SK하이닉스', 'HBM', '수출', '코스피']
        };

        const news = [
            { id: '1', title: '삼성전자, AI 반도체 수요 급증에 HBM 생산량 확대', source: '한국경제', url: '#', publishedAt: '10분 전', sentiment: 'POSITIVE', sentimentScore: 78, keywords: ['삼성전자', 'AI', 'HBM'], relatedStocks: ['005930'] },
            { id: '2', title: 'SK하이닉스, 2분기 실적 어닝 서프라이즈 전망', source: '매일경제', url: '#', publishedAt: '25분 전', sentiment: 'POSITIVE', sentimentScore: 85, keywords: ['SK하이닉스', '실적'], relatedStocks: ['000660'] },
            { id: '3', title: '미 Fed, 기준금리 동결 전망에 시장 안도', source: '연합뉴스', url: '#', publishedAt: '32분 전', sentiment: 'POSITIVE', sentimentScore: 65, keywords: ['금리', 'FOMC'], relatedStocks: [] },
            { id: '4', title: '중국 경기 둔화 우려, 철강・화학업종 하락', source: '서울경제', url: '#', publishedAt: '45분 전', sentiment: 'NEGATIVE', sentimentScore: 32, keywords: ['중국', '철강', '화학'], relatedStocks: ['005490', '051910'] },
            { id: '5', title: '코스피 2,500선 공방... 외국인 순매수 지속', source: '뉴스1', url: '#', publishedAt: '1시간 전', sentiment: 'NEUTRAL', sentimentScore: 52, keywords: ['코스피', '외국인'], relatedStocks: [] },
            { id: '6', title: '카카오, 사업 재편 따른 불확실성 확대', source: '머니투데이', url: '#', publishedAt: '1시간 전', sentiment: 'NEGATIVE', sentimentScore: 28, keywords: ['카카오'], relatedStocks: ['035720'] },
            { id: '7', title: '네이버, 라인야후 지분 매각 검토설에 주가 급등', source: '파이낸셜뉴스', url: '#', publishedAt: '2시간 전', sentiment: 'POSITIVE', sentimentScore: 72, keywords: ['네이버', '라인'], relatedStocks: ['035420'] },
            { id: '8', title: '2차전지 업종 차익실현 매물 출회', source: '이데일리', url: '#', publishedAt: '2시간 전', sentiment: 'NEGATIVE', sentimentScore: 38, keywords: ['2차전지'], relatedStocks: ['373220', '006400'] },
        ];

        return NextResponse.json({
            sentiment,
            news,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('News sentiment fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch news data' }, { status: 500 });
    }
}
