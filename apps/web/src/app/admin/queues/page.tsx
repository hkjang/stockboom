'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function QueueManagement() {
    const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
    const { data: queues, mutate } = useSWR('/api/admin/queues', fetcher, { refreshInterval: 3000 });
    const { data: failedJobs } = useSWR(selectedQueue ? `/api/admin/queues/${selectedQueue}/failed` : null, fetcher);

    const handleRetryJob = async (queueName: string, jobId: string) => {
        await fetch(`/api/admin/queues/${queueName}/jobs/${jobId}/retry`, { method: 'POST' });
        mutate();
    };

    const handleClearCompleted = async (queueName: string) => {
        if (!confirm('완료된 작업을 삭제하시겠습니까?')) return;
        await fetch(`/api/admin/queues/${queueName}/completed`, { method: 'DELETE' });
        mutate();
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-bold text-white">큐 관리</h1>
                <p className="text-xs text-gray-400 mt-0.5">실시간 업데이트 (3초마다)</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.isArray(queues) && queues.map((queue: any) => (
                    <div key={queue.name} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-semibold text-white capitalize">{queue.name}</h3>
                            <Badge variant={queue.active > 0 ? 'info' : queue.failed > 0 ? 'danger' : 'success'} size="sm">
                                {queue.active > 0 ? '처리중' : queue.failed > 0 ? '에러' : '정상'}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                            <div className="flex justify-between"><span className="text-gray-500">대기</span><span className="text-amber-400">{queue.waiting}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">처리중</span><span className="text-blue-400">{queue.active}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">완료</span><span className="text-emerald-400">{queue.completed}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">실패</span><span className="text-red-400">{queue.failed}</span></div>
                        </div>

                        <div className="space-y-1">
                            <button onClick={() => setSelectedQueue(queue.name)} disabled={queue.failed === 0}
                                className="w-full px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 disabled:opacity-50">
                                실패 작업 ({queue.failed})
                            </button>
                            <button onClick={() => handleClearCompleted(queue.name)} disabled={queue.completed === 0}
                                className="w-full px-2 py-1 text-xs bg-gray-700/50 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50">
                                완료 정리
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {selectedQueue && failedJobs && failedJobs.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="text-xs font-medium text-white">{selectedQueue} - 실패 작업</h3>
                        <button onClick={() => setSelectedQueue(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
                    </div>
                    <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                        {failedJobs.map((job: any) => (
                            <div key={job.id} className="bg-gray-700/30 rounded p-2 text-xs">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-white">#{job.id}</span>
                                        <span className="ml-2 text-gray-500">시도: {job.attemptsMade}회</span>
                                    </div>
                                    <button onClick={() => handleRetryJob(selectedQueue, job.id)}
                                        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded">재시도</button>
                                </div>
                                <p className="text-red-400 mt-1 truncate">{job.failedReason}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
