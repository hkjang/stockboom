'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';
import { 
    Briefcase, TrendingUp, TrendingDown, Eye, Trash2, RefreshCw, User, 
    Search, Filter, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    X, Edit2, Check, AlertCircle, BarChart3, DollarSign, PieChart, Activity
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

type SortField = 'name' | 'user' | 'totalValue' | 'unrealizedPL' | 'positions' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'active' | 'inactive';
type FilterPnL = 'all' | 'profit' | 'loss';

export default function AdminPortfolios() {
    const { data: portfolios, mutate, isLoading, error } = useSWR('/api/admin/portfolios', fetcher, {
        refreshInterval: 30000, // 30초마다 자동 새로고침
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPortfolio, setSelectedPortfolio] = useState<any>(null);
    const [sortField, setSortField] = useState<SortField>('totalValue');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [filterPnL, setFilterPnL] = useState<FilterPnL>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const itemsPerPage = 10;

    // 필터링 및 정렬된 데이터
    const processedPortfolios = useMemo(() => {
        if (!Array.isArray(portfolios)) return [];
        
        let result = [...portfolios];
        
        // 검색 필터
        if (searchTerm) {
            result = result.filter((p: any) =>
                p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        // 상태 필터
        if (filterStatus !== 'all') {
            result = result.filter((p: any) => 
                filterStatus === 'active' ? p.isActive : !p.isActive
            );
        }
        
        // 손익 필터
        if (filterPnL !== 'all') {
            result = result.filter((p: any) => 
                filterPnL === 'profit' ? (p.unrealizedPL || 0) >= 0 : (p.unrealizedPL || 0) < 0
            );
        }
        
        // 정렬
        result.sort((a: any, b: any) => {
            let aVal: any, bVal: any;
            switch (sortField) {
                case 'name':
                    aVal = a.name?.toLowerCase() || '';
                    bVal = b.name?.toLowerCase() || '';
                    break;
                case 'user':
                    aVal = a.user?.email?.toLowerCase() || '';
                    bVal = b.user?.email?.toLowerCase() || '';
                    break;
                case 'totalValue':
                    aVal = a.totalValue || 0;
                    bVal = b.totalValue || 0;
                    break;
                case 'unrealizedPL':
                    aVal = a.unrealizedPL || 0;
                    bVal = b.unrealizedPL || 0;
                    break;
                case 'positions':
                    aVal = a._count?.positions || 0;
                    bVal = b._count?.positions || 0;
                    break;
                case 'createdAt':
                    aVal = new Date(a.createdAt).getTime();
                    bVal = new Date(b.createdAt).getTime();
                    break;
                default:
                    return 0;
            }
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        return result;
    }, [portfolios, searchTerm, filterStatus, filterPnL, sortField, sortDirection]);

    // 페이지네이션
    const totalPages = Math.ceil(processedPortfolios.length / itemsPerPage);
    const paginatedPortfolios = processedPortfolios.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // 통계
    const stats = useMemo(() => {
        if (!Array.isArray(portfolios)) return {
            total: 0, totalValue: 0, totalPnL: 0, totalPositions: 0,
            activeCount: 0, profitCount: 0, lossCount: 0,
            avgPnLPercent: 0, maxPnL: 0, minPnL: 0
        };
        
        const totalValue = portfolios.reduce((sum: number, p: any) => sum + (p.totalValue || 0), 0);
        const totalPnL = portfolios.reduce((sum: number, p: any) => sum + (p.unrealizedPL || 0), 0);
        const totalPositions = portfolios.reduce((sum: number, p: any) => sum + (p._count?.positions || 0), 0);
        const activeCount = portfolios.filter((p: any) => p.isActive).length;
        const profitCount = portfolios.filter((p: any) => (p.unrealizedPL || 0) >= 0).length;
        const lossCount = portfolios.filter((p: any) => (p.unrealizedPL || 0) < 0).length;
        
        const pnlValues = portfolios.map((p: any) => p.unrealizedPL || 0);
        const maxPnL = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
        const minPnL = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;
        const avgPnLPercent = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;
        
        return {
            total: portfolios.length,
            totalValue,
            totalPnL,
            totalPositions,
            activeCount,
            profitCount,
            lossCount,
            avgPnLPercent,
            maxPnL,
            minPnL
        };
    }, [portfolios]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 포트폴리오를 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/portfolios/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        mutate();
    };

    const handleToggleActive = async (portfolio: any) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/portfolios/${portfolio.id}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isActive: !portfolio.isActive })
        });
        mutate();
    };

    const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
        <th 
            className={`px-3 py-2 text-blue-200 cursor-pointer hover:bg-white/5 transition-colors select-none ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : ''}`}>
                {children}
                {sortField === field ? (
                    sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                ) : (
                    <ArrowUpDown size={12} className="opacity-30" />
                )}
            </div>
        </th>
    );

    const clearFilters = () => {
        setSearchTerm('');
        setFilterStatus('all');
        setFilterPnL('all');
        setCurrentPage(1);
    };

    const hasActiveFilters = searchTerm || filterStatus !== 'all' || filterPnL !== 'all';

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Briefcase size={24} className="text-blue-400" />
                        포트폴리오 관리
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">전체 사용자 포트폴리오 관리 및 분석</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 transition-all ${
                            showFilters ? 'bg-blue-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        <Filter size={14} />
                        필터
                        {hasActiveFilters && (
                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                        )}
                    </button>
                    <button 
                        onClick={() => mutate()} 
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1 transition-all"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-red-400" size={20} />
                    <div>
                        <p className="text-red-200 font-medium">데이터를 불러오는데 실패했습니다</p>
                        <p className="text-red-300/70 text-xs">잠시 후 다시 시도해주세요</p>
                    </div>
                    <button 
                        onClick={() => mutate()} 
                        className="ml-auto px-3 py-1 text-xs bg-red-500/30 hover:bg-red-500/50 text-red-200 rounded-lg"
                    >
                        재시도
                    </button>
                </div>
            )}

            {/* Enhanced Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <Briefcase size={14} className="text-blue-400" />
                        <p className="text-xs text-blue-200">총 포트폴리오</p>
                    </div>
                    <p className="text-xl font-bold text-white">{stats.total}</p>
                    <p className="text-xs text-blue-300/70">{stats.activeCount} 활성</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={14} className="text-green-400" />
                        <p className="text-xs text-blue-200">총 자산가치</p>
                    </div>
                    <p className="text-xl font-bold text-white">₩{stats.totalValue.toLocaleString()}</p>
                    <p className="text-xs text-blue-300/70">평균 ₩{stats.total > 0 ? Math.round(stats.totalValue / stats.total).toLocaleString() : 0}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity size={14} className={stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'} />
                        <p className="text-xs text-blue-200">총 손익</p>
                    </div>
                    <p className={`text-xl font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.totalPnL >= 0 ? '+' : ''}₩{stats.totalPnL.toLocaleString()}
                    </p>
                    <p className={`text-xs ${stats.avgPnLPercent >= 0 ? 'text-green-300/70' : 'text-red-300/70'}`}>
                        {stats.avgPnLPercent >= 0 ? '+' : ''}{stats.avgPnLPercent.toFixed(2)}%
                    </p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <PieChart size={14} className="text-purple-400" />
                        <p className="text-xs text-blue-200">총 포지션</p>
                    </div>
                    <p className="text-xl font-bold text-white">{stats.totalPositions}</p>
                    <p className="text-xs text-blue-300/70">평균 {stats.total > 0 ? (stats.totalPositions / stats.total).toFixed(1) : 0}개/포트폴리오</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-green-400" />
                        <p className="text-xs text-blue-200">최고 수익</p>
                    </div>
                    <p className="text-xl font-bold text-green-400">+₩{stats.maxPnL.toLocaleString()}</p>
                    <p className="text-xs text-green-300/70">{stats.profitCount}개 수익 중</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown size={14} className="text-red-400" />
                        <p className="text-xs text-blue-200">최대 손실</p>
                    </div>
                    <p className="text-xl font-bold text-red-400">₩{stats.minPnL.toLocaleString()}</p>
                    <p className="text-xs text-red-300/70">{stats.lossCount}개 손실 중</p>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white">필터 옵션</h3>
                        {hasActiveFilters && (
                            <button 
                                onClick={clearFilters}
                                className="text-xs text-blue-300 hover:text-white flex items-center gap-1"
                            >
                                <X size={12} />
                                초기화
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/50" />
                            <input 
                                type="text" 
                                placeholder="포트폴리오 또는 사용자 검색..." 
                                value={searchTerm} 
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-9 pr-3 py-2 text-xs bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500 transition-colors" 
                            />
                        </div>
                        
                        {/* Status Filter */}
                        <div>
                            <select
                                value={filterStatus}
                                onChange={(e) => { setFilterStatus(e.target.value as FilterStatus); setCurrentPage(1); }}
                                className="w-full px-3 py-2 text-xs bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                            >
                                <option value="all">모든 상태</option>
                                <option value="active">활성만</option>
                                <option value="inactive">비활성만</option>
                            </select>
                        </div>
                        
                        {/* PnL Filter */}
                        <div>
                            <select
                                value={filterPnL}
                                onChange={(e) => { setFilterPnL(e.target.value as FilterPnL); setCurrentPage(1); }}
                                className="w-full px-3 py-2 text-xs bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                            >
                                <option value="all">모든 손익</option>
                                <option value="profit">수익만</option>
                                <option value="loss">손실만</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Search (when filters hidden) */}
            {!showFilters && (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/50" />
                        <input 
                            type="text" 
                            placeholder="포트폴리오 또는 사용자 검색..." 
                            value={searchTerm} 
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-500 transition-colors" 
                        />
                    </div>
                </div>
            )}

            {/* Results Summary */}
            <div className="flex items-center justify-between text-xs text-blue-200">
                <p>
                    {processedPortfolios.length}개 결과
                    {hasActiveFilters && ` (전체 ${stats.total}개 중)`}
                </p>
                <p>
                    페이지 {currentPage} / {totalPages || 1}
                </p>
            </div>

            {/* Table */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-white/5">
                            <tr>
                                <SortableHeader field="name" className="text-left">포트폴리오</SortableHeader>
                                <SortableHeader field="user" className="text-left">사용자</SortableHeader>
                                <SortableHeader field="totalValue" className="text-right">총 가치</SortableHeader>
                                <SortableHeader field="unrealizedPL" className="text-right">손익</SortableHeader>
                                <SortableHeader field="positions" className="text-center">포지션</SortableHeader>
                                <th className="px-3 py-2 text-center text-blue-200">상태</th>
                                <th className="px-3 py-2 text-right text-blue-200">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-12 text-center text-blue-200">
                                        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                                        <p>데이터를 불러오는 중...</p>
                                    </td>
                                </tr>
                            ) : paginatedPortfolios.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-12 text-center text-blue-200">
                                        <Briefcase className="mx-auto mb-2 opacity-50" size={32} />
                                        <p>{hasActiveFilters ? '검색 결과가 없습니다' : '포트폴리오가 없습니다'}</p>
                                        {hasActiveFilters && (
                                            <button 
                                                onClick={clearFilters}
                                                className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                필터 초기화
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                paginatedPortfolios.map((portfolio: any, index: number) => (
                                    <tr 
                                        key={portfolio.id} 
                                        className="hover:bg-white/5 transition-colors"
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    >
                                        <td className="px-3 py-2.5">
                                            <div className="text-white font-medium">{portfolio.name}</div>
                                            <div className="text-blue-300/70 truncate max-w-[200px]" title={portfolio.description}>
                                                {portfolio.description || '-'}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                    <User size={12} className="text-blue-400" />
                                                </div>
                                                <span className="text-blue-200">{portfolio.user?.email || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="text-white font-medium">
                                                ₩{(portfolio.totalValue || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className={`flex items-center justify-end gap-1 ${
                                                (portfolio.unrealizedPL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                {(portfolio.unrealizedPL || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                <span className="font-medium">
                                                    {(portfolio.unrealizedPL || 0) >= 0 ? '+' : ''}₩{(portfolio.unrealizedPL || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            {portfolio.totalValue > 0 && (
                                                <div className={`text-[10px] ${
                                                    (portfolio.unrealizedPL || 0) >= 0 ? 'text-green-400/70' : 'text-red-400/70'
                                                }`}>
                                                    {((portfolio.unrealizedPL || 0) / portfolio.totalValue * 100).toFixed(2)}%
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <Badge variant="default" size="sm">
                                                {portfolio._count?.positions || 0}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <button
                                                onClick={() => handleToggleActive(portfolio)}
                                                className="inline-block"
                                                title={portfolio.isActive ? '클릭하여 비활성화' : '클릭하여 활성화'}
                                            >
                                                <Badge 
                                                    variant={portfolio.isActive ? 'success' : 'danger'} 
                                                    size="sm"
                                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                                >
                                                    {portfolio.isActive ? '활성' : '비활성'}
                                                </Badge>
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button 
                                                    onClick={() => setSelectedPortfolio(portfolio)}
                                                    className="p-1.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded transition-colors"
                                                    title="상세 보기"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(portfolio.id)}
                                                    className="p-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded transition-colors"
                                                    title="삭제"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-xs text-blue-200">
                        {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, processedPortfolios.length)} / {processedPortfolios.length}개
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-1.5 text-xs bg-white/10 text-blue-200 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                        >
                            <ChevronLeft size={14} />
                            <ChevronLeft size={14} className="-ml-2" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 text-xs bg-white/10 text-blue-200 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (currentPage <= 3) {
                                pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = currentPage - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                                        currentPage === pageNum 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 text-xs bg-white/10 text-blue-200 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1.5 text-xs bg-white/10 text-blue-200 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                        >
                            <ChevronRight size={14} />
                            <ChevronRight size={14} className="-ml-2" />
                        </button>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedPortfolio && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedPortfolio(null)}>
                    <div 
                        className="bg-slate-900/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Briefcase size={20} className="text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">{selectedPortfolio.name}</h2>
                                    <p className="text-xs text-blue-200">{selectedPortfolio.description || '설명 없음'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedPortfolio(null)} 
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-80px)]">
                            {/* Portfolio Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-xs text-blue-200 mb-1">사용자</p>
                                    <div className="flex items-center gap-1">
                                        <User size={12} className="text-blue-400" />
                                        <span className="text-white text-sm font-medium truncate">{selectedPortfolio.user?.email}</span>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-xs text-blue-200 mb-1">현금 잔고</p>
                                    <p className="text-white text-sm font-bold">₩{(selectedPortfolio.cashBalance || 0).toLocaleString()}</p>
                                    <p className="text-[10px] text-blue-300/50">
                                        {selectedPortfolio.totalValue > 0 ? ((selectedPortfolio.cashBalance / selectedPortfolio.totalValue) * 100).toFixed(1) : 0}% 현금 비중
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-xs text-blue-200 mb-1">총 가치</p>
                                    <p className="text-white text-sm font-bold">₩{(selectedPortfolio.totalValue || 0).toLocaleString()}</p>
                                    <p className="text-[10px] text-blue-300/50">현금 + 주식</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-xs text-blue-200 mb-1">미실현 손익</p>
                                    <p className={`text-sm font-bold ${(selectedPortfolio.unrealizedPL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {(selectedPortfolio.unrealizedPL || 0) >= 0 ? '+' : ''}₩{(selectedPortfolio.unrealizedPL || 0).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-blue-300/50">
                                        {selectedPortfolio.totalValue > 0 ? ((selectedPortfolio.unrealizedPL / selectedPortfolio.totalValue) * 100).toFixed(2) : 0}%
                                    </p>
                                </div>
                            </div>

                            {/* Allocation Chart & Risk Metrics */}
                            {selectedPortfolio.positions?.length > 0 && (() => {
                                const positions = selectedPortfolio.positions || [];
                                const totalInvested = positions.reduce((sum: number, p: any) => sum + (p.marketValue || p.quantity * p.currentPrice || 0), 0);
                                const cashBalance = selectedPortfolio.cashBalance || 0;
                                const totalAssets = totalInvested + cashBalance;
                                
                                // Calculate risk metrics
                                const worstPosition = [...positions].sort((a: any, b: any) => (a.unrealizedPL || 0) - (b.unrealizedPL || 0))[0];
                                const bestPosition = [...positions].sort((a: any, b: any) => (b.unrealizedPL || 0) - (a.unrealizedPL || 0))[0];
                                const profitPositions = positions.filter((p: any) => (p.unrealizedPL || 0) >= 0).length;
                                const lossPositions = positions.length - profitPositions;
                                
                                // Concentration risk (largest position %)
                                const largestPosition = [...positions].sort((a: any, b: any) => 
                                    (b.marketValue || b.quantity * b.currentPrice || 0) - (a.marketValue || a.quantity * a.currentPrice || 0)
                                )[0];
                                const concentrationPct = totalAssets > 0 
                                    ? ((largestPosition?.marketValue || largestPosition?.quantity * largestPosition?.currentPrice || 0) / totalAssets) * 100 
                                    : 0;
                                
                                // Colors for allocation chart
                                const colors = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6', '#a3e635'];
                                
                                return (
                                    <>
                                        {/* Allocation Visualization */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-white/5 rounded-lg p-3">
                                                <h4 className="text-xs font-medium text-white mb-3 flex items-center gap-1">
                                                    <PieChart size={12} className="text-cyan-400" />
                                                    자산 배분
                                                </h4>
                                                {/* Horizontal bar chart */}
                                                <div className="space-y-2">
                                                    {cashBalance > 0 && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 text-[10px] text-blue-200 truncate">현금</div>
                                                            <div className="flex-1 h-4 bg-white/10 rounded overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-gray-500 transition-all" 
                                                                    style={{ width: `${(cashBalance / totalAssets) * 100}%` }}
                                                                />
                                                            </div>
                                                            <div className="w-12 text-[10px] text-white text-right">{((cashBalance / totalAssets) * 100).toFixed(1)}%</div>
                                                        </div>
                                                    )}
                                                    {positions.slice(0, 5).map((pos: any, i: number) => {
                                                        const value = pos.marketValue || pos.quantity * pos.currentPrice || 0;
                                                        const pct = totalAssets > 0 ? (value / totalAssets) * 100 : 0;
                                                        return (
                                                            <div key={pos.id} className="flex items-center gap-2">
                                                                <div className="w-16 text-[10px] text-blue-200 truncate">{pos.stock?.symbol || pos.stockId}</div>
                                                                <div className="flex-1 h-4 bg-white/10 rounded overflow-hidden">
                                                                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                                                                </div>
                                                                <div className="w-12 text-[10px] text-white text-right">{pct.toFixed(1)}%</div>
                                                            </div>
                                                        );
                                                    })}
                                                    {positions.length > 5 && (
                                                        <p className="text-[10px] text-blue-300/50 text-center">+{positions.length - 5}개 더 보유</p>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Risk Metrics */}
                                            <div className="bg-white/5 rounded-lg p-3">
                                                <h4 className="text-xs font-medium text-white mb-3 flex items-center gap-1">
                                                    <AlertCircle size={12} className="text-orange-400" />
                                                    리스크 지표
                                                </h4>
                                                <div className="space-y-2 text-xs">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-blue-200">집중도 위험</span>
                                                        <span className={concentrationPct > 30 ? 'text-red-400' : concentrationPct > 20 ? 'text-yellow-400' : 'text-green-400'}>
                                                            {concentrationPct.toFixed(1)}%
                                                            <span className="text-[10px] ml-1 text-blue-300/50">({largestPosition?.stock?.symbol})</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-blue-200">현금 비중</span>
                                                        <span className={(cashBalance / totalAssets) * 100 < 10 ? 'text-yellow-400' : 'text-green-400'}>
                                                            {((cashBalance / totalAssets) * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-blue-200">수익/손실 비</span>
                                                        <span className={profitPositions >= lossPositions ? 'text-green-400' : 'text-red-400'}>
                                                            {profitPositions}승 / {lossPositions}패
                                                        </span>
                                                    </div>
                                                    <div className="border-t border-white/10 pt-2 mt-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-green-400 text-[10px]">최고 수익</span>
                                                            <span className="text-green-400">
                                                                {bestPosition?.stock?.symbol}: +₩{(bestPosition?.unrealizedPL || 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <span className="text-red-400 text-[10px]">최대 손실</span>
                                                            <span className="text-red-400">
                                                                {worstPosition?.stock?.symbol}: ₩{(worstPosition?.unrealizedPL || 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Positions Table */}
                            {selectedPortfolio.positions?.length > 0 ? (
                                <div>
                                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                        <BarChart3 size={14} className="text-blue-400" />
                                        포지션 상세 ({selectedPortfolio.positions.length}개)
                                    </h3>
                                    <div className="bg-white/5 rounded-lg overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-white/5">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-blue-200">종목</th>
                                                    <th className="px-3 py-2 text-right text-blue-200">수량</th>
                                                    <th className="px-3 py-2 text-right text-blue-200">평균가</th>
                                                    <th className="px-3 py-2 text-right text-blue-200">현재가</th>
                                                    <th className="px-3 py-2 text-right text-blue-200">평가금액</th>
                                                    <th className="px-3 py-2 text-right text-blue-200">손익</th>
                                                    <th className="px-3 py-2 text-right text-blue-200">수익률</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {selectedPortfolio.positions.map((pos: any) => {
                                                    const currentPrice = pos.currentPrice || pos.averagePrice;
                                                    const marketValue = pos.marketValue || (pos.quantity * currentPrice);
                                                    const pnlPercent = pos.averagePrice > 0 ? ((currentPrice - pos.averagePrice) / pos.averagePrice * 100) : 0;
                                                    return (
                                                        <tr key={pos.id} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-3 py-2">
                                                                <div className="text-white font-medium">{pos.stock?.symbol || pos.stockId}</div>
                                                                <div className="text-blue-300/70 text-[10px]">{pos.stock?.name || ''}</div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-white">{pos.quantity?.toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right text-white">₩{pos.averagePrice?.toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right text-white">₩{currentPrice?.toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right text-white font-medium">₩{marketValue?.toLocaleString()}</td>
                                                            <td className={`px-3 py-2 text-right font-medium ${(pos.unrealizedPL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {(pos.unrealizedPL || 0) >= 0 ? '+' : ''}₩{(pos.unrealizedPL || 0).toLocaleString()}
                                                            </td>
                                                            <td className={`px-3 py-2 text-right font-bold ${pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/5 rounded-lg p-6 text-center">
                                    <PieChart size={32} className="mx-auto text-blue-400/50 mb-2" />
                                    <p className="text-blue-200 text-sm">포지션이 없습니다</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Badge variant={selectedPortfolio.isActive ? 'success' : 'danger'}>
                                    {selectedPortfolio.isActive ? '활성' : '비활성'}
                                </Badge>
                                <span className="text-xs text-blue-200">
                                    마지막 업데이트: {new Date(selectedPortfolio.updatedAt || selectedPortfolio.createdAt).toLocaleString('ko-KR')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { handleToggleActive(selectedPortfolio); setSelectedPortfolio(null); }}
                                    className="px-3 py-1.5 text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40 rounded-lg flex items-center gap-1 transition-colors"
                                >
                                    <Edit2 size={12} />
                                    {selectedPortfolio.isActive ? '비활성화' : '활성화'}
                                </button>
                                <button
                                    onClick={() => { handleDelete(selectedPortfolio.id); setSelectedPortfolio(null); }}
                                    className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg flex items-center gap-1 transition-colors"
                                >
                                    <Trash2 size={12} />
                                    삭제
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
