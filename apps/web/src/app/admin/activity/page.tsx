'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';
import { 
    Activity, 
    RefreshCw, 
    User, 
    Clock, 
    LogIn, 
    LogOut, 
    Settings, 
    TrendingUp, 
    Eye,
    Download,
    Shield,
    AlertCircle,
    Wifi,
    Plus,
    Trash2
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

export default function AdminActivity() {
    const { data: activities, mutate, isLoading, error } = useSWR('/api/admin/activity', fetcher, {
        refreshInterval: 30000, // Auto refresh every 30 seconds
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [userFilter, setUserFilter] = useState<string>('ALL');

    const activityData = Array.isArray(activities) ? activities : [];

    const filteredActivities = activityData.filter((a: any) => {
        const matchesSearch = 
            a.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.details?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || a.actionType === typeFilter;
        const matchesUser = userFilter === 'ALL' || a.userId === userFilter;
        return matchesSearch && matchesType && matchesUser;
    });

    const uniqueUsers = [...new Map(activityData.map((a: any) => [a.userId, { id: a.userId, email: a.user?.email || a.userEmail }])).values()];

    const actionIcons: Record<string, any> = {
        'LOGIN': LogIn,
        'LOGOUT': LogOut,
        'TRADE': TrendingUp,
        'SETTINGS': Settings,
        'VIEW': Eye,
        'CREATE': Plus,
        'DELETE': Trash2,
        'ADMIN': Shield,
    };

    const actionColors: Record<string, string> = {
        'LOGIN': 'text-green-400',
        'LOGOUT': 'text-gray-400',
        'TRADE': 'text-blue-400',
        'SETTINGS': 'text-purple-400',
        'VIEW': 'text-cyan-400',
        'CREATE': 'text-yellow-400',
        'DELETE': 'text-red-400',
        'ADMIN': 'text-orange-400',
    };

    const todayCount = activityData.filter((a: any) => {
        const today = new Date().toDateString();
        return new Date(a.createdAt || a.timestamp).toDateString() === today;
    }).length;

    const tradeCount = activityData.filter((a: any) => a.actionType === 'TRADE').length;
    const loginCount = activityData.filter((a: any) => a.actionType === 'LOGIN').length;

    const downloadActivity = () => {
        const content = filteredActivities.map((a: any) => 
            `[${a.createdAt || a.timestamp}] [${a.user?.email || a.userEmail}] ${a.action}${a.details ? ` - ${a.details}` : ''}`
        ).join('\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `activity-${new Date().toISOString().split('T')[0]}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity size={24} className="text-pink-400" />
                        사용자 활동
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">사용자 활동 로그 모니터링 (자동 갱신)</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={downloadActivity}
                        disabled={filteredActivities.length === 0}
                        className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
                    >
                        <Download size={14} />
                        다운로드
                    </button>
                    <button 
                        onClick={() => mutate()}
                        className="px-3 py-1.5 text-xs bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center gap-1"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs">
                <div className={`flex items-center gap-1 px-2 py-1 rounded ${error ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {error ? <AlertCircle size={12} /> : <Wifi size={12} />}
                    {error ? 'API 연결 실패' : 'API 연결됨'}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">총 활동</p>
                    <p className="text-2xl font-bold text-white">{activityData.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">오늘 활동</p>
                    <p className="text-2xl font-bold text-green-400">{todayCount}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">거래 활동</p>
                    <p className="text-2xl font-bold text-blue-400">{tradeCount}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">로그인 횟수</p>
                    <p className="text-2xl font-bold text-purple-400">{loginCount}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 flex gap-3 flex-wrap">
                <input 
                    type="text" 
                    placeholder="활동 또는 사용자 검색..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300/50" 
                />
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white"
                >
                    <option value="ALL">전체 타입</option>
                    <option value="LOGIN">로그인</option>
                    <option value="LOGOUT">로그아웃</option>
                    <option value="TRADE">거래</option>
                    <option value="SETTINGS">설정</option>
                    <option value="VIEW">조회</option>
                    <option value="CREATE">생성</option>
                    <option value="DELETE">삭제</option>
                    <option value="ADMIN">관리자</option>
                </select>
                <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white"
                >
                    <option value="ALL">전체 사용자</option>
                    {uniqueUsers.map((user: any) => (
                        <option key={user.id} value={user.id}>{user.email || user.id}</option>
                    ))}
                </select>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-red-400" size={20} />
                    <div>
                        <p className="text-red-400 font-medium">활동 데이터를 불러올 수 없습니다</p>
                        <p className="text-red-300/70 text-xs">백엔드 API 연결을 확인하세요.</p>
                    </div>
                </div>
            )}

            {/* Activity Table */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <div className="max-h-[500px] overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-white/5 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 text-left text-blue-200 w-40">시간</th>
                                <th className="px-3 py-2 text-left text-blue-200 w-40">사용자</th>
                                <th className="px-3 py-2 text-left text-blue-200">활동</th>
                                <th className="px-3 py-2 text-left text-blue-200 w-32">IP 주소</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-3 py-8 text-center text-blue-200">
                                        <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
                                        로딩 중...
                                    </td>
                                </tr>
                            ) : filteredActivities.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-3 py-8 text-center text-blue-200">
                                        {error ? '활동 API 연결 대기 중...' : '활동 기록이 없습니다.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredActivities.slice(0, 100).map((activity: any, index: number) => {
                                    const Icon = actionIcons[activity.actionType] || Activity;
                                    return (
                                        <tr key={activity.id || index} className="hover:bg-white/5">
                                            <td className="px-3 py-2 text-blue-200">
                                                <div className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(activity.createdAt || activity.timestamp).toLocaleString('ko-KR', {
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    <User size={12} className="text-blue-400" />
                                                    <span className="text-blue-200">
                                                        {(activity.user?.email || activity.userEmail || '').split('@')[0] || 'Unknown'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Icon size={14} className={actionColors[activity.actionType] || 'text-gray-400'} />
                                                    <span className="text-white">{activity.action}</span>
                                                    {activity.details && (
                                                        <span className="text-blue-300/60 text-[10px]">
                                                            ({activity.details})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-blue-300 font-mono text-[10px]">
                                                {activity.ipAddress || '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
