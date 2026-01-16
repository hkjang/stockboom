'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';

const fetcher = async (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(url, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
    if (res.status === 401) { window.location.href = '/auth/login'; throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

function FailedJobsModal({ queueName, isOpen, onClose }: { queueName: string | null, isOpen: boolean, onClose: () => void }) {
    const { data: failedJobs, mutate } = useSWR(isOpen && queueName ? `/api/admin/queues/${queueName}/failed` : null, fetcher);

    const handleRetry = async (jobId: string) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/queues/${queueName}/jobs/${jobId}/retry`, {
            method: 'POST', headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        mutate();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-xl max-w-2xl w-full max-h-[70vh] flex flex-col">
                <div className="p-3 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-white">실패한 작업: {queueName}</h2>
                    <button onClick={onClose} className="text-blue-300 hover:text-white text-xs">✕</button>
                </div>
                <div className="p-3 overflow-y-auto flex-1 space-y-2">
                    {!failedJobs ? <p className="text-xs text-blue-200">로딩 중...</p> :
                        failedJobs.length === 0 ? <p className="text-xs text-blue-300/70 text-center py-3">실패한 작업 없음</p> :
                            failedJobs.map((job: any) => (
                                <div key={job.id} className="bg-red-900/20 border border-red-500/30 rounded-lg p-2 text-xs">
                                    <div className="flex justify-between items-start">
                                        <span className="text-white">#{job.id}</span>
                                        <button onClick={() => handleRetry(job.id)}
                                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">재시도</button>
                                    </div>
                                    <p className="text-red-400 mt-1 truncate">{job.failedReason}</p>
                                </div>
                            ))}
                </div>
            </div>
        </div>
    );
}

export default function AdminMonitoring() {
    const { data: metrics } = useSWR('/api/admin/metrics', fetcher, { refreshInterval: 5000 });
    const { data: queues } = useSWR('/api/admin/queues', fetcher, { refreshInterval: 3000 });
    const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const getProgressColor = (value: number) => {
        if (value > 80) return 'bg-red-500';
        if (value > 60) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-bold text-white">시스템 모니터링</h1>
                <p className="text-xs text-blue-200 mt-0.5">실시간 시스템 상태</p>
            </div>

            {/* System Metrics */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { title: 'CPU', value: metrics?.cpu || 0, icon: '⚡' },
                    { title: '메모리', value: metrics?.memory || 0, icon: '💾' },
                    { title: '디스크', value: metrics?.disk || 0, icon: '💿' },
                ].map((item) => (
                    <div key={item.title} className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-blue-200">{item.title}</span>
                            <span className="text-sm">{item.icon}</span>
                        </div>
                        <p className="text-2xl font-bold text-white mb-2">{item.value}%</p>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${getProgressColor(item.value)}`}
                                style={{ width: `${item.value}%` }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Queue Monitoring */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10">
                    <h3 className="text-xs font-medium text-white">큐 상태</h3>
                </div>
                <div className="p-3 space-y-3">
                    {Array.isArray(queues) && queues.map((queue: any) => (
                        <div key={queue.name} className="border-b border-white/10 pb-2 last:border-0">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-medium text-white">{queue.name}</span>
                                <Badge variant={queue.active > 0 ? 'info' : 'default'} size="sm">
                                    {queue.active > 0 ? '처리중' : '대기'}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                                <div className="text-center p-1.5 bg-white/5 rounded-lg">
                                    <p className="text-blue-300/70">대기</p>
                                    <p className="font-semibold text-amber-400">{queue.waiting || 0}</p>
                                </div>
                                <div className="text-center p-1.5 bg-white/5 rounded-lg">
                                    <p className="text-blue-300/70">처리중</p>
                                    <p className="font-semibold text-blue-400">{queue.active || 0}</p>
                                </div>
                                <div className="text-center p-1.5 bg-white/5 rounded-lg">
                                    <p className="text-blue-300/70">완료</p>
                                    <p className="font-semibold text-emerald-400">{queue.completed || 0}</p>
                                </div>
                                <div className="text-center p-1.5 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10"
                                    onClick={() => { setSelectedQueue(queue.name); setIsModalOpen(true); }}>
                                    <p className="text-blue-300/70">실패</p>
                                    <p className="font-semibold text-red-400">{queue.failed || 0}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(!Array.isArray(queues) || queues.length === 0) && (
                        <p className="text-xs text-blue-300/70 text-center py-3">큐 데이터 없음</p>
                    )}
                </div>
            </div>

            {/* Error Logs */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10">
                    <h3 className="text-xs font-medium text-white">최근 에러</h3>
                </div>
                <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                    {Array.isArray(metrics?.errorLogs) && metrics.errorLogs.map((log: any, i: number) => (
                        <div key={i} className="p-2 bg-red-900/20 border-l-2 border-red-500 rounded-lg text-xs">
                            <p className="text-red-300 truncate">{log.message}</p>
                            <span className="text-red-400/70">{new Date(log.timestamp).toLocaleString('ko-KR')}</span>
                        </div>
                    ))}
                    {(!Array.isArray(metrics?.errorLogs) || metrics.errorLogs.length === 0) && (
                        <p className="text-xs text-blue-300/70 text-center py-3">에러 없음</p>
                    )}
                </div>
            </div>

            <FailedJobsModal queueName={selectedQueue} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
