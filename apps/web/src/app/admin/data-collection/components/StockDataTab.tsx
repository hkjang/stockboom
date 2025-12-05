'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';

interface StockDataTabProps {
    onRefresh: () => void;
}

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

export function StockDataTab({ onRefresh }: StockDataTabProps) {
    const [loading, setLoading] = useState(false);
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [selectedMarket, setSelectedMarket] = useState('KOSPI');
    const [timeframe, setTimeframe] = useState('1d');
    const [bulkSymbols, setBulkSymbols] = useState('');
    const [collectAllInProgress, setCollectAllInProgress] = useState(false);
    const { showToast } = useToast();

    // Fetch stocks for autocomplete
    const { data: stocksData } = useSWR('/api/admin/stocks?take=1000', fetcher);

    const getAuthHeader = (): Record<string, string> => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    const handleUpdatePrice = async () => {
        if (!selectedSymbol.trim()) {
            showToast('종목 코드를 입력해주세요', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/data-collection/stocks/price', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ symbol: selectedSymbol, market: selectedMarket }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || '가격 업데이트 완료', 'success');
                onRefresh();
            } else {
                throw new Error(data.error || '업데이트 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectCandles = async () => {
        if (!selectedSymbol.trim()) {
            showToast('종목 코드를 입력해주세요', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/data-collection/stocks/candles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({
                    symbol: selectedSymbol,
                    market: selectedMarket,
                    timeframe
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(`${data.count}개 캔들 데이터 수집됨`, 'success');
                onRefresh();
            } else {
                throw new Error(data.error || '수집 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkCollect = async () => {
        const symbols = bulkSymbols.split(/[,\s\n]+/).filter(s => s.trim());
        if (symbols.length === 0) {
            showToast('종목 코드를 입력해주세요', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/data-collection/bulk-collect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ symbols, timeframe, market: selectedMarket }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                const msg = `${data.totalQueued}개 종목이 대기열에 등록됨${data.totalFailed > 0 ? `, ${data.totalFailed}개 실패` : ''}`;
                showToast(msg, data.totalFailed > 0 ? 'warning' : 'success');
                setBulkSymbols('');
                onRefresh();
            } else {
                throw new Error(data.error || '등록 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectAll = async () => {
        if (!confirm('모든 활성 종목의 데이터를 수집하시겠습니까? 이 작업은 시간이 오래 걸릴 수 있습니다.')) {
            return;
        }

        setCollectAllInProgress(true);
        try {
            const res = await fetch('/api/admin/data-collection/collect-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ timeframe }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || '전체 수집 시작됨', 'success');
                onRefresh();
            } else {
                throw new Error(data.error || '시작 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setCollectAllInProgress(false);
        }
    };

    const timeframes = [
        { value: '1d', label: '일봉' },
        { value: '1w', label: '주봉' },
        { value: '1h', label: '1시간' },
        { value: '5m', label: '5분' },
    ];

    const markets = [
        { value: 'KOSPI', label: 'KOSPI' },
        { value: 'KOSDAQ', label: 'KOSDAQ' },
        { value: 'KONEX', label: 'KONEX' },
    ];

    return (
        <div className="space-y-6">
            {/* Individual Stock Collection */}
            <Card className="bg-gray-800/50 border-gray-700">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-indigo-500/20">
                            <ChartIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">개별 종목 수집</h3>
                            <p className="text-sm text-gray-400">특정 종목의 가격 및 캔들 데이터를 수집합니다</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">종목 코드</label>
                            <input
                                type="text"
                                placeholder="예: 005930"
                                value={selectedSymbol}
                                onChange={(e) => setSelectedSymbol(e.target.value)}
                                list="stock-list"
                                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                disabled={loading}
                            />
                            <datalist id="stock-list">
                                {stocksData?.stocks?.slice(0, 50).map((stock: any) => (
                                    <option key={stock.id} value={stock.symbol}>
                                        {stock.name}
                                    </option>
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">시장</label>
                            <select
                                value={selectedMarket}
                                onChange={(e) => setSelectedMarket(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                disabled={loading}
                            >
                                {markets.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleUpdatePrice}
                        disabled={loading || !selectedSymbol.trim()}
                        className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        💰 가격 업데이트
                    </button>

                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <label className="block text-sm font-medium text-gray-300 mb-2">캔들 타임프레임</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {timeframes.map(tf => (
                                <button
                                    key={tf.value}
                                    onClick={() => setTimeframe(tf.value)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${timeframe === tf.value
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                                        }`}
                                >
                                    {tf.label}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleCollectCandles}
                            disabled={loading || !selectedSymbol.trim()}
                            className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            📊 캔들 데이터 수집 ({timeframes.find(t => t.value === timeframe)?.label})
                        </button>
                    </div>
                </div>
            </Card>

            {/* Bulk Collection */}
            <Card className="bg-gray-800/50 border-gray-700">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                            <BulkIcon className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">일괄 수집</h3>
                            <p className="text-sm text-gray-400">여러 종목을 한 번에 수집 대기열에 등록합니다</p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            종목 코드 (쉼표, 공백, 줄바꿈으로 구분)
                        </label>
                        <textarea
                            placeholder="005930, 000660, 035720&#10;또는 한 줄에 하나씩 입력"
                            value={bulkSymbols}
                            onChange={(e) => setBulkSymbols(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none font-mono text-sm"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleBulkCollect}
                            disabled={loading || !bulkSymbols.trim()}
                            className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <Spinner /> : null}
                            📋 선택 종목 일괄 수집
                        </button>
                        <button
                            onClick={handleCollectAll}
                            disabled={collectAllInProgress}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {collectAllInProgress ? <Spinner /> : null}
                            🚀 전체 종목 수집
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// Components
function Spinner() {
    return <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}

function ChartIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
    );
}

function BulkIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
    );
}
