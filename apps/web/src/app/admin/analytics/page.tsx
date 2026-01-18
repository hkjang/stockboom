'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
    PieChart, BarChart2, TrendingUp, TrendingDown, DollarSign,
    AlertTriangle, Target, Shield, RefreshCw, AlertCircle
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface PortfolioMetrics {
    totalValue: number;
    totalCost: number;
    totalPnL: number;
    totalPnLPercent: number;
    sharpeRatio: number;
    maxDrawdown: number;
    beta: number;
    alpha: number;
    volatility: number;
    correlationWithKospi: number;
}

interface SectorAllocation {
    sector: string;
    value: number;
    percent: number;
    change: number;
}

interface RiskMetric {
    name: string;
    value: string | number;
    status: 'good' | 'warning' | 'danger';
    description: string;
}

export default function PortfolioAnalyticsPage() {
    const { data, mutate, isLoading, error } = useSWR('/api/admin/portfolio/analytics', fetcher);
    const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'YTD'>('1Y');

    const metrics: PortfolioMetrics = data?.metrics || {
        totalValue: 0, totalCost: 0, totalPnL: 0, totalPnLPercent: 0,
        sharpeRatio: 0, maxDrawdown: 0, beta: 0, alpha: 0, volatility: 0, correlationWithKospi: 0,
    };
    const sectorAllocation: SectorAllocation[] = data?.sectors || [];
    const topHoldings = data?.topHoldings || [];
    const isRealData = !!data?.portfolioCount;

    const riskMetrics: RiskMetric[] = [
        { name: '집중도 위험', value: topHoldings.length > 0 && topHoldings[0]?.percent > 30 ? '높음' : '보통', status: topHoldings[0]?.percent > 30 ? 'warning' : 'good', description: `상위 종목 비중 ${topHoldings[0]?.percent?.toFixed(1) || 0}%` },
        { name: '변동성', value: `${metrics.volatility.toFixed(1)}%`, status: metrics.volatility < 15 ? 'good' : metrics.volatility < 25 ? 'warning' : 'danger', description: 'KOSPI 대비 변동성' },
        { name: '베타', value: metrics.beta.toFixed(2), status: metrics.beta < 1.2 ? 'good' : 'warning', description: '시장 대비 민감도' },
        { name: '최대 낙폭', value: `${metrics.maxDrawdown.toFixed(1)}%`, status: Math.abs(metrics.maxDrawdown) < 10 ? 'good' : Math.abs(metrics.maxDrawdown) < 20 ? 'warning' : 'danger', description: '최악의 기간 손실률' },
        { name: '샤프 비율', value: metrics.sharpeRatio.toFixed(2), status: metrics.sharpeRatio > 1.5 ? 'good' : metrics.sharpeRatio > 1.0 ? 'warning' : 'danger', description: '위험 대비 초과수익' },
        { name: '알파', value: `${metrics.alpha > 0 ? '+' : ''}${metrics.alpha.toFixed(1)}%`, status: metrics.alpha > 0 ? 'good' : 'danger', description: 'KOSPI 대비 초과수익' },
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'good': return 'text-green-400 bg-green-400/20';
            case 'warning': return 'text-yellow-400 bg-yellow-400/20';
            case 'danger': return 'text-red-400 bg-red-400/20';
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
                        <PieChart size={24} className="text-pink-400" />
                        포트폴리오 분석
                        {isRealData && <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">LIVE</span>}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">수익률, 위험 지표, 자산 배분 분석</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white/10 rounded-lg p-1">
                        {(['1M', '3M', '6M', '1Y', 'YTD'] as const).map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    timeframe === tf ? 'bg-pink-600 text-white' : 'text-blue-200 hover:text-white'
                                }`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => mutate()} 
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center gap-1"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-blue-400" />
                        <span className="text-xs text-blue-200">총 평가액</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                        {metrics.totalValue > 0 ? `₩${(metrics.totalValue / 1e8).toFixed(1)}억` : '-'}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        {metrics.totalPnL >= 0 ? <TrendingUp size={16} className="text-green-400" /> : <TrendingDown size={16} className="text-red-400" />}
                        <span className="text-xs text-blue-200">총 수익</span>
                    </div>
                    <p className={`text-2xl font-bold ${metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {metrics.totalPnL !== 0 ? (metrics.totalPnL >= 0 ? '+' : '') + (metrics.totalPnL / 1e4).toFixed(0) + '만' : '-'}
                    </p>
                    <p className={`text-xs ${metrics.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {metrics.totalPnLPercent !== 0 ? (metrics.totalPnLPercent >= 0 ? '+' : '') + metrics.totalPnLPercent.toFixed(1) + '%' : '-'}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Target size={16} className="text-purple-400" />
                        <span className="text-xs text-blue-200">샤프 비율</span>
                    </div>
                    <p className={`text-2xl font-bold ${metrics.sharpeRatio >= 1.5 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {metrics.sharpeRatio > 0 ? metrics.sharpeRatio.toFixed(2) : '-'}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield size={16} className="text-orange-400" />
                        <span className="text-xs text-blue-200">최대 낙폭</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">
                        {metrics.maxDrawdown !== 0 ? metrics.maxDrawdown.toFixed(1) + '%' : '-'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Sector Allocation */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <BarChart2 size={14} className="text-cyan-400" />
                        업종별 배분
                    </h3>
                    {sectorAllocation.length > 0 ? (
                        <div className="space-y-3">
                            {sectorAllocation.map((sector, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-white text-sm">{sector.sector}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs ${sector.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(1)}%
                                            </span>
                                            <span className="text-blue-200 text-xs">{sector.percent.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${
                                                sector.change >= 0 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-orange-500'
                                            }`}
                                            style={{ width: `${sector.percent}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-blue-200/50 py-8">포트폴리오 데이터가 없습니다</p>
                    )}
                </div>

                {/* Risk Metrics */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-yellow-400" />
                        리스크 지표
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {riskMetrics.map((metric, i) => (
                            <div key={i} className="bg-white/5 rounded-lg p-3">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-blue-200 text-xs">{metric.name}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${getStatusColor(metric.status)}`}>
                                        {metric.status === 'good' ? '양호' : metric.status === 'warning' ? '주의' : '위험'}
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-white">{metric.value}</p>
                                <p className="text-[10px] text-blue-200/50 mt-1">{metric.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Holdings */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <PieChart size={14} className="text-pink-400" />
                    상위 보유 종목
                </h3>
                {topHoldings.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-blue-200/70 text-xs">
                                    <th className="text-left pb-2">종목</th>
                                    <th className="text-right pb-2">평가금액</th>
                                    <th className="text-right pb-2">비중</th>
                                    <th className="text-right pb-2">수익률</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {topHoldings.map((h: any, i: number) => (
                                    <tr key={i} className="hover:bg-white/5">
                                        <td className="py-2">
                                            <div className="text-white font-medium">{h.name}</div>
                                            <div className="text-blue-200/50 text-xs">{h.symbol}</div>
                                        </td>
                                        <td className="py-2 text-right text-white">₩{(h.value / 1e4).toFixed(0)}만</td>
                                        <td className="py-2 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-1.5 bg-white/10 rounded-full">
                                                    <div className="h-full bg-pink-500 rounded-full" style={{ width: `${Math.min(h.percent, 100)}%` }} />
                                                </div>
                                                <span className="text-white w-10 text-right">{h.percent?.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td className={`py-2 text-right font-medium ${h.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {h.pnl >= 0 ? '+' : ''}{h.pnl?.toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-blue-200/50 py-8">보유 종목이 없습니다</p>
                )}
            </div>
        </div>
    );
}
