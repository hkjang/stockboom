'use client';

import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AdminMonitoring() {
    const { data: metrics } = useSWR('/api/admin/metrics', fetcher, {
        refreshInterval: 5000, // 5초마다 갱신
    });

    const { data: queues } = useSWR('/api/admin/queues', fetcher, {
        refreshInterval: 3000, // 3초마다 갱신
    });

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">시스템 모니터링</h1>

            {/* System Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title="CPU 사용률">
                    <div className="text-center">
                        <p className="text-4xl font-bold">{metrics?.cpu || 0}%</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                            <div
                                className={`h-2 rounded-full ${(metrics?.cpu || 0) > 80 ? 'bg-red-500' :
                                        (metrics?.cpu || 0) > 60 ? 'bg-yellow-500' :
                                            'bg-green-500'
                                    }`}
                                style={{ width: `${metrics?.cpu || 0}%` }}
                            />
                        </div>
                    </div>
                </Card>

                <Card title="메모리 사용률">
                    <div className="text-center">
                        <p className="text-4xl font-bold">{metrics?.memory || 0}%</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                            <div
                                className={`h-2 rounded-full ${(metrics?.memory || 0) > 80 ? 'bg-red-500' :
                                        (metrics?.memory || 0) > 60 ? 'bg-yellow-500' :
                                            'bg-green-500'
                                    }`}
                                style={{ width: `${metrics?.memory || 0}%` }}
                            />
                        </div>
                    </div>
                </Card>

                <Card title="디스크 사용률">
                    <div className="text-center">
                        <p className="text-4xl font-bold">{metrics?.disk || 0}%</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                            <div
                                className={`h-2 rounded-full ${(metrics?.disk || 0) > 80 ? 'bg-red-500' :
                                        (metrics?.disk || 0) > 60 ? 'bg-yellow-500' :
                                            'bg-green-500'
                                    }`}
                                style={{ width: `${metrics?.disk || 0}%` }}
                            />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Queue Monitoring */}
            <Card title="큐 상태">
                <div className="space-y-4">
                    {queues?.map((queue: any) => (
                        <div key={queue.name} className="border-b pb-4 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-semibold text-lg">{queue.name}</h3>
                                    <p className="text-sm text-gray-500">
                                        총 작업: {queue.waiting + queue.active + queue.completed + queue.failed}
                                    </p>
                                </div>
                                <Badge
                                    variant={queue.active > 0 ? 'info' : 'default'}
                                    size="sm"
                                >
                                    {queue.active > 0 ? '처리 중' : '대기'}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-4 gap-3 text-sm">
                                <div className="text-center">
                                    <p className="text-gray-600">대기</p>
                                    <p className="text-xl font-bold text-yellow-600">{queue.waiting}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-gray-600">처리 중</p>
                                    <p className="text-xl font-bold text-blue-600">{queue.active}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-gray-600">완료</p>
                                    <p className="text-xl font-bold text-green-600">{queue.completed}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-gray-600">실패</p>
                                    <p className="text-xl font-bold text-red-600">{queue.failed}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Error Logs */}
            <Card title="최근 에러 로그">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {metrics?.errorLogs?.map((log: any, index: number) => (
                        <div key={index} className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="font-medium text-red-900">{log.message}</p>
                                    <p className="text-sm text-red-700 mt-1">{log.stack}</p>
                                </div>
                                <span className="text-xs text-red-600 whitespace-nowrap ml-4">
                                    {new Date(log.timestamp).toLocaleString('ko-KR')}
                                </span>
                            </div>
                        </div>
                    ))}
                    {(!metrics?.errorLogs || metrics.errorLogs.length === 0) && (
                        <p className="text-center text-gray-500 py-4">에러 로그가 없습니다.</p>
                    )}
                </div>
            </Card>
        </div>
    );
}
