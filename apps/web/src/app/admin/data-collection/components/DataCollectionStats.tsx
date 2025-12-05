'use client';

import { Card } from '@/components/ui/Card';

interface StatsCardProps {
    title: string;
    value: number | string;
    description?: string;
    icon: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    loading?: boolean;
}

const variantStyles = {
    default: 'from-slate-500/20 to-slate-600/20 border-slate-500/30',
    success: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30',
    warning: 'from-amber-500/20 to-amber-600/20 border-amber-500/30',
    danger: 'from-red-500/20 to-red-600/20 border-red-500/30',
    info: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
};

const iconBgStyles = {
    default: 'bg-slate-500/20 text-slate-400',
    success: 'bg-emerald-500/20 text-emerald-400',
    warning: 'bg-amber-500/20 text-amber-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
};

export function StatsCard({ title, value, description, icon, variant = 'default', loading = false }: StatsCardProps) {
    return (
        <Card className={`relative overflow-hidden bg-gradient-to-br ${variantStyles[variant]} border`}>
            <div className="p-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-medium text-gray-400">{title}</p>
                        {loading ? (
                            <div className="h-5 w-16 bg-gray-700/50 rounded animate-pulse mt-1" />
                        ) : (
                            <p className="text-lg font-bold text-white mt-0.5">
                                {typeof value === 'number' ? value.toLocaleString() : value}
                            </p>
                        )}
                        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
                    </div>
                    <div className={`p-2 rounded-lg ${iconBgStyles[variant]}`}>{icon}</div>
                </div>
            </div>
        </Card>
    );
}

interface DataCollectionStatsProps {
    stats: {
        totalStocks: number;
        activeStocks: number;
        totalCandles: number;
        todayCollected: number;
        pendingJobs: number;
        activeJobs: number;
        completedJobs: number;
        failedJobs: number;
        lastCollectionTime: string | null;
        queueHealth: 'healthy' | 'busy' | 'warning';
    } | null;
    loading?: boolean;
}

export function DataCollectionStats({ stats, loading }: DataCollectionStatsProps) {
    const formatTime = (dateString: string | null) => {
        if (!dateString) return '기록 없음';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}시간 전`;
        return date.toLocaleDateString('ko-KR');
    };

    const getQueueHealthVariant = (health: string) => {
        switch (health) {
            case 'healthy': return 'success';
            case 'busy': return 'warning';
            case 'warning': return 'danger';
            default: return 'default';
        }
    };

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard
                title="총 등록 종목"
                value={stats?.totalStocks ?? 0}
                description={`활성: ${stats?.activeStocks ?? 0}`}
                icon={<StockIcon />}
                variant="info"
                loading={loading}
            />
            <StatsCard
                title="오늘 수집"
                value={stats?.todayCollected ?? 0}
                description={`전체: ${(stats?.totalCandles ?? 0).toLocaleString()}`}
                icon={<ChartIcon />}
                variant="success"
                loading={loading}
            />
            <StatsCard
                title="대기 작업"
                value={(stats?.pendingJobs ?? 0) + (stats?.activeJobs ?? 0)}
                description={`활성: ${stats?.activeJobs ?? 0} / 대기: ${stats?.pendingJobs ?? 0}`}
                icon={<QueueIcon />}
                variant={stats?.pendingJobs && stats.pendingJobs > 50 ? 'warning' : 'default'}
                loading={loading}
            />
            <StatsCard
                title="마지막 수집"
                value={stats ? formatTime(stats.lastCollectionTime) : '-'}
                description={stats?.failedJobs ? `실패: ${stats.failedJobs}건` : '정상'}
                icon={<ClockIcon />}
                variant={stats ? getQueueHealthVariant(stats.queueHealth) : 'default'}
                loading={loading}
            />
        </div>
    );
}

function StockIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
    );
}

function ChartIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
    );
}

function QueueIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}
