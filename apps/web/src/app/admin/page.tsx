'use client';

import useSWR from 'swr';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

function StatCard({ title, value, icon, color = 'indigo' }: { title: string; value: string | number; icon: string; color?: string }) {
    const colorMap: Record<string, string> = {
        indigo: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/30',
        emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
        amber: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
        cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
    };

    return (
        <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.indigo} border backdrop-blur-lg rounded-xl p-4`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-blue-200">{title}</p>
                    <p className="text-xl font-bold text-white mt-1">{value}</p>
                </div>
                <span className="text-xl">{icon}</span>
            </div>
        </div>
    );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
            {title && (
                <div className="px-4 py-2.5 border-b border-white/10">
                    <h3 className="text-sm font-medium text-white">{title}</h3>
                </div>
            )}
            <div className="p-4">{children}</div>
        </div>
    );
}

export default function AdminDashboard() {
    const { data: stats } = useSWR('/api/admin/stats', fetcher, { refreshInterval: 10000 });

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-bold text-white">대시보드</h1>
                <p className="text-xs text-blue-200 mt-0.5">시스템 현황</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="총 사용자" value={stats?.totalUsers || 0} icon="👥" color="indigo" />
                <StatCard title="활성 거래" value={stats?.activeTrades || 0} icon="📈" color="emerald" />
                <StatCard title="큐 작업" value={stats?.queueJobs || 0} icon="📋" color="amber" />
                <StatCard title="API 요청/분" value={stats?.apiRequestsPerMin || 0} icon="⚡" color="cyan" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="최근 사용자 가입">
                    <div className="space-y-2">
                        {stats?.recentUsers?.length > 0 ? (
                            stats.recentUsers.map((user: any) => (
                                <div key={user.id} className="flex justify-between items-center py-1.5 border-b border-white/10 last:border-0">
                                    <div>
                                        <p className="text-xs font-medium text-white">{user.email}</p>
                                        <p className="text-xs text-blue-300/70">{user.name || 'N/A'}</p>
                                    </div>
                                    <span className="text-xs text-blue-300/70">
                                        {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-blue-300/70 text-center py-3">데이터 없음</p>
                        )}
                    </div>
                </Card>

                <Card title="최근 거래">
                    <div className="space-y-2">
                        {stats?.recentTrades?.length > 0 ? (
                            stats.recentTrades.map((trade: any) => (
                                <div key={trade.id} className="flex justify-between items-center py-1.5 border-b border-white/10 last:border-0">
                                    <div>
                                        <p className="text-xs font-medium text-white">{trade.stock?.symbol}</p>
                                        <p className="text-xs text-blue-300/70">{trade.orderSide} {trade.quantity}주</p>
                                    </div>
                                    <span className={`text-xs font-medium ${trade.status === 'FILLED' ? 'text-emerald-400' :
                                            trade.status === 'REJECTED' ? 'text-red-400' : 'text-amber-400'
                                        }`}>
                                        {trade.status}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-blue-300/70 text-center py-3">데이터 없음</p>
                        )}
                    </div>
                </Card>
            </div>

            <Card title="시스템 상태">
                <div className="grid grid-cols-3 gap-3">
                    {['API 서버', '데이터베이스', 'Redis'].map((name) => (
                        <div key={name} className="text-center p-3 bg-white/5 rounded-lg">
                            <p className="text-xs text-blue-200 mb-1">{name}</p>
                            <p className="text-lg font-bold text-emerald-400">●</p>
                            <p className="text-xs text-blue-300/70">정상</p>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
