'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';
import { 
    Zap, Play, Pause, Trash2, Eye, RefreshCw, User, TrendingUp, TrendingDown,
    Search, Filter, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    X, AlertCircle, Target, Activity, BarChart3, Brain, Settings, Clock, Copy,
    Edit2, Save, RotateCcw, Percent, DollarSign, Shield, Sliders, Info
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

type SortField = 'name' | 'type' | 'winRate' | 'backtestReturn' | 'sharpeRatio' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'INDICATOR_BASED' | 'AI_BASED' | 'HYBRID';
type FilterStatus = 'all' | 'active' | 'inactive';

const strategyTypes: Record<string, { label: string; color: string; icon: any }> = {
    'INDICATOR_BASED': { label: '지표 기반', color: 'text-blue-400 bg-blue-500/20', icon: BarChart3 },
    'AI_BASED': { label: 'AI 기반', color: 'text-purple-400 bg-purple-500/20', icon: Brain },
    'HYBRID': { label: '하이브리드', color: 'text-cyan-400 bg-cyan-500/20', icon: Zap },
};

// Optimal parameter ranges for different strategy types
const optimalRanges: Record<string, any> = {
    stopLossPercent: { min: 2, max: 10, optimal: 5, step: 0.5, label: '손절 비율 (%)', description: '2-5%가 일반적으로 최적' },
    takeProfitPercent: { min: 5, max: 50, optimal: 15, step: 1, label: '익절 비율 (%)', description: '손절의 2-3배 권장' },
    maxPositionSize: { min: 1000000, max: 50000000, optimal: 10000000, step: 1000000, label: '최대 포지션 (₩)', description: '총 자산의 10-20% 권장' },
    winRate: { min: 40, max: 80, optimal: 55, label: '승률 (%)', description: '50% 이상일 때 수익 가능' },
    backtestReturn: { min: -50, max: 100, optimal: 20, label: '수익률 (%)', description: '연 15-25%가 우수' },
    sharpeRatio: { min: 0, max: 3, optimal: 1.5, label: '샤프 비율', description: '1.0 이상이 양호, 2.0 이상 우수' },
};

// Indicator-specific optimal parameters
const indicatorDefaults: Record<string, any> = {
    RSI: { period: 14, oversold: 30, overbought: 70, description: '14일 기간, 30/70 기준이 표준' },
    MACD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, description: '12/26/9가 전통적 설정' },
    BOLLINGER_BANDS: { period: 20, stdDev: 2, description: '20일, 2표준편차가 표준' },
    SMA: { shortPeriod: 5, mediumPeriod: 20, longPeriod: 60, description: '5/20/60 또는 20/50/200' },
    EMA: { shortPeriod: 12, longPeriod: 26, description: '12/26이 MACD 기반' },
    STOCHASTIC: { kPeriod: 14, dPeriod: 3, slowing: 3, oversold: 20, overbought: 80, description: '14/3/3, 20/80 기준' },
    ATR: { period: 14, multiplier: 2, description: '14일 기간, 2배수가 표준' },
    ADX: { period: 14, trendThreshold: 25, description: '14일, 25 이상이 강한 추세' },
};

