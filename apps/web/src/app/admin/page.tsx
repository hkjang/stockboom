'use client';

import useSWR from 'swr';
import { Card } from '@/components/ui/Card';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
        }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: string }) {
    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-600">{title}</p>
                    <p className="text-3xl font-bold mt-2">{value}</p>
                </div>
                <div className="text-4xl">{icon}</div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const { data: stats } = useSWR('/api/admin/stats', fetcher, {
        refreshInterval: 10000, // Refresh every 10 seconds
    });

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">관리자 대시보드</h1>

            {/* System Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="총 사용자"
                    value={stats?.totalUsers || 0}
                    icon="👥"
                />
                <StatCard
                    title="활성 거래"
                    value={stats?.activeTrades || 0}
                    icon="📈"
                />
                <StatCard
                    title="큐 작업"
                    value={stats?.queueJobs || 0}
                    icon="📋"
                />
                <StatCard
                    title="API 요청/분"
                    value={stats?.apiRequestsPerMin || 0}
                    icon="⚡"
                />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="최근 사용자 가입">
                    <div className="space-y-3">
                        {stats?.recentUsers?.map((user: any) => (
                            <div key={user.id} className="flex justify-between items-center py-2 border-b last:border-0">
                                <div>
                                    <p className="font-medium">{user.email}</p>
                                    <p className="text-sm text-gray-500">{user.name || 'N/A'}</p>
                                </div>
                                <span className="text-xs text-gray-400">
                                    {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="최근 거래">
                    <div className="space-y-3">
                        {stats?.recentTrades?.map((trade: any) => (
                            <div key={trade.id} className="flex justify-between items-center py-2 border-b last:border-0">
                                <div>
                                    <p className="font-medium">{trade.stock?.symbol}</p>
                                    <p className="text-sm text-gray-500">
                                        {trade.orderSide} {trade.quantity}주
                                    </p>
                                </div>
                                <span className={`text-sm font-semibold ${trade.status === 'FILLED' ? 'text-green-600' :
                                    trade.status === 'REJECTED' ? 'text-red-600' :
                                        'text-yellow-600'
                                    }`}>
                                    {trade.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* System Health */}
            <Card title="시스템 상태">
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <p className="text-sm text-gray-600">API 서버</p>
                        <p className="text-2xl font-bold text-green-600">●</p>
                        <p className="text-xs text-gray-500">정상</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600">데이터베이스</p>
                        <p className="text-2xl font-bold text-green-600">●</p>
                        <p className="text-xs text-gray-500">정상</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600">Redis</p>
                        <p className="text-2xl font-bold text-green-600">●</p>
                        <p className="text-xs text-gray-500">정상</p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
