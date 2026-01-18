'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
    Wifi, WifiOff, RefreshCw, Activity, AlertCircle, CheckCircle, 
    Clock, BarChart2, AlertTriangle, Zap, Database, Globe, Server,
    ExternalLink, Settings, Copy, ChevronDown, ChevronUp
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface ApiStatus {
    name: string;
    description: string;
    connected: boolean;
    message: string;
    responseTime: number;
    lastCheck: string;
    endpoint: string;
    configRequired: string[];
    configLocation: string;
    documentation: string;
    error?: string;
    statusCode?: number;
    rateLimit?: { used: number; limit: number };
}

export default function ApiStatusPage() {
    const { data: statusData, mutate, isLoading } = useSWR('/api/admin/api-status', fetcher, {
        refreshInterval: 60000, // 1분마다 자동 새로고침
    });
    const [isChecking, setIsChecking] = useState(false);
    const [expandedApi, setExpandedApi] = useState<string | null>(null);

    const apis: ApiStatus[] = statusData?.apis || [];
    const summary = statusData?.summary || { total: 0, connected: 0, disconnected: 0, avgResponseTime: 0 };
    const isRealData = !!statusData?.timestamp;

    const handleRefreshAll = async () => {
        setIsChecking(true);
        await mutate();
        setIsChecking(false);
    };

    const getStatusIcon = (connected: boolean) => {
        return connected 
            ? <CheckCircle size={18} className="text-green-400" />
            : <AlertCircle size={18} className="text-red-400" />;
    };

    const getApiIcon = (name: string) => {
        if (name.includes('Backend')) return <Server size={18} className="text-blue-400" />;
        if (name.includes('KIS') && name.includes('WebSocket')) return <Activity size={18} className="text-purple-400" />;
        if (name.includes('KIS')) return <Zap size={18} className="text-yellow-400" />;
        if (name.includes('DART')) return <Database size={18} className="text-blue-400" />;
        if (name.includes('공공')) return <Server size={18} className="text-purple-400" />;
        if (name.includes('Upbit')) return <Activity size={18} className="text-orange-400" />;
        if (name.includes('Naver')) return <Globe size={18} className="text-green-400" />;
        return <Activity size={18} className="text-cyan-400" />;
    };

    const getResponseTimeColor = (ms: number) => {
        if (ms === 0) return 'text-gray-400';
        if (ms < 300) return 'text-green-400';
        if (ms < 1000) return 'text-yellow-400';
        return 'text-red-400';
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity size={24} className="text-green-400" />
                        API 상태 모니터링
                        {isRealData && <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">LIVE</span>}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">외부 API 연결 상태, 응답 시간, 설정 안내</p>
                </div>
                <button 
                    onClick={handleRefreshAll} 
                    disabled={isChecking || isLoading}
                    className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
                >
                    <RefreshCw size={16} className={(isChecking || isLoading) ? 'animate-spin' : ''} />
                    전체 상태 확인
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Server size={16} className="text-blue-400" />
                        <span className="text-sm text-blue-200">총 API</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{summary.total}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={16} className="text-green-400" />
                        <span className="text-sm text-blue-200">연결됨</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{summary.connected}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle size={16} className="text-red-400" />
                        <span className="text-sm text-blue-200">오류</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{summary.disconnected}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-yellow-400" />
                        <span className="text-sm text-blue-200">평균 응답</span>
                    </div>
                    <p className={`text-2xl font-bold ${getResponseTimeColor(summary.avgResponseTime)}`}>
                        {summary.avgResponseTime}ms
                    </p>
                </div>
            </div>

            {/* Connection Alert */}
            {summary.disconnected > 0 && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-red-400 mt-0.5" />
                        <div>
                            <p className="text-red-200 font-medium">
                                {summary.disconnected}개 API 연결 오류
                            </p>
                            <p className="text-red-200/70 text-sm mt-1">
                                아래 API 상세 정보에서 설정 방법을 확인하세요.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* API Status Cards */}
            <div className="space-y-3">
                {apis.map((api, i) => {
                    const isExpanded = expandedApi === api.name;
                    
                    return (
                        <div 
                            key={i} 
                            className={`bg-white/10 backdrop-blur-lg border rounded-xl transition-all ${
                                api.connected ? 'border-green-500/30' : 'border-red-500/30'
                            }`}
                        >
                            {/* Main Row */}
                            <div 
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                                onClick={() => setExpandedApi(isExpanded ? null : api.name)}
                            >
                                <div className="flex items-center gap-3">
                                    {getApiIcon(api.name)}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-white">{api.name}</h3>
                                            {getStatusIcon(api.connected)}
                                        </div>
                                        <p className="text-xs text-blue-200/60">{api.description}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className={`text-sm font-medium ${api.connected ? 'text-green-400' : 'text-red-400'}`}>
                                            {api.message}
                                        </p>
                                        <p className={`text-xs ${getResponseTimeColor(api.responseTime)}`}>
                                            {api.responseTime > 0 ? `${api.responseTime}ms` : '-'}
                                        </p>
                                    </div>
                                    {isExpanded ? <ChevronUp size={16} className="text-blue-200" /> : <ChevronDown size={16} className="text-blue-200" />}
                                </div>
                            </div>
                            
                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="px-4 pb-4 border-t border-white/10 pt-4 space-y-4">
                                    {/* Status Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-blue-200/60 mb-1">상태</p>
                                            <p className={`font-medium ${api.connected ? 'text-green-400' : 'text-red-400'}`}>
                                                {api.message}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-blue-200/60 mb-1">응답 시간</p>
                                            <p className={`font-medium ${getResponseTimeColor(api.responseTime)}`}>
                                                {api.responseTime > 0 ? `${api.responseTime}ms` : '측정 불가'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-blue-200/60 mb-1">마지막 확인</p>
                                            <p className="text-white">
                                                {api.lastCheck ? new Date(api.lastCheck).toLocaleTimeString('ko-KR') : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Endpoint */}
                                    <div>
                                        <p className="text-blue-200/60 mb-1 text-sm">엔드포인트</p>
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs bg-black/30 text-blue-200 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                                                {api.endpoint}
                                            </code>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); copyToClipboard(api.endpoint); }}
                                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-blue-200"
                                            >
                                                <Copy size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Configuration */}
                                    {!api.connected && api.configRequired.length > 0 && (
                                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                            <p className="text-yellow-400 font-medium text-sm mb-2 flex items-center gap-2">
                                                <Settings size={14} />
                                                설정 필요
                                            </p>
                                            <div className="space-y-2 text-sm">
                                                <div>
                                                    <p className="text-blue-200/60">필요한 환경변수:</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {api.configRequired.map((key, j) => (
                                                            <code key={j} className="text-xs bg-black/30 text-yellow-300 px-2 py-0.5 rounded">
                                                                {key}
                                                            </code>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-blue-200/60">설정 위치:</p>
                                                    {api.configLocation.includes('/admin') ? (
                                                        <Link href="/admin/settings" className="text-blue-400 hover:underline flex items-center gap-1 mt-1">
                                                            <Settings size={12} />
                                                            {api.configLocation}
                                                        </Link>
                                                    ) : (
                                                        <p className="text-white mt-1">{api.configLocation}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Documentation */}
                                    <div className="flex items-center justify-between">
                                        <a 
                                            href={api.documentation} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                                        >
                                            <ExternalLink size={12} />
                                            API 문서 보기
                                        </a>
                                        
                                        {api.error && (
                                            <p className="text-xs text-red-400/80">
                                                오류: {api.error}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Quick Setup Guide */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Settings size={16} className="text-blue-400" />
                    빠른 설정 가이드
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                        <p className="font-medium text-yellow-400">1. KIS API (한국투자증권)</p>
                        <ol className="text-blue-200/80 space-y-1 ml-4 list-decimal">
                            <li>한국투자증권 계좌 개설</li>
                            <li><a href="https://apiportal.koreainvestment.com" target="_blank" rel="noopener" className="text-blue-400 hover:underline">KIS Developers</a>에서 앱 등록</li>
                            <li>App Key, App Secret 발급</li>
                            <li><Link href="/admin/settings" className="text-blue-400 hover:underline">/admin/settings</Link>에서 입력</li>
                        </ol>
                    </div>
                    <div className="space-y-2">
                        <p className="font-medium text-blue-400">2. OpenDART (전자공시)</p>
                        <ol className="text-blue-200/80 space-y-1 ml-4 list-decimal">
                            <li><a href="https://opendart.fss.or.kr" target="_blank" rel="noopener" className="text-blue-400 hover:underline">OpenDART</a> 회원가입</li>
                            <li>인증키 발급 신청</li>
                            <li><Link href="/admin/settings" className="text-blue-400 hover:underline">/admin/settings</Link>에서 입력</li>
                        </ol>
                    </div>
                    <div className="space-y-2">
                        <p className="font-medium text-purple-400">3. 공공데이터포털</p>
                        <ol className="text-blue-200/80 space-y-1 ml-4 list-decimal">
                            <li><a href="https://www.data.go.kr" target="_blank" rel="noopener" className="text-blue-400 hover:underline">data.go.kr</a> 회원가입</li>
                            <li>"금융위원회_주식시세정보" 검색</li>
                            <li>활용신청 후 API 키 발급</li>
                        </ol>
                    </div>
                    <div className="space-y-2">
                        <p className="font-medium text-green-400">4. Upbit & Naver Finance</p>
                        <p className="text-blue-200/80 ml-4">
                            ✅ Public API로 별도 설정 없이 사용 가능
                        </p>
                    </div>
                </div>
            </div>

            {/* Last Update */}
            {statusData?.timestamp && (
                <div className="text-center text-xs text-blue-200/50">
                    마지막 확인: {new Date(statusData.timestamp).toLocaleString('ko-KR')} · 1분마다 자동 갱신
                </div>
            )}
        </div>
    );
}
