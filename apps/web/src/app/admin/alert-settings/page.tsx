'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
    Bell, Plus, Trash2, Edit2, CheckCircle, XCircle, 
    TrendingUp, TrendingDown, Activity, RefreshCw, AlertTriangle, AlertCircle
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface PriceAlert {
    id: string;
    symbol: string;
    stockName: string;
    type: 'ABOVE' | 'BELOW' | 'CHANGE_UP' | 'CHANGE_DOWN';
    targetPrice?: number;
    changePercent?: number;
    currentPrice: number;
    isActive: boolean;
    triggered: boolean;
    triggeredAt?: Date;
}

interface IndicatorAlert {
    id: string;
    symbol: string;
    stockName: string;
    indicator: string;
    condition: string;
    isActive: boolean;
    triggered: boolean;
    triggeredAt?: Date;
}

export default function AlertManagerPage() {
    const { data, mutate, isLoading, error } = useSWR('/api/admin/alerts/settings', fetcher);
    const [alertType, setAlertType] = useState<'price' | 'indicator'>('price');

    const priceAlerts: PriceAlert[] = data?.priceAlerts || [];
    const indicatorAlerts: IndicatorAlert[] = data?.indicatorAlerts || [];
    const stats = data?.stats || { total: 0, active: 0, triggered: 0 };
    const isRealData = !!data?.timestamp;

    const getAlertTypeLabel = (type: string) => {
        switch (type) {
            case 'ABOVE': return '가격 돌파';
            case 'BELOW': return '가격 하락';
            case 'CHANGE_UP': return '급등';
            case 'CHANGE_DOWN': return '급락';
            default: return type;
        }
    };

    const getIndicatorIcon = (indicator: string) => {
        switch (indicator) {
            case 'RSI': return <Activity size={14} className="text-purple-400" />;
            case 'MACD': return <TrendingUp size={14} className="text-blue-400" />;
            case 'GOLDEN_CROSS': return <TrendingUp size={14} className="text-green-400" />;
            case 'DEATH_CROSS': return <TrendingDown size={14} className="text-red-400" />;
            case 'VOLUME_SPIKE': return <AlertTriangle size={14} className="text-yellow-400" />;
            default: return <Bell size={14} className="text-gray-400" />;
        }
    };

    const handleDelete = async (id: string) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/alerts/settings?id=${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        mutate();
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
                    <p className="text-white">데이터를 불러올 수 없습니다</p>
                    <button onClick={() => mutate()} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Bell size={24} className="text-amber-400" />
                        알림 설정
                        {isRealData && <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">LIVE</span>}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">가격 알림 및 기술적 지표 알림 관리</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1">
                        <Plus size={14} />
                        알림 추가
                    </button>
                    <button 
                        onClick={() => mutate()} 
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-1"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <p className="text-xs text-blue-200">가격 알림</p>
                    <p className="text-xl font-bold text-white">{priceAlerts.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <p className="text-xs text-blue-200">지표 알림</p>
                    <p className="text-xl font-bold text-white">{indicatorAlerts.length}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <p className="text-xs text-blue-200">활성화</p>
                    <p className="text-xl font-bold text-green-400">{stats.active}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <p className="text-xs text-blue-200">발생</p>
                    <p className="text-xl font-bold text-amber-400">{stats.triggered}</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
                <button
                    onClick={() => setAlertType('price')}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                        alertType === 'price' ? 'bg-amber-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                    }`}
                >
                    💰 가격 알림 ({priceAlerts.length})
                </button>
                <button
                    onClick={() => setAlertType('indicator')}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                        alertType === 'indicator' ? 'bg-amber-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                    }`}
                >
                    📊 지표 알림 ({indicatorAlerts.length})
                </button>
            </div>

            {/* Price Alerts */}
            {alertType === 'price' && (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-4 py-3 text-left text-blue-200">종목</th>
                                <th className="px-4 py-3 text-left text-blue-200">타입</th>
                                <th className="px-4 py-3 text-right text-blue-200">목표가</th>
                                <th className="px-4 py-3 text-right text-blue-200">현재가</th>
                                <th className="px-4 py-3 text-center text-blue-200">상태</th>
                                <th className="px-4 py-3 text-center text-blue-200">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {priceAlerts.length > 0 ? priceAlerts.map(alert => (
                                <tr key={alert.id} className={`hover:bg-white/5 ${!alert.isActive ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="text-white font-medium">{alert.stockName}</div>
                                        <div className="text-blue-200/50 text-xs">{alert.symbol}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            alert.type?.includes('UP') || alert.type === 'ABOVE' 
                                                ? 'bg-green-400/20 text-green-400' 
                                                : 'bg-red-400/20 text-red-400'
                                        }`}>
                                            {getAlertTypeLabel(alert.type)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-white">
                                        {alert.targetPrice ? `₩${alert.targetPrice.toLocaleString()}` : `${alert.changePercent}%`}
                                    </td>
                                    <td className="px-4 py-3 text-right text-blue-200">
                                        {alert.currentPrice ? `₩${alert.currentPrice.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {alert.triggered ? (
                                            <span className="px-2 py-0.5 rounded text-xs bg-amber-400/20 text-amber-400">발생</span>
                                        ) : alert.isActive ? (
                                            <span className="px-2 py-0.5 rounded text-xs bg-green-400/20 text-green-400">대기중</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded text-xs bg-gray-400/20 text-gray-400">비활성</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button className="p-1 hover:bg-white/10 rounded text-blue-200 hover:text-white">
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(alert.id)}
                                                className="p-1 hover:bg-white/10 rounded text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-blue-200/50">
                                        {isLoading ? '데이터 로딩중...' : '가격 알림이 없습니다'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Indicator Alerts */}
            {alertType === 'indicator' && (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-4 py-3 text-left text-blue-200">종목</th>
                                <th className="px-4 py-3 text-left text-blue-200">지표</th>
                                <th className="px-4 py-3 text-left text-blue-200">조건</th>
                                <th className="px-4 py-3 text-center text-blue-200">상태</th>
                                <th className="px-4 py-3 text-center text-blue-200">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {indicatorAlerts.length > 0 ? indicatorAlerts.map(alert => (
                                <tr key={alert.id} className={`hover:bg-white/5 ${!alert.isActive ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="text-white font-medium">{alert.stockName}</div>
                                        <div className="text-blue-200/50 text-xs">{alert.symbol}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {getIndicatorIcon(alert.indicator)}
                                            <span className="text-white">{alert.indicator}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-blue-200">{alert.condition}</td>
                                    <td className="px-4 py-3 text-center">
                                        {alert.triggered ? (
                                            <span className="px-2 py-0.5 rounded text-xs bg-amber-400/20 text-amber-400">발생</span>
                                        ) : alert.isActive ? (
                                            <span className="px-2 py-0.5 rounded text-xs bg-green-400/20 text-green-400">모니터링</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded text-xs bg-gray-400/20 text-gray-400">비활성</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button className="p-1 hover:bg-white/10 rounded text-blue-200 hover:text-white">
                                                {alert.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(alert.id)}
                                                className="p-1 hover:bg-white/10 rounded text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-blue-200/50">
                                        {isLoading ? '데이터 로딩중...' : '지표 알림이 없습니다'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
