'use client';

import { useState } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink, Clock, MessageSquare } from 'lucide-react';

interface NewsItem {
    id: string;
    title: string;
    content: string;
    source: string;
    url?: string;
    publishedAt: string;
    sentiment?: string;
    sentimentScore?: number;
}

interface NewsSentimentData {
    overallSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    averageSentimentScore: number;
    newsCount: number;
    news: NewsItem[];
}

interface NewsTabProps {
    data: NewsSentimentData | null;
    isLoading: boolean;
    error?: string;
}

// Sentiment Gauge
function SentimentGauge({ score, label }: { score: number; label: string }) {
    const getColor = () => {
        if (score > 20) return 'from-green-500 to-emerald-500';
        if (score < -20) return 'from-red-500 to-rose-500';
        return 'from-yellow-500 to-amber-500';
    };

    const getTextColor = () => {
        if (score > 20) return 'text-green-400';
        if (score < -20) return 'text-red-400';
        return 'text-yellow-400';
    };

    const normalizedScore = ((score + 100) / 200) * 100;

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${getColor()}`}>
                    {score > 20 ? (
                        <TrendingUp className="w-5 h-5 text-white" />
                    ) : score < -20 ? (
                        <TrendingDown className="w-5 h-5 text-white" />
                    ) : (
                        <Minus className="w-5 h-5 text-white" />
                    )}
                </div>
                <span className="text-blue-200 font-medium">전체 감정 분석</span>
            </div>

            <div className="flex items-center gap-4 mb-4">
                <div className={`text-4xl font-bold ${getTextColor()}`}>
                    {score > 0 ? '+' : ''}{score.toFixed(1)}
                </div>
                <div className={`px-4 py-2 rounded-full font-semibold ${score > 20 ? 'bg-green-500/20 text-green-400' :
                    score < -20 ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                    }`}>
                    {label === 'POSITIVE' ? '긍정적' : label === 'NEGATIVE' ? '부정적' : '중립'}
                </div>
            </div>

            <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
                <div className="absolute inset-0 flex">
                    <div className="w-1/3 bg-gradient-to-r from-red-500/30 to-red-500/20"></div>
                    <div className="w-1/3 bg-yellow-500/20"></div>
                    <div className="w-1/3 bg-gradient-to-r from-green-500/20 to-green-500/30"></div>
                </div>
                <div
                    className="absolute w-3 h-3 bg-white rounded-full top-0.5 shadow-lg transition-all duration-500"
                    style={{ left: `calc(${normalizedScore}% - 6px)` }}
                ></div>
            </div>

            <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>부정 (-100)</span>
                <span>중립 (0)</span>
                <span>긍정 (+100)</span>
            </div>
        </div>
    );
}

// News Card
function NewsCard({ news }: { news: NewsItem }) {
    const [expanded, setExpanded] = useState(false);

    const getSentimentStyle = () => {
        if (!news.sentiment) return 'border-gray-500/30';
        switch (news.sentiment) {
            case 'POSITIVE':
                return 'border-green-500/30 bg-green-500/5';
            case 'NEGATIVE':
                return 'border-red-500/30 bg-red-500/5';
            default:
                return 'border-yellow-500/30 bg-yellow-500/5';
        }
    };

    const getSentimentIcon = () => {
        if (!news.sentiment) return null;
        switch (news.sentiment) {
            case 'POSITIVE':
                return <TrendingUp className="w-4 h-4 text-green-400" />;
            case 'NEGATIVE':
                return <TrendingDown className="w-4 h-4 text-red-400" />;
            default:
                return <Minus className="w-4 h-4 text-yellow-400" />;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return '방금 전';
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        return date.toLocaleDateString('ko-KR');
    };

    return (
        <div className={`rounded-xl p-5 border transition-all hover:scale-[1.01] ${getSentimentStyle()}`}>
            <div className="flex items-start justify-between gap-4 mb-3">
                <h4 className="font-semibold text-white leading-tight flex-1">{news.title}</h4>
                {news.sentiment && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${news.sentiment === 'POSITIVE' ? 'bg-green-500/20 text-green-400' :
                        news.sentiment === 'NEGATIVE' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                        {getSentimentIcon()}
                        <span>
                            {news.sentiment === 'POSITIVE' ? '긍정' :
                                news.sentiment === 'NEGATIVE' ? '부정' : '중립'}
                        </span>
                        {news.sentimentScore !== undefined && (
                            <span className="ml-1">({news.sentimentScore > 0 ? '+' : ''}{news.sentimentScore})</span>
                        )}
                    </div>
                )}
            </div>

            <p className={`text-sm text-gray-400 mb-4 ${expanded ? '' : 'line-clamp-2'}`}>
                {news.content}
            </p>

            {news.content.length > 150 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-sm text-blue-400 hover:text-blue-300 mb-3"
                >
                    {expanded ? '접기' : '더 보기'}
                </button>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <Newspaper className="w-3 h-3" />
                        {news.source}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(news.publishedAt)}
                    </span>
                </div>
                {news.url && (
                    <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    >
                        원문 보기
                        <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </div>
        </div>
    );
}

export default function NewsTab({ data, isLoading, error }: NewsTabProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
                    <Newspaper className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-green-400" />
                </div>
                <p className="text-green-300 mt-6">뉴스를 수집하는 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-white mb-2">뉴스 로드 실패</h3>
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    if (!data || data.news.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="text-6xl mb-4">📰</div>
                <h3 className="text-xl font-bold text-white mb-2">관련 뉴스가 없습니다</h3>
                <p className="text-gray-400">이 종목에 대한 최근 뉴스가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Sentiment Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <SentimentGauge
                        score={data.averageSentimentScore}
                        label={data.overallSentiment}
                    />
                </div>
                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-blue-200 font-medium">분석 뉴스 수</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{data.newsCount}</div>
                    <p className="text-sm text-gray-400 mt-2">최근 뉴스 기사</p>
                </div>
            </div>

            {/* News Feed */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Newspaper className="w-5 h-5" />
                    관련 뉴스
                </h3>
                <div className="space-y-4">
                    {data.news.map((news) => (
                        <NewsCard key={news.id} news={news} />
                    ))}
                </div>
            </div>

            {/* Sentiment Distribution */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">감정 분포</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                        <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-400">
                            {data.news.filter(n => n.sentiment === 'POSITIVE').length}
                        </div>
                        <div className="text-sm text-gray-400">긍정적</div>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                        <Minus className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-yellow-400">
                            {data.news.filter(n => n.sentiment === 'NEUTRAL').length}
                        </div>
                        <div className="text-sm text-gray-400">중립</div>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                        <TrendingDown className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-red-400">
                            {data.news.filter(n => n.sentiment === 'NEGATIVE').length}
                        </div>
                        <div className="text-sm text-gray-400">부정적</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
