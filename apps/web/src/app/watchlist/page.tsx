'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Star, Trash2, RefreshCw, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface WatchlistItem {
    id: string;
    stockId: string;
    note: string | null;
    createdAt: string;
    stock: {
        id: string;
        symbol: string;
        name: string;
        currentPrice: number | null;
        openPrice: number | null;
        market: string;
        sector: string | null;
    };
}

export default function WatchlistPage() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return { 'Authorization': `Bearer ${token}` };
    };

    const fetchWatchlist = async () => {
        try {
            const res = await fetch('/api/watchlist', {
                headers: getAuthHeader(),
            });
            if (res.ok) {
                const data = await res.json();
                setWatchlist(data);
            }
        } catch (error) {
            console.error('Failed to fetch watchlist:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRemove = async (stockId: string) => {
        if (!confirm('관심종목에서 삭제하시겠습니까?')) return;

        try {
            await fetch(`/api/watchlist/${stockId}`, {
                method: 'DELETE',
                headers: getAuthHeader(),
            });
            setWatchlist(prev => prev.filter(item => item.stockId !== stockId));
        } catch (error) {
            console.error('Failed to remove from watchlist:', error);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchWatchlist();
    };

    useEffect(() => {
        fetchWatchlist();
    }, []);

    const calculateChange = (current: number | null, open: number | null) => {
        if (!current || !open || open === 0) return null;
        return ((current - open) / open) * 100;
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="text-white text-xl">Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Star className="text-yellow-400" fill="currentColor" />
                            관심종목
                        </h2>
                        <p className="text-blue-200">자주 보는 종목을 관리합니다</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                            새로고침
                        </button>
                        <Link
                            href="/analysis"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            <Star size={18} />
                            종목 추가
                        </Link>
                    </div>
                </div>

                {/* Watchlist Table */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                    {watchlist.length === 0 ? (
                        <div className="text-center py-16">
                            <Star size={48} className="mx-auto mb-4 text-blue-300/50" />
                            <p className="text-blue-200 mb-4">관심종목이 없습니다</p>
                            <p className="text-blue-300/70 text-sm mb-6">
                                종목 분석 페이지에서 ⭐ 버튼을 클릭하여 관심종목을 추가하세요
                            </p>
                            <Link
                                href="/analysis"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                <Star size={20} />
                                종목 찾기
                            </Link>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/10">
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">종목</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-blue-200">현재가</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-blue-200">등락률</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">시장</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">메모</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-200">액션</th>
                                </tr>
                            </thead>
                            <tbody>
                                {watchlist.map((item) => {
                                    const change = calculateChange(item.stock.currentPrice, item.stock.openPrice);
                                    const isPositive = change !== null && change >= 0;

                                    return (
                                        <tr
                                            key={item.id}
                                            className="border-b border-white/5 hover:bg-white/5 transition"
                                        >
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={`/analysis?stock=${item.stock.id}`}
                                                    className="flex items-center gap-3 hover:text-blue-400 transition"
                                                >
                                                    <div>
                                                        <p className="text-white font-semibold">{item.stock.name}</p>
                                                        <p className="text-blue-300/70 text-sm">{item.stock.symbol}</p>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-white font-semibold">
                                                    ₩{item.stock.currentPrice?.toLocaleString() ?? '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {change !== null ? (
                                                    <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                        {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                                        <span className="font-semibold">
                                                            {isPositive ? '+' : ''}{change.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-blue-300/50">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-sm">
                                                    {item.stock.market}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-blue-200 text-sm">
                                                    {item.note || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Link
                                                        href={`/analysis?stock=${item.stock.id}`}
                                                        className="p-2 text-blue-400 hover:bg-blue-600/20 rounded-lg transition"
                                                        title="분석 보기"
                                                    >
                                                        <ExternalLink size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleRemove(item.stockId)}
                                                        className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Summary Stats */}
                {watchlist.length > 0 && (
                    <div className="mt-6 flex items-center gap-2 text-blue-300 text-sm">
                        <Star size={14} className="text-yellow-400" fill="currentColor" />
                        <span>총 {watchlist.length}개 종목</span>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
