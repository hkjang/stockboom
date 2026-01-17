'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { HelpTooltip, HelpModal, HelpButton, pageHelpContent } from '@/components/ui/HelpTooltip';
import { TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

export default function TradesPage() {
    const [loading, setLoading] = useState(true);
    const [trades, setTrades] = useState<any[]>([]);
    const [statistics, setStatistics] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('ALL');
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        fetchTrades();
        fetchStatistics();
    }, [page, filter]);

    const fetchTrades = async () => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...(filter !== 'ALL' && { status: filter }),
            });

            const res = await fetch(`/api/trades?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setTrades(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to fetch trades:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStatistics = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/trades/statistics', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setStatistics(data);
            }
        } catch (error) {
            console.error('Failed to fetch statistics:', error);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'FILLED':
                return <CheckCircle size={16} className="text-green-400" />;
            case 'PENDING':
                return <Clock size={16} className="text-yellow-400" />;
            case 'CANCELLED':
                return <XCircle size={16} className="text-red-400" />;
            case 'REJECTED':
                return <AlertCircle size={16} className="text-red-400" />;
            default:
                return null;
        }
    };

    const getStatusText = (status: string) => {
        const statusMap: { [key: string]: string } = {
            'PENDING': '대기중',
            'FILLED': '체결완료',
            'PARTIALLY_FILLED': '부분체결',
            'CANCELLED': '취소됨',
            'REJECTED': '거부됨',
        };
        return statusMap[status] || status;
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
            {/* Help Modal */}
            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                title={pageHelpContent.trades.title}
                sections={pageHelpContent.trades.sections}
            />

            <div className="container mx-auto px-6 py-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            거래내역
                            <HelpTooltip term="pnl" position="right">
                                <HelpCircle size={18} className="text-gray-400" />
                            </HelpTooltip>
                        </h2>
                        <p className="text-blue-200">매매 기록 및 거래 현황</p>
                    </div>
                    <HelpButton onClick={() => setShowHelp(true)} />
                </div>

                {/* Statistics Cards */}
                {statistics && (
                    <div className="grid md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                            <div className="text-blue-300 text-sm mb-1">총 거래</div>
                            <div className="text-3xl font-bold text-white">{statistics.totalTrades || 0}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                            <div className="text-blue-300 text-sm mb-1 flex items-center gap-1">
                                승률
                                <HelpTooltip term="winRate" position="bottom">
                                    <HelpCircle size={12} className="text-gray-500" />
                                </HelpTooltip>
                            </div>
                            <div className="text-3xl font-bold text-green-400">{statistics.winRate || 0}%</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                            <div className="text-blue-300 text-sm mb-1">총 수익</div>
                            <div className="text-3xl font-bold text-white">₩{Number(statistics.totalProfit || 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                            <div className="text-blue-300 text-sm mb-1">평균 수익률</div>
                            <div className="text-3xl font-bold text-blue-400">{statistics.avgReturn || 0}%</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="mb-6 flex gap-3">
                    {['ALL', 'PENDING', 'FILLED', 'CANCELLED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg transition ${filter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                }`}
                        >
                            {status === 'ALL' ? '전체' : getStatusText(status)}
                        </button>
                    ))}
                </div>

                {/* Trades Table */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                    {trades.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-6xl mb-4">📊</div>
                            <h3 className="text-2xl font-bold text-white mb-2">거래 내역이 없습니다</h3>
                            <p className="text-blue-300">거래를 시작하면 여기에 표시됩니다.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-blue-300 text-sm font-semibold">날짜</th>
                                        <th className="px-6 py-4 text-left text-blue-300 text-sm font-semibold">종목</th>
                                        <th className="px-6 py-4 text-left text-blue-300 text-sm font-semibold">구분</th>
                                        <th className="px-6 py-4 text-right text-blue-300 text-sm font-semibold">수량</th>
                                        <th className="px-6 py-4 text-right text-blue-300 text-sm font-semibold">가격</th>
                                        <th className="px-6 py-4 text-right text-blue-300 text-sm font-semibold">금액</th>
                                        <th className="px-6 py-4 text-center text-blue-300 text-sm font-semibold">상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trades.map((trade) => (
                                        <tr key={trade.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                            <td className="px-6 py-4 text-white text-sm">
                                                {new Date(trade.createdAt).toLocaleDateString('ko-KR')}
                                            </td>
                                            <td className="px-6 py-4 text-white font-semibold">
                                                {trade.stock?.name || trade.stockId}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${trade.orderSide === 'BUY'
                                                        ? 'bg-blue-600/20 text-blue-400'
                                                        : 'bg-red-600/20 text-red-400'
                                                    }`}>
                                                    {trade.orderSide === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                    {trade.orderSide === 'BUY' ? '매수' : '매도'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-white text-right">
                                                {trade.quantity?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-white text-right">
                                                ₩{Number(trade.avgFillPrice || trade.limitPrice || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-white text-right font-semibold">
                                                ₩{Number(trade.totalAmount || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    {getStatusIcon(trade.status)}
                                                    <span className="text-sm text-white">{getStatusText(trade.status)}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {trades.length > 0 && (
                    <div className="mt-6 flex justify-center gap-2">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            이전
                        </button>
                        <span className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                            {page}
                        </span>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={trades.length < 20}
                            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            다음
                        </button>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
