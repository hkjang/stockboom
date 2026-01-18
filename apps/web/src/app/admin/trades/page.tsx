'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';
import { Activity, TrendingUp, TrendingDown, RefreshCw, User, Clock, Filter, AlertTriangle } from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

export default function AdminTrades() {
    const { data: trades, mutate, isLoading } = useSWR('/api/admin/trades?limit=100', fetcher);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    const filteredTrades = Array.isArray(trades) ? trades.filter((t: any) => {
        const matchesSearch = 
            t.stock?.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    }) : [];

    const completedTrades = filteredTrades.filter((t: any) => t.status === 'COMPLETED');
    const totalVolume = filteredTrades.reduce((sum: number, t: any) => sum + (t.totalAmount || 0), 0);
    const avgPnL = completedTrades.length > 0
        ? completedTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) / completedTrades.length
        : 0;

    const statusLabels: Record<string, string> = {
        'PENDING': '대기',
        'COMPLETED': '체결',
        'FAILED': '실패',
        'CANCELLED': '취소',
    };

    const statusVariants: Record<string, 'default' | 'success' | 'danger' | 'warning'> = {
        'PENDING': 'warning',
        'COMPLETED': 'success',
        'FAILED': 'danger',
        'CANCELLED': 'default',
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity size={24} className="text-green-400" />
                        거래 모니터링
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">전체 사용자 거래 내역</p>
                </div>
                <button onClick={() => mutate()} className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1">
                    <RefreshCw size={14} />
                    새로고침
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">총 거래</p>
                    <p className="text-2xl font-bold text-white">{filteredTrades.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">체결 완료</p>
                    <p className="text-2xl font-bold text-green-400">{completedTrades.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">총 거래량</p>
                    <p className="text-2xl font-bold text-white">₩{totalVolume.toLocaleString()}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">평균 손익</p>
                    <p className={`text-2xl font-bold ${avgPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {avgPnL >= 0 ? '+' : ''}₩{avgPnL.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 flex gap-3">
                <input 
                    type="text" 
                    placeholder="종목 또는 사용자 검색..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300/50" 
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white"
                >
                    <option value="ALL">전체 상태</option>
                    <option value="PENDING">대기</option>
                    <option value="COMPLETED">체결</option>
                    <option value="FAILED">실패</option>
                    <option value="CANCELLED">취소</option>
                </select>
            </div>

            {/* Failed Trades Alert */}
            {filteredTrades.filter((t: any) => t.status === 'FAILED').length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-400" />
                    <span className="text-sm text-red-400">
                        {filteredTrades.filter((t: any) => t.status === 'FAILED').length}건의 실패한 거래가 있습니다.
                    </span>
                </div>
            )}

            {/* Table */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-3 py-2 text-left text-blue-200">시간</th>
                            <th className="px-3 py-2 text-left text-blue-200">종목</th>
                            <th className="px-3 py-2 text-left text-blue-200">사용자</th>
                            <th className="px-3 py-2 text-center text-blue-200">매매</th>
                            <th className="px-3 py-2 text-right text-blue-200">수량</th>
                            <th className="px-3 py-2 text-right text-blue-200">가격</th>
                            <th className="px-3 py-2 text-right text-blue-200">금액</th>
                            <th className="px-3 py-2 text-center text-blue-200">상태</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="px-3 py-8 text-center text-blue-200">
                                    <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
                                    로딩 중...
                                </td>
                            </tr>
                        ) : filteredTrades.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-3 py-8 text-center text-blue-200">
                                    거래 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredTrades.map((trade: any) => (
                                <tr key={trade.id} className="hover:bg-white/5">
                                    <td className="px-3 py-2 text-blue-200">
                                        <div className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {new Date(trade.createdAt).toLocaleString('ko-KR', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="text-white font-medium">{trade.stock?.symbol || '-'}</div>
                                        <div className="text-blue-300/70">{trade.stock?.name?.slice(0, 10) || ''}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                            <User size={12} className="text-blue-400" />
                                            <span className="text-blue-200">{trade.user?.email?.split('@')[0] || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <Badge 
                                            variant={trade.side === 'BUY' ? 'success' : 'danger'} 
                                            size="sm"
                                        >
                                            {trade.side === 'BUY' ? '매수' : '매도'}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-right text-white">
                                        {trade.quantity?.toLocaleString() || 0}
                                    </td>
                                    <td className="px-3 py-2 text-right text-white">
                                        ₩{(trade.price || 0).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right text-white font-medium">
                                        ₩{(trade.totalAmount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <Badge 
                                            variant={statusVariants[trade.status] || 'default'} 
                                            size="sm"
                                        >
                                            {statusLabels[trade.status] || trade.status}
                                        </Badge>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
