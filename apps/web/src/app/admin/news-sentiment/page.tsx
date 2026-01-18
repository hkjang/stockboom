'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
    Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, 
    ExternalLink, Gauge, Clock, Hash, Building2
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface NewsArticle {
    id: string;
    title: string;
    source: string;
    url: string;
    publishedAt: string;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    sentimentScore: number;
    keywords: string[];
    relatedStocks: string[];
}

interface MarketSentiment {
    overallScore: number;
    label: string;
    positiveNews: number;
    negativeNews: number;
    neutralNews: number;
    topKeywords: string[];
}

export default function NewsSentimentPage() {
    const { data, mutate, isLoading } = useSWR('/api/admin/news/sentiment', fetcher);
    const [selectedSentiment, setSelectedSentiment] = useState<string>('all');

    // Mock data
    const sentiment: MarketSentiment = data?.sentiment || {
        overallScore: 62,
        label: '긍정적',
        positiveNews: 28,
        negativeNews: 12,
        neutralNews: 10,
        topKeywords: ['반도체', 'AI', '삼성전자', '실적', '금리', 'FOMC', 'SK하이닉스', 'HBM', '수출', '코스피']
    };

    const news: NewsArticle[] = data?.news || [
        { id: '1', title: '삼성전자, AI 반도체 수요 급증에 HBM 생산량 확대', source: '한국경제', url: '#', publishedAt: '10분 전', sentiment: 'POSITIVE', sentimentScore: 78, keywords: ['삼성전자', 'AI', 'HBM'], relatedStocks: ['005930'] },
        { id: '2', title: 'SK하이닉스, 2분기 실적 어닝 서프라이즈 전망', source: '매일경제', url: '#', publishedAt: '25분 전', sentiment: 'POSITIVE', sentimentScore: 85, keywords: ['SK하이닉스', '실적'], relatedStocks: ['000660'] },
        { id: '3', title: '미 Fed, 기준금리 동결 전망에 시장 안도', source: '연합뉴스', url: '#', publishedAt: '32분 전', sentiment: 'POSITIVE', sentimentScore: 65, keywords: ['금리', 'FOMC'], relatedStocks: [] },
        { id: '4', title: '중국 경기 둔화 우려, 철강・화학업종 하락', source: '서울경제', url: '#', publishedAt: '45분 전', sentiment: 'NEGATIVE', sentimentScore: 32, keywords: ['중국', '철강', '화학'], relatedStocks: ['005490', '051910'] },
        { id: '5', title: '코스피 2,500선 공방... 외국인 순매수 지속', source: '뉴스1', url: '#', publishedAt: '1시간 전', sentiment: 'NEUTRAL', sentimentScore: 52, keywords: ['코스피', '외국인'], relatedStocks: [] },
        { id: '6', title: '카카오, 사업 재편 따른 불확실성 확대', source: '머니투데이', url: '#', publishedAt: '1시간 전', sentiment: 'NEGATIVE', sentimentScore: 28, keywords: ['카카오'], relatedStocks: ['035720'] },
        { id: '7', title: '네이버, 라인야후 지분 매각 검토설에 주가 급등', source: '파이낸셜뉴스', url: '#', publishedAt: '2시간 전', sentiment: 'POSITIVE', sentimentScore: 72, keywords: ['네이버', '라인'], relatedStocks: ['035420'] },
        { id: '8', title: '2차전지 업종 차익실현 매물 출회', source: '이데일리', url: '#', publishedAt: '2시간 전', sentiment: 'NEGATIVE', sentimentScore: 38, keywords: ['2차전지'], relatedStocks: ['373220', '006400'] },
    ];

    const filteredNews = selectedSentiment === 'all' 
        ? news 
        : news.filter(n => n.sentiment === selectedSentiment);

    const getSentimentIcon = (s: string) => {
        switch (s) {
            case 'POSITIVE': return <TrendingUp size={14} className="text-green-400" />;
            case 'NEGATIVE': return <TrendingDown size={14} className="text-red-400" />;
            default: return <Minus size={14} className="text-yellow-400" />;
        }
    };

    const getSentimentBg = (s: string) => {
        switch (s) {
            case 'POSITIVE': return 'bg-green-500/20 border-green-500/30';
            case 'NEGATIVE': return 'bg-red-500/20 border-red-500/30';
            default: return 'bg-yellow-500/20 border-yellow-500/30';
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Newspaper size={24} className="text-blue-400" />
                        뉴스 감성 분석
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">AI 기반 시장 뉴스 분석 및 심리 지수</p>
                </div>
                <button 
                    onClick={() => mutate()} 
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
                >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    새로고침
                </button>
            </div>

            {/* Sentiment Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Overall Score */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Gauge size={18} className="text-purple-400" />
                        <span className="text-sm font-medium text-white">시장 심리 지수</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${
                            sentiment.overallScore >= 60 ? 'bg-green-500/30 text-green-400' :
                            sentiment.overallScore >= 40 ? 'bg-yellow-500/30 text-yellow-400' :
                            'bg-red-500/30 text-red-400'
                        }`}>
                            {sentiment.overallScore}
                        </div>
                        <div>
                            <p className={`text-lg font-bold ${
                                sentiment.overallScore >= 60 ? 'text-green-400' :
                                sentiment.overallScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                            }`}>{sentiment.label}</p>
                            <p className="text-xs text-blue-200/70">최근 50건 분석</p>
                        </div>
                    </div>
                </div>

                {/* News Breakdown */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200 mb-2">긍정 뉴스</p>
                    <p className="text-2xl font-bold text-green-400">{sentiment.positiveNews}</p>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-2">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${sentiment.positiveNews / 50 * 100}%` }} />
                    </div>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200 mb-2">부정 뉴스</p>
                    <p className="text-2xl font-bold text-red-400">{sentiment.negativeNews}</p>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-2">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${sentiment.negativeNews / 50 * 100}%` }} />
                    </div>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200 mb-2">중립 뉴스</p>
                    <p className="text-2xl font-bold text-yellow-400">{sentiment.neutralNews}</p>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-2">
                        <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${sentiment.neutralNews / 50 * 100}%` }} />
                    </div>
                </div>
            </div>

            {/* Top Keywords */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Hash size={14} className="text-cyan-400" />
                    실시간 키워드
                </h3>
                <div className="flex flex-wrap gap-2">
                    {sentiment.topKeywords.map((keyword, i) => (
                        <span 
                            key={i}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-blue-200 rounded-full text-sm cursor-pointer transition-colors"
                        >
                            #{keyword}
                        </span>
                    ))}
                </div>
            </div>

            {/* News List */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Newspaper size={14} className="text-blue-400" />
                        최신 뉴스
                    </h3>
                    <div className="flex gap-2">
                        {['all', 'POSITIVE', 'NEGATIVE', 'NEUTRAL'].map(type => (
                            <button
                                key={type}
                                onClick={() => setSelectedSentiment(type)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedSentiment === type 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                }`}
                            >
                                {type === 'all' ? '전체' : type === 'POSITIVE' ? '긍정' : type === 'NEGATIVE' ? '부정' : '중립'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredNews.map(article => (
                        <div 
                            key={article.id}
                            className={`p-3 rounded-lg border ${getSentimentBg(article.sentiment)} hover:opacity-90 transition-opacity`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {getSentimentIcon(article.sentiment)}
                                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-white font-medium hover:underline flex items-center gap-1">
                                            {article.title}
                                            <ExternalLink size={10} className="text-blue-200/50" />
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-blue-200/70">
                                        <span className="flex items-center gap-1">
                                            <Building2 size={10} />
                                            {article.source}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={10} />
                                            {article.publishedAt}
                                        </span>
                                        {article.relatedStocks.length > 0 && (
                                            <span className="text-cyan-400">
                                                관련종목: {article.relatedStocks.join(', ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className={`text-lg font-bold ${
                                        article.sentimentScore >= 60 ? 'text-green-400' :
                                        article.sentimentScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                        {article.sentimentScore}
                                    </div>
                                    <div className="text-[10px] text-blue-200/50">점수</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
