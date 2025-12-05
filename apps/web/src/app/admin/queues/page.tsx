'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function QueueManagement() {
    const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
    const { data: queues, mutate } = useSWR('/api/admin/queues', fetcher, {
        refreshInterval: 3000, // 3초마다 갱신
    });

    const { data: failedJobs } = useSWR(
        selectedQueue ? `/api/admin/queues/${selectedQueue}/failed` : null,
        fetcher
    );

    const handleRetryJob = async (queueName: string, jobId: string) => {
        try {
            await fetch(`/api/admin/queues/${queueName}/jobs/${jobId}/retry`, {
                method: 'POST',
            });
            mutate();
            alert('작업 재시도가 시작되었습니다.');
        } catch (error) {
            alert('작업 재시도 실패: ' + (error as Error).message);
        }
    };

    const handleClearCompleted = async (queueName: string) => {
        if (!confirm(`${queueName} 큐의 완료된 작업을 모두 삭제하시겠습니까?`)) {
            return;
        }

        try {
            await fetch(`/api/admin/queues/${queueName}/completed`, {
                method: 'DELETE',
            });
            mutate();
            alert('완료된 작업이 삭제되었습니다.');
        } catch (error) {
            alert('삭제 실패: ' + (error as Error).message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">큐 관리</h1>
                <div className="text-sm text-gray-500">
                    실시간 업데이트 (3초마다)
                </div>
            </div>

            {/* Queue Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.isArray(queues) && queues.map((queue: any) => (
                    <Card key={queue.name}>
                        <div className="mb-3">
                            <div className="flex justify-between items-start">
                                <h3 className="font-semibold text-lg capitalize">{queue.name}</h3>
                                <Badge
                                    variant={queue.active > 0 ? 'info' : queue.failed > 0 ? 'danger' : 'success'}
                                    size="sm"
                                >
                                    {queue.active > 0 ? '처리 중' : queue.failed > 0 ? '에러' : '정상'}
                                </Badge>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">대기:</span>
                                <span className="font-semibold text-yellow-600">{queue.waiting}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">처리 중:</span>
                                <span className="font-semibold text-blue-600">{queue.active}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">완료:</span>
                                <span className="font-semibold text-green-600">{queue.completed}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">실패:</span>
                                <span className="font-semibold text-red-600">{queue.failed}</span>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <button
                                onClick={() => setSelectedQueue(queue.name)}
                                className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                disabled={queue.failed === 0}
                            >
                                실패 작업 보기 ({queue.failed})
                            </button>
                            <button
                                onClick={() => handleClearCompleted(queue.name)}
                                className="w-full px-3 py-2 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                                disabled={queue.completed === 0}
                            >
                                완료 작업 정리
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Failed Jobs Detail */}
            {selectedQueue && failedJobs && failedJobs.length > 0 && (
                <Card title={`${selectedQueue} - 실패한 작업`}>
                    <div className="space-y-4">
                        {failedJobs.map((job: any) => (
                            <div key={job.id} className="border-b pb-4 last:border-0">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="font-medium">Job #{job.id}</span>
                                            <Badge variant="danger" size="sm">{job.name}</Badge>
                                            <span className="text-xs text-gray-500">
                                                시도: {job.attemptsMade}회
                                            </span>
                                        </div>
                                        <p className="text-sm text-red-600 mb-2">{job.failedReason}</p>
                                        {job.data && (
                                            <details className="text-sm">
                                                <summary className="cursor-pointer text-gray-600">작업 데이터 보기</summary>
                                                <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                                                    {JSON.stringify(job.data, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRetryJob(selectedQueue, job.id)}
                                        className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                    >
                                        재시도
                                    </button>
                                </div>
                                {job.stacktrace && (
                                    <details className="text-sm">
                                        <summary className="cursor-pointer text-gray-600">스택 트레이스</summary>
                                        <pre className="mt-2 p-2 bg-red-50 rounded text-xs overflow-x-auto text-red-800">
                                            {job.stacktrace.join('\n')}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setSelectedQueue(null)}
                        className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                        닫기
                    </button>
                </Card>
            )}
        </div>
    );
}
