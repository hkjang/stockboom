'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import TechnicalAnalysisTab from '@/components/analysis/TechnicalAnalysisTab';
import AIAnalysisTab from '@/components/analysis/AIAnalysisTab';
import NewsTab from '@/components/analysis/NewsTab';
import { Search, TrendingUp, Newspaper, Brain, RefreshCw, Star } from 'lucide-react';

type TabType = 'technical' | 'ai' | 'news';

interface Stock {
    id: string;
    symbol: string;
    name: string;
    currentPrice: number;
    market: string;
    sector?: string;
}

export default function AnalysisPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('technical');
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Data states
    const [technicalData, setTechnicalData] = useState<any>(null);
    const [aiData, setAiData] = useState<any>(null);
    const [newsData, setNewsData] = useState<any>(null);

    // Loading states
    const [loadingTechnical, setLoadingTechnical] = useState(false);
    const [loadingAi, setLoadingAi] = useState(false);
    const [loadingNews, setLoadingNews] = useState(false);

    // Error states
    const [technicalError, setTechnicalError] = useState<string | undefined>();
    const [aiError, setAiError] = useState<string | undefined>();
    const [newsError, setNewsError] = useState<string | undefined>();

    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return token ? `Bearer ${token}` : '';
    };

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setStocks([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/stocks?search=${encodeURIComponent(searchQuery)}`, {
                    headers: { 'Authorization': getAuthHeader() }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStocks(data);
                }
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch technical data
    const fetchTechnicalData = useCallback(async (stockId: string) => {
        setLoadingTechnical(true);
        setTechnicalError(undefined);
        try {
            const res = await fetch(`/api/analysis/${stockId}/technical`, {
                headers: { 'Authorization': getAuthHeader() }
            });
            if (res.ok) {
                const data = await res.json();
                setTechnicalData(data);
            } else {
                setTechnicalError('기술적 분석 데이터를 불러올 수 없습니다.');
            }
        } catch (error) {
            setTechnicalError('네트워크 오류가 발생했습니다.');
        } finally {
            setLoadingTechnical(false);
        }
    }, []);

    // Fetch AI data
    const fetchAiData = useCallback(async (stockId: string) => {
        setLoadingAi(true);
        setAiError(undefined);
        try {
            // Get AI reports
            const reportsRes = await fetch(`/api/ai/stocks/${stockId}/reports?limit=1`, {
                headers: { 'Authorization': getAuthHeader() }
            });

            // Get patterns
            const patternsRes = await fetch(`/api/ai/stocks/${stockId}/patterns`, {
                headers: { 'Authorization': getAuthHeader() }
            });

            // Get anomalies
            const anomaliesRes = await fetch(`/api/ai/stocks/${stockId}/anomalies`, {
                headers: { 'Authorization': getAuthHeader() }
            });

            const data: any = {};

            if (reportsRes.ok) {
                const reports = await reportsRes.json();
                if (reports.length > 0) {
                    data.report = {
                        recommendation: reports[0].recommendation,
                        riskScore: reports[0].riskScore,
                        confidence: reports[0].confidence,
                        summary: reports[0].summary,
                        createdAt: reports[0].createdAt,
                    };
                }
            }

            if (patternsRes.ok) {
                data.patterns = await patternsRes.json();
            }

            if (anomaliesRes.ok) {
                data.anomalies = await anomaliesRes.json();
            }

            setAiData(data);
        } catch (error) {
            setAiError('AI 분석 데이터를 불러올 수 없습니다.');
        } finally {
            setLoadingAi(false);
        }
    }, []);

    // Fetch news data
    const fetchNewsData = useCallback(async (stockId: string) => {
        setLoadingNews(true);
        setNewsError(undefined);
        try {
            const res = await fetch(`/api/ai/stocks/${stockId}/news-analysis?limit=10`, {
                headers: { 'Authorization': getAuthHeader() }
            });
            if (res.ok) {
                const data = await res.json();
                // Transform the data for NewsTab
                setNewsData({
                    overallSentiment: data.overallSentiment,
                    averageSentimentScore: data.averageSentimentScore,
                    newsCount: data.newsCount,
                    news: data.reports.map((r: any) => ({
                        id: r.id || Math.random().toString(),
                        title: r.title || 'News',
                        content: r.summary || r.content || '',
                        source: r.source || 'Unknown',
                        url: r.url,
                        publishedAt: r.publishedAt || r.createdAt || new Date().toISOString(),
                        sentiment: r.sentiment,
                        sentimentScore: r.sentimentScore,
                    }))
                });
            } else {
                setNewsError('뉴스 데이터를 불러올 수 없습니다.');
            }
        } catch (error) {
            setNewsError('네트워크 오류가 발생했습니다.');
        } finally {
            setLoadingNews(false);
        }
    }, []);

    // Load data when stock is selected
    useEffect(() => {
        if (selectedStock) {
            fetchTechnicalData(selectedStock.id);
            fetchAiData(selectedStock.id);
            fetchNewsData(selectedStock.id);
        }
    }, [selectedStock, fetchTechnicalData, fetchAiData, fetchNewsData]);

    const handleStockSelect = (stock: Stock) => {
        setSelectedStock(stock);
        setSearchQuery('');
        setStocks([]);
        // Reset data
        setTechnicalData(null);
        setAiData(null);
        setNewsData(null);
    };

    const handleRefresh = () => {
        if (selectedStock) {
            if (activeTab === 'technical') fetchTechnicalData(selectedStock.id);
            else if (activeTab === 'ai') fetchAiData(selectedStock.id);
            else if (activeTab === 'news') fetchNewsData(selectedStock.id);
        }
    };

    const handleGenerateAiReport = async () => {
        if (!selectedStock) return;
        setLoadingAi(true);
        try {
            const res = await fetch(`/api/ai/stocks/${selectedStock.id}/report`, {
                method: 'GET',
                headers: { 'Authorization': getAuthHeader() }
            });
            if (res.ok) {
                await fetchAiData(selectedStock.id);
            }
        } catch (error) {
            console.error('Failed to generate AI report:', error);
        } finally {
            setLoadingAi(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">종목분석</h2>
                    <p className="text-blue-200">기술적 지표, AI 분석, 뉴스 센티먼트</p>
                </div>

                {/* Search Bar */}
                <div className="mb-8 relative">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-300" size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="종목명 또는 종목코드로 검색..."
                            className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>

                    {/* Search Results Dropdown */}
                    {searchQuery && (
                        <div className="absolute z-10 w-full mt-2 bg-gray-800/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
                            {isSearching ? (
                                <div className="p-4 text-center text-blue-300">
                                    <div className="inline-block w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                                    검색 중...
                                </div>
                            ) : stocks.length > 0 ? (
                                stocks.map((stock) => (
                                    <div
                                        key={stock.id}
                                        onClick={() => handleStockSelect(stock)}
                                        className="p-4 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-0 transition-colors"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-white font-semibold">{stock.name}</p>
                                                <p className="text-blue-300 text-sm">{stock.symbol}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white font-bold">
                                                    {Number(stock.currentPrice).toLocaleString()}원
                                                </p>
                                                <p className="text-xs text-gray-400">{stock.market}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-gray-400">검색 결과가 없습니다.</div>
                            )}
                        </div>
                    )}
                </div>

                {selectedStock ? (
                    <>
                        {/* Selected Stock Info */}
                        <div className="mb-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                                        <Star className="w-5 h-5 text-yellow-400" />
                                    </button>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">{selectedStock.name}</h3>
                                        <p className="text-blue-300">{selectedStock.symbol} · {selectedStock.market}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-white">
                                        {Number(selectedStock.currentPrice).toLocaleString()}원
                                    </p>
                                    {selectedStock.sector && (
                                        <p className="text-sm text-gray-400">{selectedStock.sector}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="mb-6 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setActiveTab('technical')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold transition-all transform hover:scale-[1.02] ${activeTab === 'technical'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/30'
                                    : 'bg-white/10 text-blue-300 hover:bg-white/15'
                                    }`}
                            >
                                <TrendingUp size={20} />
                                기술적 분석
                            </button>
                            <button
                                onClick={() => setActiveTab('ai')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold transition-all transform hover:scale-[1.02] ${activeTab === 'ai'
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-600/30'
                                    : 'bg-white/10 text-purple-300 hover:bg-white/15'
                                    }`}
                            >
                                <Brain size={20} />
                                AI 분석
                            </button>
                            <button
                                onClick={() => setActiveTab('news')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold transition-all transform hover:scale-[1.02] ${activeTab === 'news'
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg shadow-green-600/30'
                                    : 'bg-white/10 text-green-300 hover:bg-white/15'
                                    }`}
                            >
                                <Newspaper size={20} />
                                뉴스 & 센티먼트
                            </button>
                        </div>

                        {/* Refresh Button */}
                        <div className="mb-6 flex justify-end">
                            <button
                                onClick={handleRefresh}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-blue-300 hover:bg-white/20 transition-colors"
                            >
                                <RefreshCw size={16} className={loadingTechnical || loadingAi || loadingNews ? 'animate-spin' : ''} />
                                새로고침
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 md:p-8 border border-white/10 min-h-[500px]">
                            {activeTab === 'technical' && (
                                <TechnicalAnalysisTab
                                    data={technicalData}
                                    isLoading={loadingTechnical}
                                    error={technicalError}
                                />
                            )}
                            {activeTab === 'ai' && (
                                <AIAnalysisTab
                                    data={aiData}
                                    isLoading={loadingAi}
                                    error={aiError}
                                    onGenerateReport={handleGenerateAiReport}
                                />
                            )}
                            {activeTab === 'news' && (
                                <NewsTab
                                    data={newsData}
                                    isLoading={loadingNews}
                                    error={newsError}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Feature Cards */}
                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 hover:scale-[1.02] transition-all">
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full shadow-lg shadow-blue-600/30">
                                        <TrendingUp size={32} className="text-white" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">기술적 분석</h3>
                                <p className="text-blue-300 text-sm">RSI, MACD, 볼린저 밴드, 스토캐스틱 등 다양한 기술적 지표</p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 hover:scale-[1.02] transition-all">
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full shadow-lg shadow-purple-600/30">
                                        <Brain size={32} className="text-white" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">AI 분석</h3>
                                <p className="text-blue-300 text-sm">인공지능 기반 패턴 감지, 이상 징후 탐지, 매매 추천</p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 hover:scale-[1.02] transition-all">
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 bg-gradient-to-br from-green-600 to-emerald-500 rounded-full shadow-lg shadow-green-600/30">
                                        <Newspaper size={32} className="text-white" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">뉴스 & 센티먼트</h3>
                                <p className="text-blue-300 text-sm">실시간 뉴스 분석 및 시장 감정 지표</p>
                            </div>
                        </div>

                        {/* Placeholder Content */}
                        <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
                            <div className="text-7xl mb-6">📊</div>
                            <h3 className="text-2xl font-bold text-white mb-3">종목을 검색하세요</h3>
                            <p className="text-blue-300 max-w-md mx-auto">
                                종목을 검색하면 기술적 분석, AI 분석, 뉴스 센티먼트 등 상세한 분석 결과를 확인할 수 있습니다.
                            </p>
                        </div>
                    </>
                )}
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </DashboardLayout>
    );
}
