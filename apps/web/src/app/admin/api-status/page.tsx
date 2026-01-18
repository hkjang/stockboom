'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
    Wifi, WifiOff, RefreshCw, Activity, AlertCircle, CheckCircle, 
    Clock, BarChart2, AlertTriangle, Zap, Database, Globe, Server
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface ApiStatus {
    name: string;
    connected: boolean;
    message: string;
    lastCheck: string;
    responseTime?: number;
    dailyCalls?: number;
    rateLimit?: { used: number; limit: number };
}

export default function ApiStatusPage() {
    const { data: statusData, mutate, isLoading } = useSWR('/api/admin/api-status', fetcher, {
        refreshInterval: 30000,
    });
    const [isChecking, setIsChecking] = useState(false);

    // Mock data - replace with real API status
    const apiStatuses: ApiStatus[] = statusData?.apis || [
        { 
            name: 'KIS API (한국투자증권)', 
            connected: true, 
            message: 'Connected', 
            lastCheck: new Date().toISOString(),
            responseTime: 125,
            dailyCalls: 1250,
            rateLimit: { used: 1250, limit: 10000 }
        },
        { 
            name: 'OpenDART (전자공시)', 
            connected: true, 
            message: 'Connected', 
            lastCheck: new Date().toISOString(),
            responseTime: 340,
            dailyCalls: 450,
            rateLimit: { used: 450, limit: 10000 }
        },
        { 
            name: '공공데이터포털', 
            connected: false, 
            message: 'API Key not configured', 
            lastCheck: new Date().toISOString(),
            responseTime: 0,
            dailyCalls: 0,
            rateLimit: { used: 0, limit: 1000 }
        },
        { 
            name: 'Naver Finance', 
            connected: true, 
            message: 'Connected (Web Scraping)', 
            lastCheck: new Date().toISOString(),
            responseTime: 890,
            dailyCalls: 2340
        },
        { 
            name: 'Yahoo Finance', 
            connected: true, 
            message: 'Connected', 
            lastCheck: new Date().toISOString(),
            responseTime: 450,
            dailyCalls: 120
        },
        { 
            name: 'KIS WebSocket', 
            connected: true, 
            message: 'Real-time connected', 
            lastCheck: new Date().toISOString()
        },
    ];

    const stats = {
        total: apiStatuses.length,
        connected: apiStatuses.filter(a => a.connected).length,
        failed: apiStatuses.filter(a => !a.connected).length,
        totalCalls: apiStatuses.reduce((sum, a) => sum + (a.dailyCalls || 0), 0),
        avgResponseTime: Math.round(apiStatuses.filter(a => a.responseTime).reduce((sum, a) => sum + (a.responseTime || 0), 0) / apiStatuses.filter(a => a.responseTime).length) || 0,
    };

    const handleRefreshAll = async () => {
        setIsChecking(true);
        await mutate();
        setIsChecking(false);
    };

    const getStatusIcon = (connected: boolean) => {
        return connected 
            ? <CheckCircle size={16} className="text-green-400" />
            : <AlertCircle size={16} className="text-red-400" />;
    };

    const getApiIcon = (name: string) => {
        if (name.includes('KIS')) return <Zap className="text-yellow-400" size={18} />;
        if (name.includes('DART')) return <Database className="text-blue-400" size={18} />;
        if (name.includes('공공')) return <Server className="text-purple-400" size={18} />;
        if (name.includes('Naver') || name.includes('Yahoo')) return <Globe className="text-green-400" size={18} />;
        return <Activity className="text-cyan-400" size={18} />;
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity size={24} className="text-green-400" />
                        API 상태 모니터링
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">외부 API 연결 상태 및 사용량 모니터링</p>
                </div>
                <button 
                    onClick={handleRefreshAll} 
                    disabled={isChecking || isLoading}
                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1"
                >
                    <RefreshCw size={14} className={(isChecking || isLoading) ? 'animate-spin' : ''} />
                    전체 상태 확인
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Server size={14} className="text-blue-400" />
                        <span className="text-xs text-blue-200">총 API</span>
                    </div>
                    <p className="text-xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle size={14} className="text-green-400" />
                        <span className="text-xs text-blue-200">연결됨</span>
                    </div>
                    <p className="text-xl font-bold text-green-400">{stats.connected}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={14} className="text-red-400" />
                        <span className="text-xs text-blue-200">오류</span>
                    </div>
                    <p className="text-xl font-bold text-red-400">{stats.failed}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart2 size={14} className="text-purple-400" />
                        <span className="text-xs text-blue-200">오늘 호출</span>
                    </div>
                    <p className="text-xl font-bold text-white">{stats.totalCalls.toLocaleString()}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-yellow-400" />
                        <span className="text-xs text-blue-200">평균 응답</span>
                    </div>
                    <p className="text-xl font-bold text-white">{stats.avgResponseTime}ms</p>
                </div>
            </div>

            {/* API Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apiStatuses.map((api, i) => (
                    <div 
                        key={i} 
                        className={`bg-white/10 backdrop-blur-lg border rounded-xl p-4 transition-all hover:bg-white/15 ${
                            api.connected ? 'border-green-500/30' : 'border-red-500/30'
                        }`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {getApiIcon(api.name)}
                                <div>
                                    <h3 className="text-sm font-semibold text-white">{api.name}</h3>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {api.connected ? (
                                            <Wifi size={10} className="text-green-400" />
                                        ) : (
                                            <WifiOff size={10} className="text-red-400" />
                                        )}
                                        <span className={`text-xs ${api.connected ? 'text-green-400' : 'text-red-400'}`}>
                                            {api.connected ? '연결됨' : '연결 안됨'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {getStatusIcon(api.connected)}
                        </div>
                        
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-blue-200/70">상태</span>
                                <span className={api.connected ? 'text-green-400' : 'text-red-400'}>{api.message}</span>
                            </div>
                            
                            {api.responseTime !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-blue-200/70">응답 시간</span>
                                    <span className={`text-white ${api.responseTime > 500 ? 'text-yellow-400' : ''}`}>
                                        {api.responseTime}ms
                                    </span>
                                </div>
                            )}
                            
                            {api.dailyCalls !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-blue-200/70">오늘 호출</span>
                                    <span className="text-white">{api.dailyCalls.toLocaleString()}회</span>
                                </div>
                            )}
                            
                            {api.rateLimit && (
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-blue-200/70">Rate Limit</span>
                                        <span className="text-white">{api.rateLimit.used.toLocaleString()} / {api.rateLimit.limit.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all ${
                                                (api.rateLimit.used / api.rateLimit.limit) > 0.8 ? 'bg-red-500' :
                                                (api.rateLimit.used / api.rateLimit.limit) > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                                            }`}
                                            style={{ width: `${(api.rateLimit.used / api.rateLimit.limit) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-3 pt-2 border-t border-white/10">
                            <div className="flex items-center gap-1 text-[10px] text-blue-200/50">
                                <Clock size={10} />
                                마지막 확인: {new Date(api.lastCheck).toLocaleTimeString('ko-KR')}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Warning Messages */}
            {stats.failed > 0 && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-red-400" />
                        <span className="text-red-200 font-medium">연결 오류 감지</span>
                    </div>
                    <ul className="text-sm text-red-200/80 space-y-1 ml-6">
                        {apiStatuses.filter(a => !a.connected).map((api, i) => (
                            <li key={i}>• {api.name}: {api.message}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* API Configuration Guide */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <AlertCircle size={14} className="text-blue-400" />
                    API 설정 안내
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-200/80">
                    <div>
                        <p className="font-medium text-white mb-1">KIS API (한국투자증권)</p>
                        <p>계좌 개설 후 KIS Developers에서 App Key/Secret 발급</p>
                        <p className="text-blue-400">→ /admin/settings에서 설정</p>
                    </div>
                    <div>
                        <p className="font-medium text-white mb-1">OpenDART</p>
                        <p>금융감독원 전자공시시스템에서 API 키 발급</p>
                        <p className="text-blue-400">→ opendart.fss.or.kr</p>
                    </div>
                    <div>
                        <p className="font-medium text-white mb-1">공공데이터포털</p>
                        <p>금융위원회 주식시세정보 API 신청</p>
                        <p className="text-blue-400">→ data.go.kr</p>
                    </div>
                    <div>
                        <p className="font-medium text-white mb-1">Naver/Yahoo Finance</p>
                        <p>별도 API 키 불필요 (웹 스크래핑)</p>
                        <p className="text-yellow-400">⚠ 과도한 호출 주의</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
