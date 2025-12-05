'use client';

import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

interface SchedulerTabProps {
    onRefresh: () => void;
}

export function SchedulerTab({ onRefresh }: SchedulerTabProps) {
    const { data, error, isLoading, mutate } = useSWR(
        '/api/admin/scheduler/status',
        fetcher,
        { refreshInterval: 30000 } // Refresh every 30 seconds
    );

    const formatNextRun = (date: string | null) => {
        if (!date) return '알 수 없음';
        const d = new Date(date);
        const now = new Date();
        const diffMs = d.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 0) return '실행 중...';
        if (diffMins < 1) return '곧 실행';
        if (diffMins < 60) return `${diffMins}분 후`;
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const schedulers = data?.schedulers ?? [];
    const queueStatus = data?.queueStatus ?? { waiting: 0, active: 0, completed: 0, failed: 0 };

    return (
        <div className="space-y-6">
            {/* Queue Status */}
            <Card className="bg-gray-800/50 border-gray-700">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-cyan-500/20">
                            <QueueIcon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">데이터 수집 큐 상태</h3>
                            <p className="text-sm text-gray-400">Bull Queue 실시간 상태</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-700/30 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-amber-400">{queueStatus.waiting}</p>
                            <p className="text-sm text-gray-400 mt-1">대기 중</p>
                        </div>
                        <div className="bg-gray-700/30 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-blue-400">{queueStatus.active}</p>
                            <p className="text-sm text-gray-400 mt-1">실행 중</p>
                        </div>
                        <div className="bg-gray-700/30 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-400">{queueStatus.completed}</p>
                            <p className="text-sm text-gray-400 mt-1">완료</p>
                        </div>
                        <div className="bg-gray-700/30 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-red-400">{queueStatus.failed}</p>
                            <p className="text-sm text-gray-400 mt-1">실패</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Scheduler List */}
            <Card className="bg-gray-800/50 border-gray-700">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/20">
                                <ClockIcon className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">자동 수집 스케줄</h3>
                                <p className="text-sm text-gray-400">Cron 기반 자동 데이터 수집</p>
                            </div>
                        </div>
                        <button
                            onClick={() => mutate()}
                            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                        >
                            새로고침
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-16 bg-gray-700/30 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-400">
                            스케줄러 정보를 불러올 수 없습니다
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {schedulers.map((scheduler: any, index: number) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${scheduler.enabled ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                                        <div>
                                            <p className="font-medium text-white">{scheduler.name}</p>
                                            <p className="text-sm text-gray-400">{scheduler.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm text-gray-400">다음 실행</p>
                                            <p className="font-medium text-cyan-400">
                                                {formatNextRun(scheduler.nextRun)}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={scheduler.enabled ? 'success' : 'default'}
                                            size="sm"
                                        >
                                            {scheduler.enabled ? '활성' : '비활성'}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-300">
                            💡 스케줄러는 서버에서 자동으로 실행됩니다. 활성화/비활성화는 서버 설정에서 변경할 수 있습니다.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// Icons
function QueueIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
    );
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}
