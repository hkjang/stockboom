'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { 
    Wifi, WifiOff, RefreshCw, Activity, AlertCircle, CheckCircle, 
    Clock, BarChart2, AlertTriangle, Zap, Database, Globe, Server,
    ExternalLink, Settings, Copy, ChevronDown, ChevronUp, Radio,
    Code, FileCode, List
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface ApiEndpoint {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description: string;
    params?: { name: string; type: string; required: boolean; description: string }[];
}

interface ApiStatus {
    id: string;
    name: string;
    category: 'backend' | 'external' | 'realtime';
    description: string;
    connected: boolean;
    message: string;
    responseTime: number;
    lastCheck: string;
    baseUrl: string;
    testedEndpoint: string;
    endpoints: ApiEndpoint[];
    configRequired: string[];
    configLocation: string;
    documentation: string;
    error?: string;
    statusCode?: number;
    features: string[];
    relatedMenus: { name: string; path: string; icon: string }[];
}

export default function ApiStatusPage() {
    const { data: statusData, mutate, isLoading } = useSWR('/api/admin/api-status', fetcher, {
        refreshInterval: 60000,
    });
    const [isChecking, setIsChecking] = useState(false);
    const [expandedApi, setExpandedApi] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'cards' | 'endpoints'>('cards');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    const apis: ApiStatus[] = statusData?.apis || [];
    const summary = statusData?.summary || { total: 0, connected: 0, disconnected: 0, avgResponseTime: 0 };
    const isRealData = !!statusData?.timestamp;

    const filteredApis = categoryFilter === 'all' 
        ? apis 
        : apis.filter(a => a.category === categoryFilter);

    const allEndpoints = apis.flatMap(api => 
        api.endpoints.map(ep => ({ ...ep, apiName: api.name, apiId: api.id, connected: api.connected, baseUrl: api.baseUrl }))
    );

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

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'backend': return <Server size={18} className="text-blue-400" />;
            case 'external': return <Globe size={18} className="text-green-400" />;
            case 'realtime': return <Radio size={18} className="text-purple-400" />;
            default: return <Activity size={18} className="text-gray-400" />;
        }
    };

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'backend': return '백엔드';
            case 'external': return '외부 API';
            case 'realtime': return '실시간';
            default: return category;
        }
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case 'GET': return 'bg-green-500/20 text-green-400';
            case 'POST': return 'bg-blue-500/20 text-blue-400';
            case 'PUT': return 'bg-yellow-500/20 text-yellow-400';
            case 'DELETE': return 'bg-red-500/20 text-red-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
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
            <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity size={24} className="text-green-400" />
                        API 상태 모니터링
                        {isRealData && <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">LIVE</span>}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">연동된 모든 API 엔드포인트 및 연결 상태 확인</p>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Server size={14} className="text-blue-400" />
                        <span className="text-xs text-blue-200">총 API</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{summary.total}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle size={14} className="text-green-400" />
                        <span className="text-xs text-blue-200">연결됨</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{summary.connected}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={14} className="text-red-400" />
                        <span className="text-xs text-blue-200">오류</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{summary.disconnected}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-yellow-400" />
                        <span className="text-xs text-blue-200">평균 응답</span>
                    </div>
                    <p className={`text-2xl font-bold ${getResponseTimeColor(summary.avgResponseTime)}`}>
                        {summary.avgResponseTime}ms
                    </p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <FileCode size={14} className="text-purple-400" />
                        <span className="text-xs text-blue-200">엔드포인트</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{allEndpoints.length}</p>
                </div>
            </div>

            {/* View Mode & Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => setCategoryFilter('all')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                            categoryFilter === 'all' ? 'bg-green-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        전체 ({apis.length})
                    </button>
                    <button
                        onClick={() => setCategoryFilter('backend')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                            categoryFilter === 'backend' ? 'bg-blue-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        <Server size={12} />
                        백엔드
                    </button>
                    <button
                        onClick={() => setCategoryFilter('external')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                            categoryFilter === 'external' ? 'bg-green-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        <Globe size={12} />
                        외부 API
                    </button>
                    <button
                        onClick={() => setCategoryFilter('realtime')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                            categoryFilter === 'realtime' ? 'bg-purple-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        <Radio size={12} />
                        실시간
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                            viewMode === 'cards' ? 'bg-white/20 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        <BarChart2 size={12} />
                        카드
                    </button>
                    <button
                        onClick={() => setViewMode('endpoints')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                            viewMode === 'endpoints' ? 'bg-white/20 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                        }`}
                    >
                        <List size={12} />
                        전체 엔드포인트
                    </button>
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
                                연결되지 않은 API: {apis.filter(a => !a.connected).map(a => a.name).join(', ')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Cards View */}
            {viewMode === 'cards' && (
                <div className="space-y-3">
                    {filteredApis.map((api) => {
                        const isExpanded = expandedApi === api.id;
                        
                        return (
                            <div 
                                key={api.id} 
                                className={`bg-white/10 backdrop-blur-lg border rounded-xl transition-all ${
                                    api.connected ? 'border-green-500/30' : 'border-red-500/30'
                                }`}
                            >
                                {/* Main Row */}
                                <div 
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                                    onClick={() => setExpandedApi(isExpanded ? null : api.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {getCategoryIcon(api.category)}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-semibold text-white">{api.name}</h3>
                                                {getStatusIcon(api.connected)}
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                    api.category === 'backend' ? 'bg-blue-500/20 text-blue-400' :
                                                    api.category === 'external' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                    {getCategoryLabel(api.category)}
                                                </span>
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
                                        <div className="flex items-center gap-1 text-blue-200">
                                            <Code size={12} />
                                            <span className="text-xs">{api.endpoints.length}</span>
                                        </div>
                                        {isExpanded ? <ChevronUp size={16} className="text-blue-200" /> : <ChevronDown size={16} className="text-blue-200" />}
                                    </div>
                                </div>
                                
                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-white/10 pt-4 space-y-4">
                                        {/* Features */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {api.features.map((feature, i) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 bg-white/10 text-blue-200 rounded">
                                                    {feature}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Base URL */}
                                        <div>
                                            <p className="text-blue-200/60 mb-1 text-xs">Base URL</p>
                                            <div className="flex items-center gap-2">
                                                <code className="text-xs bg-black/30 text-green-300 px-2 py-1 rounded flex-1">
                                                    {api.baseUrl}
                                                </code>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(api.baseUrl); }}
                                                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-blue-200"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-blue-200/60 mb-2 text-xs">사용 가능한 엔드포인트 ({api.endpoints.length}개)</p>
                                            <div className="bg-black/20 rounded-lg overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-white/5">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-blue-200 w-16">Method</th>
                                                            <th className="px-3 py-2 text-left text-blue-200">Path</th>
                                                            <th className="px-3 py-2 text-left text-blue-200 hidden md:table-cell">설명</th>
                                                            <th className="px-3 py-2 text-left text-blue-200 w-20">파라미터</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {api.endpoints.map((ep, i) => (
                                                            <React.Fragment key={i}>
                                                                <tr className="hover:bg-white/5">
                                                                    <td className="px-3 py-2">
                                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${getMethodColor(ep.method)}`}>
                                                                            {ep.method}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-mono text-white text-[11px]">{ep.path}</td>
                                                                    <td className="px-3 py-2 text-blue-200/70 hidden md:table-cell">{ep.description}</td>
                                                                    <td className="px-3 py-2">
                                                                        {ep.params && ep.params.length > 0 ? (
                                                                            <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                                                                                {ep.params.length}개
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] text-gray-500">-</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                                {ep.params && ep.params.length > 0 && (
                                                                    <tr className="bg-black/30">
                                                                        <td colSpan={4} className="px-4 py-2">
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {ep.params.map((param, j) => (
                                                                                    <div key={j} className="text-[10px] bg-white/5 border border-white/10 rounded px-2 py-1">
                                                                                        <span className={`font-mono ${param.required ? 'text-orange-400' : 'text-blue-300'}`}>
                                                                                            {param.name}
                                                                                        </span>
                                                                                        <span className="text-gray-500 mx-1">:</span>
                                                                                        <span className="text-purple-400">{param.type}</span>
                                                                                        {param.required && <span className="text-red-400 ml-1">*</span>}
                                                                                        <span className="text-gray-400 ml-2">{param.description}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Configuration */}
                                        {api.configRequired.length > 0 && (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                                <p className="text-yellow-400 font-medium text-xs mb-2 flex items-center gap-2">
                                                    <Settings size={12} />
                                                    필요한 설정
                                                </p>
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {api.configRequired.map((key, j) => (
                                                        <code key={j} className="text-[10px] bg-black/30 text-yellow-300 px-2 py-0.5 rounded">
                                                            {key}
                                                        </code>
                                                    ))}
                                                </div>
                                                {api.configLocation.includes('/admin') ? (
                                                    <Link href="/admin/settings" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                                        <Settings size={10} />
                                                        {api.configLocation}
                                                    </Link>
                                                ) : (
                                                    <p className="text-xs text-blue-200/70">{api.configLocation}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Related Menus */}
                                        {api.relatedMenus && api.relatedMenus.length > 0 && (
                                            <div>
                                                <p className="text-blue-200/60 mb-2 text-xs">🔗 이 API를 사용하는 메뉴</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {api.relatedMenus.map((menu, i) => (
                                                        <Link 
                                                            key={i} 
                                                            href={menu.path}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-600/30 to-purple-600/30 hover:from-blue-600/50 hover:to-purple-600/50 border border-blue-400/30 rounded-lg text-white flex items-center gap-1.5 transition-all hover:scale-105"
                                                        >
                                                            <ExternalLink size={10} />
                                                            {menu.name}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Documentation */}
                                        <div className="flex items-center justify-between">
                                            <a 
                                                href={api.documentation} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                                            >
                                                <ExternalLink size={10} />
                                                API 문서 보기
                                            </a>
                                            <p className="text-[10px] text-blue-200/50">
                                                확인: {new Date(api.lastCheck).toLocaleTimeString('ko-KR')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Endpoints View */}
            {viewMode === 'endpoints' && (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                    <div className="p-3 bg-white/5 border-b border-white/10">
                        <h3 className="text-sm font-medium text-white flex items-center gap-2">
                            <FileCode size={14} />
                            전체 API 엔드포인트 ({allEndpoints.length}개)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-4 py-3 text-left text-blue-200">상태</th>
                                    <th className="px-4 py-3 text-left text-blue-200">API</th>
                                    <th className="px-4 py-3 text-left text-blue-200 w-16">Method</th>
                                    <th className="px-4 py-3 text-left text-blue-200">Path</th>
                                    <th className="px-4 py-3 text-left text-blue-200 hidden lg:table-cell">설명</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {allEndpoints.map((ep, i) => (
                                    <tr key={i} className="hover:bg-white/5">
                                        <td className="px-4 py-2">
                                            {ep.connected ? (
                                                <CheckCircle size={14} className="text-green-400" />
                                            ) : (
                                                <AlertCircle size={14} className="text-red-400" />
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-white font-medium text-xs">{ep.apiName}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${getMethodColor(ep.method)}`}>
                                                {ep.method}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs text-blue-200">
                                            <span className="text-blue-200/50">{ep.baseUrl}</span>{ep.path}
                                        </td>
                                        <td className="px-4 py-2 text-blue-200/70 text-xs hidden lg:table-cell">{ep.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Last Update */}
            {statusData?.timestamp && (
                <div className="text-center text-xs text-blue-200/50">
                    마지막 확인: {new Date(statusData.timestamp).toLocaleString('ko-KR')} · 1분마다 자동 갱신
                </div>
            )}
        </div>
    );
}
