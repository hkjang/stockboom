'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
    Star, Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, 
    Bell, BarChart2, FolderPlus, Folder, AlertCircle
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface WatchlistItem {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    rsi?: number | null;
    macdSignal?: string | null;
    hasAlert: boolean;
}

interface WatchlistGroup {
    id: string;
    name: string;
    items: WatchlistItem[];
}

export default function WatchlistPage() {
    const { data, mutate, isLoading, error } = useSWR('/api/admin/watchlist', fetcher);
    const [selectedGroup, setSelectedGroup] = useState<string>('all');

    const groups: WatchlistGroup[] = data?.groups || [];
    const allItems = groups.flatMap(g => g.items);
    const displayItems = selectedGroup === 'all' 
        ? allItems 
        : groups.find(g => g.id === selectedGroup)?.items || [];
    const isRealData = !!data?.groups?.length;

    const getMacdColor = (signal?: string | null) => {
        switch (signal) {
            case 'BUY': return 'text-green-400 bg-green-400/20';
            case 'SELL': return 'text-red-400 bg-red-400/20';
            case 'OVERBOUGHT': return 'text-orange-400 bg-orange-400/20';
            case 'OVERSOLD': return 'text-cyan-400 bg-cyan-400/20';
            default: return 'text-gray-400 bg-gray-400/20';
        }
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
                    <p className="text-white">데이터를 불러올 수 없습니다</p>
                    <button onClick={() => mutate()} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Star size={24} className="text-yellow-400" />
                        관심종목
                        {isRealData && <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">LIVE</span>}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">관심종목 관리 및 실시간 모니터링</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center gap-1">
                        <Plus size={14} />
                        종목 추가
                    </button>
                    <button className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-1">
                        <FolderPlus size={14} />
                        그룹 추가
                    </button>
                    <button 
                        onClick={() => mutate()} 
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-1"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <p className="text-xs text-blue-200">전체 종목</p>
                    <p className="text-xl font-bold text-white">{allItems.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <p className="text-xs text-blue-200">상승</p>
                    <p className="text-xl font-bold text-green-400">{allItems.filter(i => (i.change || 0) > 0).length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <p className="text-xs text-blue-200">하락</p>
                    <p className="text-xl font-bold text-red-400">{allItems.filter(i => (i.change || 0) < 0).length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <p className="text-xs text-blue-200">알림 설정</p>
                    <p className="text-xl font-bold text-yellow-400">{allItems.filter(i => i.hasAlert).length}</p>
                </div>
            </div>

            {/* Group Tabs */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setSelectedGroup('all')}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                        selectedGroup === 'all' ? 'bg-yellow-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                    }`}
                >
                    <Star size={12} />
                    전체 ({allItems.length})
                </button>
                {groups.map(group => (
                    <button
                        key={group.id}
                        onClick={() => setSelectedGroup(group.id)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                            selectedGroup === group.id ? 'bg-yellow-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        <Folder size={12} />
                        {group.name} ({group.items.length})
                    </button>
                ))}
            </div>

            {/* Watchlist Table */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-4 py-3 text-left text-blue-200">종목</th>
                            <th className="px-4 py-3 text-right text-blue-200">현재가</th>
                            <th className="px-4 py-3 text-right text-blue-200">등락률</th>
                            <th className="px-4 py-3 text-right text-blue-200">거래량</th>
                            <th className="px-4 py-3 text-center text-blue-200">RSI</th>
                            <th className="px-4 py-3 text-center text-blue-200">MACD</th>
                            <th className="px-4 py-3 text-center text-blue-200">알림</th>
                            <th className="px-4 py-3 text-center text-blue-200">작업</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {displayItems.length > 0 ? displayItems.map(item => (
                            <tr key={item.symbol} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                        <div>
                                            <div className="text-white font-medium">{item.name}</div>
                                            <div className="text-blue-200/50 text-xs">{item.symbol}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right text-white font-medium">
                                    {item.price ? `₩${item.price.toLocaleString()}` : '-'}
                                </td>
                                <td className={`px-4 py-3 text-right font-medium ${(item.change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    <div className="flex items-center justify-end gap-1">
                                        {item.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        {item.changePercent !== undefined ? (item.changePercent >= 0 ? '+' : '') + item.changePercent.toFixed(2) + '%' : '-'}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right text-blue-200">
                                    {item.volume ? (item.volume / 1e6).toFixed(1) + 'M' : '-'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {item.rsi !== null && item.rsi !== undefined ? (
                                        <div className="flex items-center justify-center gap-1">
                                            <span className={item.rsi > 70 ? 'text-red-400' : item.rsi < 30 ? 'text-green-400' : 'text-white'}>
                                                {item.rsi}
                                            </span>
                                            <div className="w-10 h-1.5 bg-white/10 rounded-full">
                                                <div className={`h-full rounded-full ${item.rsi > 70 ? 'bg-red-500' : item.rsi < 30 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${item.rsi}%` }} />
                                            </div>
                                        </div>
                                    ) : <span className="text-blue-200/50">-</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {item.macdSignal ? (
                                        <span className={`px-2 py-0.5 rounded text-xs ${getMacdColor(item.macdSignal)}`}>
                                            {item.macdSignal}
                                        </span>
                                    ) : <span className="text-blue-200/50">-</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {item.hasAlert ? (
                                        <Bell size={14} className="mx-auto text-yellow-400" />
                                    ) : (
                                        <Bell size={14} className="mx-auto text-gray-500" />
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-1">
                                        <button className="p-1 hover:bg-white/10 rounded text-blue-200 hover:text-white">
                                            <BarChart2 size={14} />
                                        </button>
                                        <button className="p-1 hover:bg-white/10 rounded text-blue-200 hover:text-white">
                                            <Bell size={14} />
                                        </button>
                                        <button className="p-1 hover:bg-white/10 rounded text-red-400 hover:text-red-300">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-blue-200/50">
                                    {isLoading ? '데이터 로딩중...' : '관심종목이 없습니다. 종목을 추가해주세요.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
