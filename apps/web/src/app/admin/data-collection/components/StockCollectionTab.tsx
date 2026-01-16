'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Stock {
    id: string;
    symbol: string;
    name: string;
    corpCode: string;
    lastDataCollectionAt: string | null;
    missingData: {
        executives: boolean;
        majorShareholders: boolean;
        dividends: boolean;
        employees: boolean;
        auditOpinions: boolean;
        financialSummaries: boolean;
        insiderTradings: boolean;
        majorEvents: boolean;
    };
    counts: {
        executives: number;
        majorShareholders: number;
        dividends: number;
        employees: number;
        auditOpinions: number;
        financialSummaries: number;
        insiderTradings: number;
        majorEvents: number;
    };
    hasAnyMissing: boolean;
}

interface CollectionResult {
    stockId: string;
    stockName: string;
    symbol: string;
    success: boolean;
    totalCollected: number;
    collected: Record<string, { success: boolean; count: number; error?: string }>;
    errors: Array<{ task: string; error: string }>;
}

interface AutoCollectResult {
    success: boolean;
    message: string;
    bizYear: string;
    totalStocksWithMissingData: number;
    processed: number;
    successful: number;
    failed: number;
    totalCollected: number;
    results: CollectionResult[];
}

interface StockCollectionTabProps {
    onRefresh?: () => void;
}