export default function AdminStrategies() {
    const { data: strategies, mutate, isLoading, error } = useSWR('/api/admin/strategies', fetcher, {
        refreshInterval: 30000,
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
    const [sortField, setSortField] = useState<SortField>('backtestReturn');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editValues, setEditValues] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const itemsPerPage = 10;

    // Process and filter strategies
    const processedStrategies = useMemo(() => {
        if (!Array.isArray(strategies)) return [];
        
        let result = [...strategies];
        
        if (searchTerm) {
            result = result.filter((s: any) =>
                s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        if (filterType !== 'all') {
            result = result.filter((s: any) => s.type === filterType);
        }
        
        if (filterStatus !== 'all') {
            result = result.filter((s: any) => 
                filterStatus === 'active' ? s.isActive : !s.isActive
            );
        }
        
        result.sort((a: any, b: any) => {
            let aVal: any, bVal: any;
            switch (sortField) {
                case 'name': aVal = a.name?.toLowerCase() || ''; bVal = b.name?.toLowerCase() || ''; break;
                case 'type': aVal = a.type || ''; bVal = b.type || ''; break;
                case 'winRate': aVal = parseFloat(a.winRate) || 0; bVal = parseFloat(b.winRate) || 0; break;
                case 'backtestReturn': aVal = parseFloat(a.backtestReturn) || 0; bVal = parseFloat(b.backtestReturn) || 0; break;
                case 'sharpeRatio': aVal = parseFloat(a.sharpeRatio) || 0; bVal = parseFloat(b.sharpeRatio) || 0; break;
                case 'createdAt': aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
                default: return 0;
            }
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        return result;
    }, [strategies, searchTerm, filterType, filterStatus, sortField, sortDirection]);

    const totalPages = Math.ceil(processedStrategies.length / itemsPerPage);
    const paginatedStrategies = processedStrategies.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const stats = useMemo(() => {
        if (!Array.isArray(strategies)) return {
            total: 0, active: 0, avgWinRate: 0, avgReturn: 0, avgSharpe: 0,
            byType: { INDICATOR_BASED: 0, AI_BASED: 0, HYBRID: 0 },
            bestPerformer: null, topWinRate: null
        };
        
        const active = strategies.filter((s: any) => s.isActive).length;
        const avgWinRate = strategies.length > 0
            ? strategies.reduce((sum: number, s: any) => sum + (parseFloat(s.winRate) || 0), 0) / strategies.length : 0;
        const avgReturn = strategies.length > 0
            ? strategies.reduce((sum: number, s: any) => sum + (parseFloat(s.backtestReturn) || 0), 0) / strategies.length : 0;
        const avgSharpe = strategies.length > 0
            ? strategies.reduce((sum: number, s: any) => sum + (parseFloat(s.sharpeRatio) || 0), 0) / strategies.length : 0;
            
        const byType = {
            INDICATOR_BASED: strategies.filter((s: any) => s.type === 'INDICATOR_BASED').length,
            AI_BASED: strategies.filter((s: any) => s.type === 'AI_BASED').length,
            HYBRID: strategies.filter((s: any) => s.type === 'HYBRID').length,
        };
        
        const sorted = [...strategies].sort((a: any, b: any) => 
            (parseFloat(b.backtestReturn) || 0) - (parseFloat(a.backtestReturn) || 0)
        );
        const bestPerformer = sorted[0] || null;
        
        return { total: strategies.length, active, avgWinRate, avgReturn, avgSharpe, byType, bestPerformer };
    }, [strategies]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/strategies/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify({ isActive: !isActive }),
        });
        mutate();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 전략을 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/strategies/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        mutate();
    };

    const startEdit = (strategy: any) => {
        setEditValues({
            stopLossPercent: parseFloat(strategy.stopLossPercent) || 5,
            takeProfitPercent: parseFloat(strategy.takeProfitPercent) || 10,
            maxPositionSize: parseFloat(strategy.maxPositionSize) || 10000000,
            config: strategy.config || {},
        });
        setEditMode(true);
    };

    const handleSave = async () => {
        if (!selectedStrategy) return;
        setIsSaving(true);
        
        const token = localStorage.getItem('token');
        try {
            await fetch(`/api/admin/strategies/${selectedStrategy.id}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': token ? `Bearer ${token}` : '' 
                },
                body: JSON.stringify({
                    stopLossPercent: editValues.stopLossPercent,
                    takeProfitPercent: editValues.takeProfitPercent,
                    maxPositionSize: editValues.maxPositionSize,
                    config: editValues.config,
                }),
            });
            mutate();
            setEditMode(false);
            // Update selected strategy with new values
            setSelectedStrategy({
                ...selectedStrategy,
                stopLossPercent: editValues.stopLossPercent,
                takeProfitPercent: editValues.takeProfitPercent,
                maxPositionSize: editValues.maxPositionSize,
                config: editValues.config,
            });
        } catch (e) {
            alert('저장에 실패했습니다');
        } finally {
            setIsSaving(false);
        }
    };

    const applyOptimalValues = () => {
        setEditValues({
            ...editValues,
            stopLossPercent: optimalRanges.stopLossPercent.optimal,
            takeProfitPercent: optimalRanges.takeProfitPercent.optimal,
            maxPositionSize: optimalRanges.maxPositionSize.optimal,
        });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterType('all');
        setFilterStatus('all');
        setCurrentPage(1);
    };

    const hasActiveFilters = searchTerm || filterType !== 'all' || filterStatus !== 'all';

    const getScoreColor = (value: number, range: any) => {
        if (range.optimal) {
            const distance = Math.abs(value - range.optimal) / (range.max - range.min);
            if (distance < 0.2) return 'text-green-400';
            if (distance < 0.4) return 'text-yellow-400';
            return 'text-orange-400';
        }
        return 'text-white';
    };

    const getPerformanceGrade = (strategy: any) => {
        const winRate = parseFloat(strategy.winRate) || 0;
        const returns = parseFloat(strategy.backtestReturn) || 0;
        const sharpe = parseFloat(strategy.sharpeRatio) || 0;
        
        const score = (winRate / 20) + (returns / 10) + (sharpe * 2);
        if (score >= 12) return { grade: 'S', color: 'text-purple-400 bg-purple-500/30', desc: '최우수' };
        if (score >= 10) return { grade: 'A', color: 'text-green-400 bg-green-500/30', desc: '우수' };
        if (score >= 7) return { grade: 'B', color: 'text-blue-400 bg-blue-500/30', desc: '양호' };
        if (score >= 5) return { grade: 'C', color: 'text-yellow-400 bg-yellow-500/30', desc: '보통' };
        return { grade: 'D', color: 'text-red-400 bg-red-500/30', desc: '개선필요' };
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

    const TypeBadge = ({ type }: { type: string }) => {
        const typeInfo = strategyTypes[type] || { label: type, color: 'text-gray-400 bg-gray-500/20', icon: Settings };
        const Icon = typeInfo.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${typeInfo.color}`}>
                <Icon size={10} />
                {typeInfo.label}
            </span>
        );
    };

    const MetricBar = ({ value, min, max, optimal, label, unit = '' }: any) => {
        const percentage = ((value - min) / (max - min)) * 100;
        const optimalPercentage = ((optimal - min) / (max - min)) * 100;
        const isNearOptimal = Math.abs(value - optimal) / (max - min) < 0.2;
        
        return (
            <div className="space-y-1">
                <div className="flex justify-between text-xs">
                    <span className="text-blue-200">{label}</span>
                    <span className={isNearOptimal ? 'text-green-400' : 'text-white'}>
                        {typeof value === 'number' && value >= 1000000 
                            ? `₩${(value / 10000).toLocaleString()}만` 
                            : `${value}${unit}`}
                    </span>
                </div>
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className={`absolute h-full rounded-full transition-all ${isNearOptimal ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                    />
                    {/* Optimal marker */}
                    <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
                        style={{ left: `${optimalPercentage}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-blue-300/50">
                    <span>{min}{unit}</span>
                    <span className="text-yellow-400">최적: {optimal}{unit}</span>
                    <span>{max}{unit}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap size={24} className="text-purple-400" />
                        전략 관리
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">자동매매 전략 상세 수치 관리 및 최적화</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 transition-all ${
                            showFilters ? 'bg-purple-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        <Filter size={14} />
                        필터
                        {hasActiveFilters && <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>}
                    </button>
                    <button 
                        onClick={() => mutate()} 
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1 transition-all"
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
                    <button onClick={() => mutate()} className="ml-auto px-3 py-1 text-xs bg-red-500/30 hover:bg-red-500/50 text-red-200 rounded-lg">재시도</button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap size={14} className="text-purple-400" />
                        <p className="text-xs text-blue-200">총 전략</p>
                    </div>
                    <p className="text-xl font-bold text-white">{stats.total}</p>
                    <p className="text-xs text-blue-300/70">{stats.active} 활성</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <Target size={14} className="text-green-400" />
                        <p className="text-xs text-blue-200">평균 승률</p>
                    </div>
                    <p className={`text-xl font-bold ${stats.avgWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.avgWinRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-blue-300/70">최적: 55%+</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-cyan-400" />
                        <p className="text-xs text-blue-200">평균 수익률</p>
                    </div>
                    <p className={`text-xl font-bold ${stats.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.avgReturn >= 0 ? '+' : ''}{stats.avgReturn.toFixed(1)}%
                    </p>
                    <p className="text-xs text-blue-300/70">최적: 15-25%</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity size={14} className="text-yellow-400" />
                        <p className="text-xs text-blue-200">평균 샤프</p>
                    </div>
                    <p className={`text-xl font-bold ${stats.avgSharpe >= 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {stats.avgSharpe.toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-300/70">최적: 1.5+</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 hover:bg-white/15 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={14} className="text-blue-400" />
                        <p className="text-xs text-blue-200">타입별 분포</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                        <span className="text-blue-400">{stats.byType.INDICATOR_BASED}</span>
                        <span className="text-purple-400">{stats.byType.AI_BASED}</span>
                        <span className="text-cyan-400">{stats.byType.HYBRID}</span>
                    </div>
                    <p className="text-xs text-blue-300/70">지표/AI/하이브리드</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-lg border border-purple-500/30 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-purple-400" />
                        <p className="text-xs text-blue-200">최고 성과</p>
                    </div>
                    <p className="text-sm font-bold text-white truncate">{stats.bestPerformer?.name || '-'}</p>
                    <p className="text-xs text-green-400">{stats.bestPerformer ? `+${parseFloat(stats.bestPerformer.backtestReturn).toFixed(1)}%` : '-'}</p>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white">필터 옵션</h3>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="text-xs text-blue-300 hover:text-white flex items-center gap-1">
                                <X size={12} />초기화
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/50" />
                            <input 
                                type="text" 
                                placeholder="전략명, 사용자 검색..." 
                                value={searchTerm} 
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-9 pr-3 py-2 text-xs bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300/50" 
                            />
                        </div>
                        <select
                            value={filterType}
                            onChange={(e) => { setFilterType(e.target.value as FilterType); setCurrentPage(1); }}
                            className="px-3 py-2 text-xs bg-white/5 border border-white/20 rounded-lg text-white"
                        >
                            <option value="all">모든 타입</option>
                            <option value="INDICATOR_BASED">지표 기반</option>
                            <option value="AI_BASED">AI 기반</option>
                            <option value="HYBRID">하이브리드</option>
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value as FilterStatus); setCurrentPage(1); }}
                            className="px-3 py-2 text-xs bg-white/5 border border-white/20 rounded-lg text-white"
                        >
                            <option value="all">모든 상태</option>
                            <option value="active">활성만</option>
                            <option value="inactive">비활성만</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Quick Search */}
            {!showFilters && (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/50" />
                        <input 
                            type="text" 
                            placeholder="전략명, 사용자 검색..." 
                            value={searchTerm} 
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300/50" 
                        />
                    </div>
                </div>
            )}

            {/* Results Summary */}
            <div className="flex items-center justify-between text-xs text-blue-200">
                <p>{processedStrategies.length}개 결과 {hasActiveFilters && `(전체 ${stats.total}개 중)`}</p>
                <p>페이지 {currentPage} / {totalPages || 1}</p>
            </div>

            {/* Table */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-white/5">
                            <tr>
                                <SortableHeader field="name" className="text-left">전략명</SortableHeader>
                                <SortableHeader field="type" className="text-left">타입</SortableHeader>
                                <th className="px-3 py-2 text-center text-blue-200">등급</th>
                                <SortableHeader field="winRate" className="text-right">승률</SortableHeader>
                                <SortableHeader field="backtestReturn" className="text-right">수익률</SortableHeader>
                                <SortableHeader field="sharpeRatio" className="text-right">샤프</SortableHeader>
                                <th className="px-3 py-2 text-center text-blue-200">손절/익절</th>
                                <th className="px-3 py-2 text-center text-blue-200">상태</th>
                                <th className="px-3 py-2 text-right text-blue-200">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {isLoading ? (
                                <tr><td colSpan={9} className="px-3 py-12 text-center text-blue-200">
                                    <RefreshCw className="animate-spin mx-auto mb-2" size={24} />로딩 중...
                                </td></tr>
                            ) : paginatedStrategies.length === 0 ? (
                                <tr><td colSpan={9} className="px-3 py-12 text-center text-blue-200">
                                    <Zap className="mx-auto mb-2 opacity-50" size={32} />
                                    {hasActiveFilters ? '검색 결과가 없습니다' : '전략이 없습니다'}
                                </td></tr>
                            ) : (
                                paginatedStrategies.map((strategy: any) => {
                                    const grade = getPerformanceGrade(strategy);
                                    return (
                                        <tr key={strategy.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-3 py-2.5">
                                                <div className="text-white font-medium">{strategy.name}</div>
                                                <div className="text-blue-300/70 truncate max-w-[180px]">{strategy.description?.slice(0, 35) || '-'}</div>
                                            </td>
                                            <td className="px-3 py-2.5"><TypeBadge type={strategy.type} /></td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${grade.color}`}>
                                                    {grade.grade}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className={`font-medium ${parseFloat(strategy.winRate) >= 60 ? 'text-green-400' : parseFloat(strategy.winRate) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {parseFloat(strategy.winRate || 0).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className={`font-medium ${parseFloat(strategy.backtestReturn) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {parseFloat(strategy.backtestReturn) >= 0 ? '+' : ''}{parseFloat(strategy.backtestReturn || 0).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className={`font-medium ${parseFloat(strategy.sharpeRatio) >= 1.5 ? 'text-green-400' : parseFloat(strategy.sharpeRatio) >= 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                                    {parseFloat(strategy.sharpeRatio || 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className="text-red-400">{strategy.stopLossPercent || '-'}%</span>
                                                <span className="text-blue-300/50 mx-1">/</span>
                                                <span className="text-green-400">{strategy.takeProfitPercent || '-'}%</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button onClick={() => handleToggle(strategy.id, strategy.isActive)}>
                                                    <Badge variant={strategy.isActive ? 'success' : 'danger'} size="sm" className="cursor-pointer hover:opacity-80">
                                                        {strategy.isActive ? '활성' : '비활성'}
                                                    </Badge>
                                                </button>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button 
                                                        onClick={() => { setSelectedStrategy(strategy); setEditMode(false); }}
                                                        className="p-1.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded"
                                                        title="상세/수정"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleToggle(strategy.id, strategy.isActive)}
                                                        className={`p-1.5 text-xs rounded ${strategy.isActive ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40' : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'}`}
                                                    >
                                                        {strategy.isActive ? <Pause size={14} /> : <Play size={14} />}
                                                    </button>
                                                    <button onClick={() => handleDelete(strategy.id)} className="p-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-xs text-blue-200">
                        {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, processedStrategies.length)} / {processedStrategies.length}개
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 text-xs bg-white/10 text-blue-200 hover:bg-white/20 disabled:opacity-30 rounded">
                            <ChevronLeft size={14} /><ChevronLeft size={14} className="-ml-2" />
                        </button>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 text-xs bg-white/10 text-blue-200 hover:bg-white/20 disabled:opacity-30 rounded">
                            <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                            return (
                                <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                                    className={`px-2.5 py-1 text-xs rounded ${currentPage === pageNum ? 'bg-purple-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'}`}
                                >{pageNum}</button>
                            );
                        })}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 text-xs bg-white/10 text-blue-200 hover:bg-white/20 disabled:opacity-30 rounded">
                            <ChevronRight size={14} />
                        </button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 text-xs bg-white/10 text-blue-200 hover:bg-white/20 disabled:opacity-30 rounded">
                            <ChevronRight size={14} /><ChevronRight size={14} className="-ml-2" />
                        </button>
                    </div>
                </div>
            )}

            {/* Enhanced Detail Modal */}
            {selectedStrategy && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setSelectedStrategy(null); setEditMode(false); }}>
                    <div 
                        className="bg-slate-900/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Zap size={20} className="text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">{selectedStrategy.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <TypeBadge type={selectedStrategy.type} />
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${getPerformanceGrade(selectedStrategy).color}`}>
                                            등급 {getPerformanceGrade(selectedStrategy).grade}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!editMode ? (
                                    <button 
                                        onClick={() => startEdit(selectedStrategy)}
                                        className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1"
                                    >
                                        <Edit2 size={12} />
                                        수정
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => setEditMode(false)}
                                            className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-1"
                                        >
                                            <X size={12} />
                                            취소
                                        </button>
                                        <button 
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Save size={12} />
                                            {isSaving ? '저장 중...' : '저장'}
                                        </button>
                                    </>
                                )}
                                <button onClick={() => { setSelectedStrategy(null); setEditMode(false); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            {/* Description */}
                            {selectedStrategy.description && (
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm text-blue-200">{selectedStrategy.description}</p>
                                </div>
                            )}

                            {/* Performance Metrics with Visualization */}
                            <div>
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Activity size={14} className="text-cyan-400" />
                                    성능 지표
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <MetricBar 
                                        value={parseFloat(selectedStrategy.winRate) || 0}
                                        min={optimalRanges.winRate.min}
                                        max={optimalRanges.winRate.max}
                                        optimal={optimalRanges.winRate.optimal}
                                        label="승률"
                                        unit="%"
                                    />
                                    <MetricBar 
                                        value={parseFloat(selectedStrategy.backtestReturn) || 0}
                                        min={optimalRanges.backtestReturn.min}
                                        max={optimalRanges.backtestReturn.max}
                                        optimal={optimalRanges.backtestReturn.optimal}
                                        label="수익률"
                                        unit="%"
                                    />
                                    <MetricBar 
                                        value={parseFloat(selectedStrategy.sharpeRatio) || 0}
                                        min={optimalRanges.sharpeRatio.min}
                                        max={optimalRanges.sharpeRatio.max}
                                        optimal={optimalRanges.sharpeRatio.optimal}
                                        label="샤프 비율"
                                    />
                                </div>
                            </div>

                            {/* Risk Management - Editable */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <Shield size={14} className="text-orange-400" />
                                        리스크 관리
                                    </h3>
                                    {editMode && (
                                        <button 
                                            onClick={applyOptimalValues}
                                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                        >
                                            <Sliders size={12} />
                                            최적값 적용
                                        </button>
                                    )}
                                </div>
                                
                                {editMode ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Stop Loss */}
                                        <div className="bg-white/5 rounded-lg p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs text-blue-200 flex items-center gap-1">
                                                    <Percent size={12} className="text-red-400" />
                                                    손절 비율
                                                </label>
                                                <span className="text-xs text-yellow-400">최적: 5%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={optimalRanges.stopLossPercent.min}
                                                max={optimalRanges.stopLossPercent.max}
                                                step={optimalRanges.stopLossPercent.step}
                                                value={editValues.stopLossPercent}
                                                onChange={(e) => setEditValues({ ...editValues, stopLossPercent: parseFloat(e.target.value) })}
                                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                                            />
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={editValues.stopLossPercent}
                                                    onChange={(e) => setEditValues({ ...editValues, stopLossPercent: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-2 py-1 text-sm bg-black/30 border border-white/20 rounded text-white text-center"
                                                />
                                                <span className="text-white">%</span>
                                            </div>
                                            <p className="text-[10px] text-blue-300/50">{optimalRanges.stopLossPercent.description}</p>
                                        </div>

                                        {/* Take Profit */}
                                        <div className="bg-white/5 rounded-lg p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs text-blue-200 flex items-center gap-1">
                                                    <Percent size={12} className="text-green-400" />
                                                    익절 비율
                                                </label>
                                                <span className="text-xs text-yellow-400">최적: 15%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={optimalRanges.takeProfitPercent.min}
                                                max={optimalRanges.takeProfitPercent.max}
                                                step={optimalRanges.takeProfitPercent.step}
                                                value={editValues.takeProfitPercent}
                                                onChange={(e) => setEditValues({ ...editValues, takeProfitPercent: parseFloat(e.target.value) })}
                                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-500"
                                            />
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={editValues.takeProfitPercent}
                                                    onChange={(e) => setEditValues({ ...editValues, takeProfitPercent: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-2 py-1 text-sm bg-black/30 border border-white/20 rounded text-white text-center"
                                                />
                                                <span className="text-white">%</span>
                                            </div>
                                            <p className="text-[10px] text-blue-300/50">{optimalRanges.takeProfitPercent.description}</p>
                                        </div>

                                        {/* Max Position */}
                                        <div className="bg-white/5 rounded-lg p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs text-blue-200 flex items-center gap-1">
                                                    <DollarSign size={12} className="text-purple-400" />
                                                    최대 포지션
                                                </label>
                                                <span className="text-xs text-yellow-400">최적: 1천만원</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={optimalRanges.maxPositionSize.min}
                                                max={optimalRanges.maxPositionSize.max}
                                                step={optimalRanges.maxPositionSize.step}
                                                value={editValues.maxPositionSize}
                                                onChange={(e) => setEditValues({ ...editValues, maxPositionSize: parseFloat(e.target.value) })}
                                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                            />
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={editValues.maxPositionSize / 10000}
                                                    onChange={(e) => setEditValues({ ...editValues, maxPositionSize: (parseFloat(e.target.value) || 0) * 10000 })}
                                                    className="w-full px-2 py-1 text-sm bg-black/30 border border-white/20 rounded text-white text-center"
                                                />
                                                <span className="text-white text-sm">만원</span>
                                            </div>
                                            <p className="text-[10px] text-blue-300/50">{optimalRanges.maxPositionSize.description}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <MetricBar 
                                            value={parseFloat(selectedStrategy.stopLossPercent) || 0}
                                            min={optimalRanges.stopLossPercent.min}
                                            max={optimalRanges.stopLossPercent.max}
                                            optimal={optimalRanges.stopLossPercent.optimal}
                                            label="손절 비율"
                                            unit="%"
                                        />
                                        <MetricBar 
                                            value={parseFloat(selectedStrategy.takeProfitPercent) || 0}
                                            min={optimalRanges.takeProfitPercent.min}
                                            max={optimalRanges.takeProfitPercent.max}
                                            optimal={optimalRanges.takeProfitPercent.optimal}
                                            label="익절 비율"
                                            unit="%"
                                        />
                                        <MetricBar 
                                            value={parseFloat(selectedStrategy.maxPositionSize) || 0}
                                            min={optimalRanges.maxPositionSize.min}
                                            max={optimalRanges.maxPositionSize.max}
                                            optimal={optimalRanges.maxPositionSize.optimal}
                                            label="최대 포지션"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Indicator Parameters Reference */}
                            {selectedStrategy.type === 'INDICATOR_BASED' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                        <Info size={14} className="text-blue-400" />
                                        지표별 최적 파라미터 가이드
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {Object.entries(indicatorDefaults).map(([key, value]: [string, any]) => (
                                            <div key={key} className="bg-white/5 rounded-lg p-2">
                                                <p className="text-xs font-medium text-purple-400">{key}</p>
                                                <p className="text-[10px] text-blue-200 mt-1">{value.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Strategy Config */}
                            {selectedStrategy.config && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                            <Settings size={14} className="text-blue-400" />
                                            전략 설정 (JSON)
                                        </h3>
                                        <button 
                                            onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedStrategy.config, null, 2))}
                                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            <Copy size={12} />복사
                                        </button>
                                    </div>
                                    <pre className="bg-black/30 rounded-lg p-3 text-xs text-blue-200 overflow-auto max-h-[200px]">
                                        {JSON.stringify(selectedStrategy.config, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* User & Timestamp */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-blue-300/70">
                                <div className="flex items-center gap-1">
                                    <User size={12} />
                                    {selectedStrategy.user?.email}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock size={12} />
                                    생성: {new Date(selectedStrategy.createdAt).toLocaleString('ko-KR')}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Badge variant={selectedStrategy.isActive ? 'success' : 'danger'}>
                                    {selectedStrategy.isActive ? '활성' : '비활성'}
                                </Badge>
                                {selectedStrategy.isBacktested && <Badge variant="default">백테스트 완료</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { handleToggle(selectedStrategy.id, selectedStrategy.isActive); setSelectedStrategy(null); }}
                                    className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${
                                        selectedStrategy.isActive ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40' : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'
                                    }`}
                                >
                                    {selectedStrategy.isActive ? <Pause size={12} /> : <Play size={12} />}
                                    {selectedStrategy.isActive ? '일시정지' : '활성화'}
                                </button>
                                <button
                                    onClick={() => { handleDelete(selectedStrategy.id); setSelectedStrategy(null); }}
                                    className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg flex items-center gap-1"
                                >
                                    <Trash2 size={12} />삭제
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
