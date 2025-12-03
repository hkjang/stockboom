'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Search, TrendingUp, Newspaper, Brain } from 'lucide-react';

type TabType = 'technical' | 'ai' | 'news';

export default function AnalysisPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('technical');
    const [stocks, setStocks] = useState<any[]>([]);
    const [selectedStock, setSelectedStock] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setStocks([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/stocks?search=${encodeURIComponent(searchQuery)}`, {
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                    }
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

    const handleStockSelect = (stock: any) => {
        setSelectedStock(stock);
        setSearchQuery('');
        setStocks([]);
    };

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">종목분석</h2>
                    <p className="text-blue-200">기술적 지표 및 AI 분석</p>
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
                            className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Search Results Dropdown */}
                    {searchQuery && (
                        <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-white/20 rounded-xl shadow-xl max-h-96 overflow-y-auto">
                            {isSearching ? (
                                <div className="p-4 text-center text-blue-300">검색 중...</div>
                            ) : stocks.length > 0 ? (
                                stocks.map((stock) => (
                                    <div
                                        key={stock.id}
                                        onClick={() => handleStockSelect(stock)}
                                        className="p-4 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-0"
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
                        <div className="mb-6 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold text-white">{selectedStock.name}</h3>
                                    <p className="text-blue-300">{selectedStock.symbol} · {selectedStock.market}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-white">
                                        {Number(selectedStock.currentPrice).toLocaleString()}원
                                    </p>
                                    <p className="text-sm text-gray-400">{selectedStock.sector}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="mb-6 flex gap-4">
                            <button
                                onClick={() => setActiveTab('technical')}
                                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition ${activeTab === 'technical'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white/10 text-blue-300 hover:bg-white/15'
                                    }`}
                            >
                                📈 기술적 분석
                            </button>
                            <button
                                onClick={() => setActiveTab('ai')}
                                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition ${activeTab === 'ai'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-white/10 text-purple-300 hover:bg-white/15'
                                    }`}
                            >
                                🧠 AI 분석
                            </button>
                            <button
                                onClick={() => setActiveTab('news')}
                                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition ${activeTab === 'news'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white/10 text-green-300 hover:bg-white/15'
                                    }`}
                            >
                                📰 뉴스 & 센티먼트
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
                            {activeTab === 'technical' && (
                                <div className="text-center">
                                    <div className="text-6xl mb-4">📊</div>
                                    <h3 className="text-2xl font-bold text-white mb-2">기술적 분석</h3>
                                    <p className="text-blue-300">RSI, MACD, 볼린저 밴드 등 기술적 지표 분석</p>
                                    <p className="text-gray-400 mt-4">데이터를 불러오는 중...</p>
                                </div>
                            )}
                            {activeTab === 'ai' && (
                                <div className="text-center">
                                    <div className="text-6xl mb-4">🤖</div>
                                    <h3 className="text-2xl font-bold text-white mb-2">AI 분석</h3>
                                    <p className="text-blue-300">인공지능 기반 종목 분석 및 투자 인사이트</p>
                                    <p className="text-gray-400 mt-4">AI 분석을 생성 중...</p>
                                </div>
                            )}
                            {activeTab === 'news' && (
                                <div className="text-center">
                                    <div className="text-6xl mb-4">📰</div>
                                    <h3 className="text-2xl font-bold text-white mb-2">뉴스 & 센티먼트</h3>
                                    <p className="text-blue-300">실시간 뉴스 분석 및 시장 감성 지표</p>
                                    <p className="text-gray-400 mt-4">뉴스를 수집 중...</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Feature Cards */}
                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <div
                                onClick={() => {
                                    // Feature cards are just for display when no stock selected
                                }}
                                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition"
                            >
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 bg-blue-600/20 rounded-full">
                                        <TrendingUp size={32} className="text-blue-400" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">기술적 분석</h3>
                                <p className="text-blue-300 text-sm">RSI, MACD, 볼린저 밴드 등 다양한 기술적 지표 분석</p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition">
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 bg-purple-600/20 rounded-full">
                                        <Brain size={32} className="text-purple-400" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">AI 분석</h3>
                                <p className="text-blue-300 text-sm">인공지능 기반 종목 분석 및 투자 인사이트</p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition">
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 bg-green-600/20 rounded-full">
                                        <Newspaper size={32} className="text-green-400" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">뉴스 & 센티먼트</h3>
                                <p className="text-blue-300 text-sm">실시간 뉴스 분석 및 시장 감성 지표</p>
                            </div>
                        </div>

                        {/* Placeholder Content */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
                            <div className="text-6xl mb-4">📊</div>
                            <h3 className="text-2xl font-bold text-white mb-2">종목을 검색하세요</h3>
                            <p className="text-blue-300">종목을 검색하면 상세한 분석 결과를 확인할 수 있습니다.</p>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