export function StockCollectionTab({ onRefresh }: StockCollectionTabProps) {
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
    const [bizYear, setBizYear] = useState((new Date().getFullYear() - 1).toString());
    const [collecting, setCollecting] = useState(false);
    const [autoCollecting, setAutoCollecting] = useState(false);
    const [results, setResults] = useState<CollectionResult[]>([]);
    const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number } | null>(null);
    const [autoCollectLimit, setAutoCollectLimit] = useState(10);
    const [autoCollectResult, setAutoCollectResult] = useState<AutoCollectResult | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    useEffect(() => {
        fetchStocksWithMissingData();
    }, []);

    const fetchStocksWithMissingData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/data-collection/missing', {
                headers: getAuthHeader(),
            });
            if (res.ok) {
                const data = await res.json();
                setStocks(data);
            }
        } catch (error) {
            console.error('Failed to fetch stocks:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectStock = (stockId: string) => {
        setSelectedStocks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(stockId)) {
                newSet.delete(stockId);
            } else {
                newSet.add(stockId);
            }
            return newSet;
        });
    };

    const selectAll = () => {
        setSelectedStocks(new Set(stocks.map(s => s.id)));
    };

    const deselectAll = () => {
        setSelectedStocks(new Set());
    };

    const collectSingleStock = async (stockId: string) => {
        setCollecting(true);
        setCurrentProgress({ current: 0, total: 1 });
        try {
            const res = await fetch(`/api/admin/stocks/${stockId}/collect-all`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ bizYear }),
            });

            if (res.ok) {
                const result = await res.json();
                setResults([result]);
                await fetchStocksWithMissingData();
            }
        } catch (error) {
            console.error('Collection failed:', error);
        } finally {
            setCollecting(false);
            setCurrentProgress(null);
        }
    };

    const collectSelectedStocks = async () => {
        if (selectedStocks.size === 0) {
            alert('수집할 종목을 선택해주세요.');
            return;
        }

        setCollecting(true);
        setResults([]);
        const stockIds = Array.from(selectedStocks);
        setCurrentProgress({ current: 0, total: stockIds.length });

        const collectedResults: CollectionResult[] = [];

        for (let i = 0; i < stockIds.length; i++) {
            const stockId = stockIds[i];
            setCurrentProgress({ current: i + 1, total: stockIds.length });

            try {
                const res = await fetch(`/api/admin/stocks/${stockId}/collect-all`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                    },
                    body: JSON.stringify({ bizYear }),
                });

                if (res.ok) {
                    const result = await res.json();
                    collectedResults.push(result);
                    setResults([...collectedResults]);
                }
            } catch (error) {
                console.error(`Collection failed for ${stockId}:`, error);
            }
        }

        setCollecting(false);
        setCurrentProgress(null);
        await fetchStocksWithMissingData();
        setSelectedStocks(new Set());
    };

    const autoCollect = async () => {
        setAutoCollecting(true);
        setAutoCollectResult(null);
        setResults([]);
        try {
            const res = await fetch('/api/admin/data-collection/auto-collect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ bizYear, limit: autoCollectLimit }),
            });
            if (res.ok) {
                const result = await res.json();
                setAutoCollectResult(result);
                setResults(result.results || []);
                await fetchStocksWithMissingData();
            } else {
                alert('자동 수집 실패');
            }
        } catch (error) {
            console.error('Auto collect failed:', error);
            alert('자동 수집 중 오류가 발생했습니다');
        } finally {
            setAutoCollecting(false);
        }
    };

    const getStatusBadge = (hasData: boolean, count: number) => {
        if (hasData && count > 0) {
            return (
                <div className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full" />
                    <span className="text-xs text-green-400">{count}</span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 bg-gray-600 rounded-full" />
                <span className="text-xs text-gray-500">-</span>
            </div>
        );
    };

    const formatLastCollection = (dateStr: string | null) => {
        if (!dateStr) return <span className="text-gray-500 text-xs">미수집</span>;
        try {
            const date = new Date(dateStr);
            return (
                <span className="text-blue-300 text-xs">
                    {formatDistanceToNow(date, { addSuffix: true, locale: ko })}
                </span>
            );
        } catch {
            return <span className="text-gray-500 text-xs">-</span>;
        }
    };

    const getTotalCount = (counts: Stock['counts']) => {
        return Object.values(counts).reduce((sum, c) => sum + c, 0);
    };

    const dataTypes = [
        { key: 'executives', label: '임원', icon: '👔' },
        { key: 'majorShareholders', label: '주주', icon: '📊' },
        { key: 'dividends', label: '배당', icon: '💰' },
        { key: 'employees', label: '직원', icon: '👥' },
        { key: 'auditOpinions', label: '감사', icon: '📋' },
        { key: 'financialSummaries', label: '재무', icon: '📈' },
        { key: 'insiderTradings', label: '내부자', icon: '🔒' },
        { key: 'majorEvents', label: '이벤트', icon: '⚡' },
    ];

    // Filter stocks by search query
    const filteredStocks = stocks.filter(stock =>
        searchQuery === '' ||
        stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.corpCode?.includes(searchQuery)
    );

    return (
        <div className="space-y-4">
            {/* Search and Controls */}
            <div className="flex items-center justify-between">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="종목명 또는 코드 검색..."
                    className="px-4 py-2 w-72 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
                <div className="text-sm text-gray-400">
                    미수집 {stocks.length}개 | 선택 {selectedStocks.size}개
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/30 p-4">
                    <div className="text-sm text-blue-300">미수집 종목</div>
                    <div className="text-3xl font-bold text-white mt-1">{stocks.length}</div>
                </Card>
                <Card className="bg-gradient-to-br from-green-600/20 to-green-800/20 border-green-500/30 p-4">
                    <div className="text-sm text-green-300">선택된 종목</div>
                    <div className="text-3xl font-bold text-white mt-1">{selectedStocks.size}</div>
                </Card>
                <Card className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border-purple-500/30 p-4">
                    <div className="text-sm text-purple-300">수집 연도</div>
                    <div className="text-3xl font-bold text-white mt-1">{bizYear}</div>
                </Card>
                <Card className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border-orange-500/30 p-4">
                    <div className="text-sm text-orange-300">자동 수집 한도</div>
                    <div className="text-3xl font-bold text-white mt-1">{autoCollectLimit}개</div>
                </Card>
            </div>

            {/* Controls */}
            <Card className="bg-gray-800/50 border-gray-700 p-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5 font-medium">사업연도</label>
                        <select
                            value={bizYear}
                            onChange={(e) => setBizYear(e.target.value)}
                            className="px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-sm"
                        >
                            {[...Array(5)].map((_, i) => {
                                const year = new Date().getFullYear() - i;
                                return <option key={year} value={year}>{year}년</option>;
                            })}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1.5 font-medium">자동 수집 수량</label>
                        <select
                            value={autoCollectLimit}
                            onChange={(e) => setAutoCollectLimit(Number(e.target.value))}
                            className="px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-sm"
                        >
                            {[5, 10, 20, 50, 100].map(n => (
                                <option key={n} value={n}>{n}개</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1" />

                    <button
                        onClick={autoCollect}
                        disabled={autoCollecting || collecting}
                        className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-green-600/20"
                    >
                        {autoCollecting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                자동 수집 중...
                            </>
                        ) : (
                            <>⚡ 자동 수집 시작</>
                        )}
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={selectAll}
                            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                        >
                            전체 선택
                        </button>
                        <button
                            onClick={deselectAll}
                            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                        >
                            선택 해제
                        </button>
                        <button
                            onClick={collectSelectedStocks}
                            disabled={collecting || autoCollecting || selectedStocks.size === 0}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-600/20"
                        >
                            {collecting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    수집 중 ({currentProgress?.current}/{currentProgress?.total})
                                </>
                            ) : (
                                <>🚀 선택 수집</>
                            )}
                        </button>
                    </div>
                </div>
            </Card>

            {/* Auto Collect Result Summary */}
            {autoCollectResult && (
                <Card className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-500/30 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        ⚡ 자동 수집 결과 요약
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">{autoCollectResult.processed}</div>
                            <div className="text-xs text-gray-400">처리된 종목</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-400">{autoCollectResult.successful}</div>
                            <div className="text-xs text-gray-400">성공</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-400">{autoCollectResult.failed}</div>
                            <div className="text-xs text-gray-400">실패</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-400">{autoCollectResult.totalCollected}</div>
                            <div className="text-xs text-gray-400">수집된 데이터</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-400">{autoCollectResult.totalStocksWithMissingData}</div>
                            <div className="text-xs text-gray-400">남은 종목</div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Progress Bar */}
            {(collecting || autoCollecting) && currentProgress && (
                <Card className="bg-gray-800/50 border-gray-700 p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                    style={{ width: `${(currentProgress.current / currentProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-white text-sm font-medium">
                            {currentProgress.current}/{currentProgress.total}
                        </span>
                    </div>
                </Card>
            )}

            {/* Results */}
            {results.length > 0 && (
                <Card className="bg-gray-800/50 border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">✅ 수집 결과 상세</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {results.map((result, idx) => (
                            <div
                                key={result.stockId || idx}
                                className={`p-3 rounded-lg flex items-center justify-between ${result.success ? 'bg-green-900/20 border border-green-500/20' : 'bg-red-900/20 border border-red-500/20'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${result.success ? 'bg-green-600' : 'bg-red-600'}`}>
                                        {result.success ? '✓' : '✗'}
                                    </span>
                                    <div>
                                        <span className="text-white font-medium">{result.stockName}</span>
                                        <span className="text-gray-400 text-sm ml-2">({result.symbol})</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                                        {result.totalCollected}건
                                    </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                </Card>
            )}

            {/* Stock List */}
            <Card className="bg-gray-800/50 border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">
                            📋 수집 대상 종목
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">24시간 이내 수집 시도한 종목은 제외됩니다</p>
                    </div>
                    <button
                        onClick={fetchStocksWithMissingData}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    >
                        🔄 새로고침
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                ) : filteredStocks.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <div className="text-5xl mb-4">🎉</div>
                        <div className="text-xl font-medium text-white mb-2">모든 종목 수집 완료!</div>
                        <p className="text-sm">24시간 후에 다시 확인해주세요</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="px-3 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedStocks.size === filteredStocks.length && filteredStocks.length > 0}
                                            onChange={() => selectedStocks.size === filteredStocks.length ? deselectAll() : selectAll()}
                                            className="rounded bg-gray-800 border-gray-600"
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-left text-gray-400 font-medium">종목명</th>
                                    <th className="px-3 py-3 text-left text-gray-400 font-medium">코드</th>
                                    <th className="px-3 py-3 text-center text-gray-400 font-medium">마지막 수집</th>
                                    <th className="px-3 py-3 text-center text-gray-400 font-medium">총 데이터</th>
                                    {dataTypes.map(dt => (
                                        <th key={dt.key} className="px-2 py-3 text-center text-gray-400 text-xs font-medium">
                                            <span title={dt.label}>{dt.icon}</span>
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-center text-gray-400 font-medium">작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStocks.map((stock) => (
                                    <tr
                                        key={stock.id}
                                        className={`border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors ${selectedStocks.has(stock.id) ? 'bg-purple-900/20' : ''}`}
                                    >
                                        <td className="px-3 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedStocks.has(stock.id)}
                                                onChange={() => toggleSelectStock(stock.id)}
                                                className="rounded bg-gray-800 border-gray-600"
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-white font-medium">{stock.name}</span>
                                        </td>
                                        <td className="px-3 py-3 text-gray-400 font-mono text-xs">{stock.symbol}</td>
                                        <td className="px-3 py-3 text-center">
                                            {formatLastCollection(stock.lastDataCollectionAt)}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <span className="inline-flex items-center justify-center w-8 h-6 bg-gray-700 rounded text-xs text-white font-medium">
                                                {getTotalCount(stock.counts)}
                                            </span>
                                        </td>
                                        {dataTypes.map(dt => (
                                            <td key={dt.key} className="px-2 py-3 text-center">
                                                {getStatusBadge(!stock.missingData[dt.key as keyof typeof stock.missingData], stock.counts[dt.key as keyof typeof stock.counts])}
                                            </td>
                                        ))}
                                        <td className="px-3 py-3 text-center">
                                            <button
                                                onClick={() => collectSingleStock(stock.id)}
                                                disabled={collecting || autoCollecting}
                                                className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded text-xs disabled:opacity-50 transition-colors"
                                            >
                                                수집
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400">
                <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full" /> 데이터 수집됨
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-gray-600 rounded-full" /> 미수집
                </span>
                <span className="text-purple-300">💡 자동 수집: 미수집 종목을 자동으로 순차 수집합니다</span>
            </div>
        </div>
    );
}
