'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
    Search, Filter, TrendingUp, TrendingDown, Star, StarOff,
    ChevronUp, ChevronDown, RefreshCw, Download, BarChart2, AlertCircle
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface ScreenerStock {
    symbol: string;
    name: string;
    market: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap: number;
    per: number;
    pbr: number;
    rsi: number | null;
    macdSignal: string | null;
    foreignNet: number;
    score: number;
}

type SortField = 'symbol' | 'price' | 'changePercent' | 'volume' | 'rsi' | 'foreignNet' | 'score';

export default function StockScreenerPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<SortField>('score');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [filters, setFilters] = useState({
        market: 'all',
        rsiMin: 0,
        rsiMax: 100,
        changeMin: -100,
        changeMax: 100,
        macdSignal: 'all',
    });
    const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

    // Build query params
    const params = new URLSearchParams({
        market: filters.market,
        rsiMin: filters.rsiMin.toString(),
        rsiMax: filters.rsiMax.toString(),
    });

    const { data, mutate, isLoading, error } = useSWR(`/api/admin/screener?${params}`, fetcher);
    
    const screenerData: ScreenerStock[] = data?.stocks || [];
    const isRealData = !!data?.stocks?.length;

    const filteredData = screenerData.filter(stock => {
        if (searchTerm && !stock.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !stock.symbol?.includes(searchTerm)) return false;
        if (stock.changePercent < filters.changeMin || stock.changePercent > filters.changeMax) return false;
        if (filters.macdSignal !== 'all' && stock.macdSignal !== filters.macdSignal) return false;
        return true;
    }).sort((a, b) => {
        const aVal = a[sortField] ?? 0;
        const bVal = b[sortField] ?? 0;
        return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const toggleWatchlist = (symbol: string) => {
        setWatchlist(prev => {
            const newSet = new Set(prev);
            if (newSet.has(symbol)) newSet.delete(symbol);
            else newSet.add(symbol);
            return newSet;
        });
    };

    const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
        <th 
            className="px-3 py-2 text-left text-blue-200 cursor-pointer hover:text-white transition-colors"
            onClick={() => toggleSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortField === field && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
            </div>
        </th>
    );

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
                        <Search size={24} className="text-purple-400" />
                        종목 스크리너
                        {isRealData && <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">LIVE</span>}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">조건에 맞는 종목 검색 및 필터링</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1">
                        <Download size={12} />
                        내보내기
                    </button>
                    <button onClick={() => mutate()} className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-1">
                        <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter size={14} className="text-blue-400" />
                    <span className="text-sm font-medium text-white">필터</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div>
                        <label className="text-xs text-blue-200 mb-1 block">검색</label>
                        <input 
                            type="text" 
                            placeholder="종목명/코드"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white placeholder-blue-200/50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-blue-200 mb-1 block">시장</label>
                        <select 
                            value={filters.market}
                            onChange={e => setFilters(f => ({ ...f, market: e.target.value }))}
                            className="w-full px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white"
                        >
                            <option value="all">전체</option>
                            <option value="KOSPI">KOSPI</option>
                            <option value="KOSDAQ">KOSDAQ</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-blue-200 mb-1 block">RSI 범위</label>
                        <div className="flex gap-1">
                            <input type="number" min="0" max="100" value={filters.rsiMin} onChange={e => setFilters(f => ({ ...f, rsiMin: +e.target.value }))} className="w-1/2 px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white" />
                            <input type="number" min="0" max="100" value={filters.rsiMax} onChange={e => setFilters(f => ({ ...f, rsiMax: +e.target.value }))} className="w-1/2 px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-blue-200 mb-1 block">등락률 (%)</label>
                        <div className="flex gap-1">
                            <input type="number" value={filters.changeMin} onChange={e => setFilters(f => ({ ...f, changeMin: +e.target.value }))} className="w-1/2 px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white" />
                            <input type="number" value={filters.changeMax} onChange={e => setFilters(f => ({ ...f, changeMax: +e.target.value }))} className="w-1/2 px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-blue-200 mb-1 block">MACD 시그널</label>
                        <select 
                            value={filters.macdSignal}
                            onChange={e => setFilters(f => ({ ...f, macdSignal: e.target.value }))}
                            className="w-full px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white"
                        >
                            <option value="all">전체</option>
                            <option value="BUY">매수</option>
                            <option value="SELL">매도</option>
                            <option value="HOLD">관망</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button 
                            onClick={() => {
                                setFilters({ market: 'all', rsiMin: 0, rsiMax: 100, changeMin: -100, changeMax: 100, macdSignal: 'all' });
                                setSearchTerm('');
                            }}
                            className="w-full px-2 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
                        >
                            초기화
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-white/10 flex justify-between items-center">
                    <span className="text-sm text-white">
                        검색 결과: <span className="text-cyan-400 font-bold">{filteredData.length}</span> 종목
                        {isLoading && <RefreshCw size={12} className="inline ml-2 animate-spin text-blue-400" />}
                    </span>
                    <span className="text-xs text-blue-200/50">관심종목: {watchlist.size}개</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-3 py-2 text-left text-blue-200 w-10"></th>
                                <SortHeader field="symbol" label="종목" />
                                <SortHeader field="price" label="현재가" />
                                <SortHeader field="changePercent" label="등락률" />
                                <SortHeader field="volume" label="거래량" />
                                <SortHeader field="rsi" label="RSI" />
                                <th className="px-3 py-2 text-left text-blue-200">MACD</th>
                                <SortHeader field="foreignNet" label="외국인" />
                                <SortHeader field="score" label="점수" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredData.length > 0 ? filteredData.map(stock => (
                                <tr key={stock.symbol} className="hover:bg-white/5 transition-colors">
                                    <td className="px-3 py-2">
                                        <button onClick={() => toggleWatchlist(stock.symbol)}>
                                            {watchlist.has(stock.symbol) ? <Star size={14} className="text-yellow-400 fill-yellow-400" /> : <StarOff size={14} className="text-gray-500 hover:text-yellow-400" />}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="text-white font-medium">{stock.name}</div>
                                        <div className="text-blue-200/50">{stock.symbol}</div>
                                    </td>
                                    <td className="px-3 py-2 text-white">₩{stock.price?.toLocaleString() || '-'}</td>
                                    <td className={`px-3 py-2 font-medium ${(stock.changePercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2) || '0'}%
                                    </td>
                                    <td className="px-3 py-2 text-white">{stock.volume ? (stock.volume / 1000000).toFixed(1) + 'M' : '-'}</td>
                                    <td className="px-3 py-2">
                                        {stock.rsi !== null ? (
                                            <div className="flex items-center gap-2">
                                                <span className={stock.rsi >= 70 ? 'text-red-400' : stock.rsi <= 30 ? 'text-green-400' : 'text-white'}>{stock.rsi}</span>
                                                <div className="w-12 h-1.5 bg-white/10 rounded-full">
                                                    <div className={`h-full rounded-full ${stock.rsi >= 70 ? 'bg-red-500' : stock.rsi <= 30 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${stock.rsi}%` }} />
                                                </div>
                                            </div>
                                        ) : <span className="text-blue-200/50">-</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                        {stock.macdSignal ? (
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                stock.macdSignal === 'BUY' ? 'bg-green-400/20 text-green-400' :
                                                stock.macdSignal === 'SELL' ? 'bg-red-400/20 text-red-400' :
                                                'bg-yellow-400/20 text-yellow-400'
                                            }`}>{stock.macdSignal}</span>
                                        ) : <span className="text-blue-200/50">-</span>}
                                    </td>
                                    <td className={`px-3 py-2 ${(stock.foreignNet || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stock.foreignNet ? (stock.foreignNet >= 0 ? '+' : '') + (stock.foreignNet / 1000).toFixed(0) + 'K' : '-'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${stock.score >= 75 ? 'text-green-400' : stock.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{stock.score}</span>
                                            <div className="w-12 h-1.5 bg-white/10 rounded-full">
                                                <div className={`h-full rounded-full ${stock.score >= 75 ? 'bg-green-500' : stock.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${stock.score}%` }} />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={9} className="px-3 py-8 text-center text-blue-200/50">
                                        {isLoading ? '데이터 로딩중...' : '검색 결과가 없습니다'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
