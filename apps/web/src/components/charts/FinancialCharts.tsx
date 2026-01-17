'use client';

import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Area,
} from 'recharts';

interface FinancialData {
    bizYear: string;
    quarter: string;
    totalAssets?: number;
    totalLiabilities?: number;
    totalEquity?: number;
    revenue?: number;
    operatingProfit?: number;
    netIncome?: number;
    eps?: number;
    bps?: number;
}

interface FinancialChartProps {
    data: FinancialData[];
    chartType?: 'assets' | 'income' | 'profitability' | 'perShare';
}

const formatNumber = (value: number) => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}조`;
    if (value >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
    if (value >= 1e4) return `${(value / 1e4).toFixed(1)}만`;
    return value.toLocaleString();
};

const COLORS = {
    assets: '#3b82f6',
    liabilities: '#ef4444',
    equity: '#22c55e',
    revenue: '#6366f1',
    operatingProfit: '#f59e0b',
    netIncome: '#10b981',
    eps: '#8b5cf6',
    bps: '#ec4899',
};

export function FinancialAssetsChart({ data }: { data: FinancialData[] }) {
    const chartData = data.map(d => ({
        period: `${d.bizYear} ${d.quarter}`,
        자산: d.totalAssets,
        부채: d.totalLiabilities,
        자본: d.totalEquity,
    })).reverse();

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={formatNumber} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [formatNumber(value), '']}
                    />
                    <Legend />
                    <Bar dataKey="자산" fill={COLORS.assets} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="부채" fill={COLORS.liabilities} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="자본" fill={COLORS.equity} radius={[4, 4, 0, 0]} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

export function FinancialIncomeChart({ data }: { data: FinancialData[] }) {
    const chartData = data.map(d => ({
        period: `${d.bizYear} ${d.quarter}`,
        매출액: d.revenue,
        영업이익: d.operatingProfit,
        당기순이익: d.netIncome,
    })).reverse();

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={formatNumber} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [formatNumber(value), '']}
                    />
                    <Legend />
                    <Bar dataKey="매출액" fill={COLORS.revenue} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="영업이익" stroke={COLORS.operatingProfit} strokeWidth={2} dot={{ fill: COLORS.operatingProfit }} />
                    <Line type="monotone" dataKey="당기순이익" stroke={COLORS.netIncome} strokeWidth={2} dot={{ fill: COLORS.netIncome }} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

export function FinancialProfitabilityChart({ data }: { data: FinancialData[] }) {
    const chartData = data.map(d => {
        const operatingMargin = d.revenue && d.operatingProfit ? (d.operatingProfit / d.revenue) * 100 : 0;
        const netMargin = d.revenue && d.netIncome ? (d.netIncome / d.revenue) * 100 : 0;
        const roe = d.totalEquity && d.netIncome ? (d.netIncome / d.totalEquity) * 100 : 0;
        return {
            period: `${d.bizYear} ${d.quarter}`,
            영업이익률: Number(operatingMargin.toFixed(2)),
            순이익률: Number(netMargin.toFixed(2)),
            ROE: Number(roe.toFixed(2)),
        };
    }).reverse();

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="영업이익률" stroke={COLORS.operatingProfit} strokeWidth={2} dot={{ fill: COLORS.operatingProfit }} />
                    <Line type="monotone" dataKey="순이익률" stroke={COLORS.netIncome} strokeWidth={2} dot={{ fill: COLORS.netIncome }} />
                    <Line type="monotone" dataKey="ROE" stroke={COLORS.eps} strokeWidth={2} dot={{ fill: COLORS.eps }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export function FinancialPerShareChart({ data }: { data: FinancialData[] }) {
    const chartData = data.map(d => ({
        period: `${d.bizYear} ${d.quarter}`,
        EPS: d.eps,
        BPS: d.bps,
    })).reverse();

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={formatNumber} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={formatNumber} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [formatNumber(value), '']}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="EPS" fill={COLORS.eps} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="BPS" stroke={COLORS.bps} strokeWidth={2} dot={{ fill: COLORS.bps }} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

export function FinancialCharts({ data }: FinancialChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="text-center text-gray-400 py-12">
                재무 데이터가 없습니다. 데이터 수집 페이지에서 &quot;재무요약&quot;을 먼저 수집해주세요.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">📊 자산/부채/자본 추이</h3>
                <FinancialAssetsChart data={data} />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">📈 매출 및 이익 추이</h3>
                <FinancialIncomeChart data={data} />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">📉 수익성 지표 추이</h3>
                <FinancialProfitabilityChart data={data} />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">💰 주당 지표 추이</h3>
                <FinancialPerShareChart data={data} />
            </div>
        </div>
    );
}
