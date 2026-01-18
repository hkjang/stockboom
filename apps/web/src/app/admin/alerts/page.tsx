'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';
import { 
    Bell, 
    Trash2, 
    CheckCircle, 
    RefreshCw, 
    User, 
    Clock, 
    AlertTriangle, 
    Info, 
    AlertCircle,
    TrendingUp,
    Zap,
    Wifi
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

export default function AdminAlerts() {
    const { data: notifications, mutate, isLoading, error } = useSWR('/api/admin/notifications', fetcher, {
        refreshInterval: 30000, // Auto refresh every 30 seconds
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');

    const notificationData = Array.isArray(notifications) ? notifications : [];

    const filteredNotifications = notificationData.filter((n: any) => {
        const matchesSearch = 
            n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || n.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const handleMarkAsRead = async (id: string) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        mutate();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 알림을 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/notifications/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        mutate();
    };

    const handleDeleteAllRead = async () => {
        if (!confirm('모든 읽은 알림을 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('token');
        await fetch('/api/admin/notifications/cleanup', {
            method: 'POST',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        mutate();
    };

    const unreadCount = notificationData.filter((n: any) => !n.isRead).length;

    const typeIcons: Record<string, any> = {
        'TRADE_EXECUTED': TrendingUp,
        'PRICE_ALERT': AlertTriangle,
        'STRATEGY_SIGNAL': Zap,
        'SYSTEM': Info,
        'RISK_WARNING': AlertCircle,
    };

    const typeLabels: Record<string, string> = {
        'TRADE_EXECUTED': '거래 체결',
        'PRICE_ALERT': '가격 알림',
        'STRATEGY_SIGNAL': '전략 신호',
        'SYSTEM': '시스템',
        'RISK_WARNING': '리스크 경고',
    };

    const typeVariants: Record<string, 'default' | 'success' | 'danger' | 'warning'> = {
        'TRADE_EXECUTED': 'success',
        'PRICE_ALERT': 'warning',
        'STRATEGY_SIGNAL': 'default',
        'SYSTEM': 'default',
        'RISK_WARNING': 'danger',
    };

    const todayCount = notificationData.filter((n: any) => {
        const today = new Date().toDateString();
        return new Date(n.createdAt).toDateString() === today;
    }).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Bell size={24} className="text-yellow-400" />
                        알림 관리
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">전체 사용자 알림 관리 (자동 갱신)</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleDeleteAllRead}
                        disabled={notificationData.filter((n: any) => n.isRead).length === 0}
                        className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
                    >
                        <Trash2 size={14} />
                        읽은 알림 삭제
                    </button>
                    <button onClick={() => mutate()} className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center gap-1">
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
                    <p className="text-xs text-blue-200">총 알림</p>
                    <p className="text-2xl font-bold text-white">{notificationData.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">읽지 않음</p>
                    <p className="text-2xl font-bold text-red-400">{unreadCount}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">오늘 발송</p>
                    <p className="text-2xl font-bold text-green-400">{todayCount}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <p className="text-xs text-blue-200">리스크 경고</p>
                    <p className="text-2xl font-bold text-orange-400">
                        {notificationData.filter((n: any) => n.type === 'RISK_WARNING').length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 flex gap-3">
                <input 
                    type="text" 
                    placeholder="제목, 내용, 사용자 검색..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300/50" 
                />
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white"
                >
                    <option value="ALL">전체 타입</option>
                    <option value="TRADE_EXECUTED">거래 체결</option>
                    <option value="PRICE_ALERT">가격 알림</option>
                    <option value="STRATEGY_SIGNAL">전략 신호</option>
                    <option value="SYSTEM">시스템</option>
                    <option value="RISK_WARNING">리스크 경고</option>
                </select>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-red-400" size={20} />
                    <div>
                        <p className="text-red-400 font-medium">알림 데이터를 불러올 수 없습니다</p>
                        <p className="text-red-300/70 text-xs">백엔드 API 연결을 확인하세요.</p>
                    </div>
                </div>
            )}

            {/* Notifications List */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-3 py-2 text-left text-blue-200">시간</th>
                            <th className="px-3 py-2 text-left text-blue-200">타입</th>
                            <th className="px-3 py-2 text-left text-blue-200">제목</th>
                            <th className="px-3 py-2 text-left text-blue-200">사용자</th>
                            <th className="px-3 py-2 text-center text-blue-200">상태</th>
                            <th className="px-3 py-2 text-right text-blue-200">작업</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-blue-200">
                                    <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
                                    로딩 중...
                                </td>
                            </tr>
                        ) : filteredNotifications.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-blue-200">
                                    {error ? 'API 연결 대기 중...' : '알림이 없습니다.'}
                                </td>
                            </tr>
                        ) : (
                            filteredNotifications.map((notification: any) => {
                                const Icon = typeIcons[notification.type] || Info;
                                return (
                                    <tr key={notification.id} className={`hover:bg-white/5 ${!notification.isRead ? 'bg-blue-500/5' : ''}`}>
                                        <td className="px-3 py-2 text-blue-200">
                                            <div className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(notification.createdAt).toLocaleString('ko-KR', {
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <Badge variant={typeVariants[notification.type] || 'default'} size="sm" className="flex items-center gap-1 w-fit">
                                                <Icon size={10} />
                                                {typeLabels[notification.type] || notification.type}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className={`font-medium ${notification.isRead ? 'text-blue-200' : 'text-white'}`}>
                                                {notification.title}
                                            </div>
                                            <div className="text-blue-300/70 truncate max-w-xs">
                                                {notification.message?.slice(0, 50)}{notification.message?.length > 50 ? '...' : ''}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-1">
                                                <User size={12} className="text-blue-400" />
                                                <span className="text-blue-200">{notification.user?.email?.split('@')[0] || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <Badge variant={notification.isRead ? 'default' : 'warning'} size="sm">
                                                {notification.isRead ? '읽음' : '안읽음'}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2 text-right space-x-1">
                                            {!notification.isRead && (
                                                <button 
                                                    onClick={() => handleMarkAsRead(notification.id)}
                                                    className="px-1.5 py-0.5 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/40 rounded"
                                                    title="읽음 표시"
                                                >
                                                    <CheckCircle size={12} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleDelete(notification.id)}
                                                className="px-1.5 py-0.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded"
                                                title="삭제"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
