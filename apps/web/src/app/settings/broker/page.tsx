'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
    Wifi, WifiOff, RefreshCw, Key, Settings, Check, AlertCircle, 
    Clock, Database, Activity, Zap
} from 'lucide-react';

interface BrokerStatus {
    api: {
        tokenValid: boolean;
        tokenExpiresAt: string | null;
    };
    websocket: {
        connected: boolean;
        subscriptions: Record<string, string[]>;
    };
}

interface AccountBalance {
    cashBalance: number;
    totalDeposit: number;
    totalEvaluation: number;
    totalPurchase: number;
    totalProfitLoss: number;
    profitLossRate: number;
}

export default function BrokerSettingsPage() {
    const [status, setStatus] = useState<BrokerStatus | null>(null);
    const [balance, setBalance] = useState<AccountBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [refreshingToken, setRefreshingToken] = useState(false);
    const [connectingWs, setConnectingWs] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/broker/status', {
                headers: getAuthHeader(),
            });

            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (error) {
            console.error('Failed to fetch status:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBalance = async () => {
        try {
            const res = await fetch('/api/broker/balance', {
                headers: getAuthHeader(),
            });

            if (res.ok) {
                const data = await res.json();
                setBalance(data);
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchBalance();
        const interval = setInterval(fetchStatus, 10000); // 10초마다 갱신

        return () => clearInterval(interval);
    }, []);

    const handleRefreshToken = async () => {
        setRefreshingToken(true);
        try {
            const res = await fetch('/api/broker/refresh-token', {
                method: 'POST',
                headers: getAuthHeader(),
            });

            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                fetchStatus();
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '토큰 갱신 실패' });
        } finally {
            setRefreshingToken(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleConnectWebSocket = async () => {
        setConnectingWs(true);
        try {
            const res = await fetch('/api/broker/websocket/connect', {
                method: 'POST',
                headers: getAuthHeader(),
            });

            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                fetchStatus();
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'WebSocket 연결 실패' });
        } finally {
            setConnectingWs(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/broker/sync', {
                method: 'POST',
                headers: getAuthHeader(),
            });

            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                fetchBalance();
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '동기화 실패' });
        } finally {
            setSyncing(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('ko-KR').format(num);
    };

    const formatCurrency = (num: number) => {
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">증권사 연동</h1>
                    <p className="text-blue-200">한국투자증권 API 연결 상태 및 계좌 관리</p>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                        message.type === 'success'
                            ? 'bg-green-500/20 border border-green-500/30'
                            : 'bg-red-500/20 border border-red-500/30'
                    }`}>
                        {message.type === 'success' ? (
                            <Check size={20} className="text-green-400" />
                        ) : (
                            <AlertCircle size={20} className="text-red-400" />
                        )}
                        <span className={message.type === 'success' ? 'text-green-300' : 'text-red-300'}>
                            {message.text}
                        </span>
                    </div>
                )}

                {/* Status Cards */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* API Status */}
                    <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                    status?.api.tokenValid ? 'bg-green-500/20' : 'bg-red-500/20'
                                }`}>
                                    <Key size={20} className={
                                        status?.api.tokenValid ? 'text-green-400' : 'text-red-400'
                                    } />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">API 토큰</h3>
                                    <p className={`text-sm ${
                                        status?.api.tokenValid ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                        {status?.api.tokenValid ? '유효함' : '만료됨'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleRefreshToken}
                                disabled={refreshingToken}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {refreshingToken ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                    <RefreshCw size={16} />
                                )}
                                갱신
                            </button>
                        </div>
                        {status?.api.tokenExpiresAt && (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Clock size={14} />
                                만료: {new Date(status.api.tokenExpiresAt).toLocaleString('ko-KR')}
                            </div>
                        )}
                    </div>

                    {/* WebSocket Status */}
                    <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                    status?.websocket.connected ? 'bg-green-500/20' : 'bg-yellow-500/20'
                                }`}>
                                    {status?.websocket.connected ? (
                                        <Wifi size={20} className="text-green-400" />
                                    ) : (
                                        <WifiOff size={20} className="text-yellow-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">실시간 연결</h3>
                                    <p className={`text-sm ${
                                        status?.websocket.connected ? 'text-green-400' : 'text-yellow-400'
                                    }`}>
                                        {status?.websocket.connected ? '연결됨' : '연결 안됨'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleConnectWebSocket}
                                disabled={connectingWs}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {connectingWs ? (
                                    <Zap size={16} className="animate-pulse" />
                                ) : (
                                    <Zap size={16} />
                                )}
                                연결
                            </button>
                        </div>
                        {status?.websocket.subscriptions && Object.keys(status.websocket.subscriptions).length > 0 && (
                            <div className="text-sm text-gray-400">
                                구독: {Object.keys(status.websocket.subscriptions).length}개 채널
                            </div>
                        )}
                    </div>
                </div>

                {/* Account Balance */}
                <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Database size={20} className="text-blue-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white">계좌 잔고</h3>
                        </div>
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {syncing ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <RefreshCw size={16} />
                            )}
                            동기화
                        </button>
                    </div>

                    {balance ? (
                        <div className="grid md:grid-cols-3 gap-6">
                            <div>
                                <div className="text-gray-400 text-sm mb-1">예수금</div>
                                <div className="text-2xl font-bold text-white">
                                    {formatCurrency(balance.cashBalance)}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-sm mb-1">총 평가금액</div>
                                <div className="text-2xl font-bold text-white">
                                    {formatCurrency(balance.totalEvaluation)}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-sm mb-1">평가손익</div>
                                <div className={`text-2xl font-bold ${
                                    balance.totalProfitLoss >= 0 ? 'text-red-400' : 'text-blue-400'
                                }`}>
                                    {balance.totalProfitLoss >= 0 ? '+' : ''}
                                    {formatCurrency(balance.totalProfitLoss)}
                                    <span className="text-base ml-2">
                                        ({balance.profitLossRate >= 0 ? '+' : ''}{balance.profitLossRate.toFixed(2)}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            계좌 정보를 불러올 수 없습니다. 동기화를 시도해주세요.
                        </div>
                    )}
                </div>

                {/* API Key Settings Link */}
                <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gray-500/20 rounded-lg">
                            <Settings size={20} className="text-gray-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">API 키 설정</h3>
                            <p className="text-sm text-gray-400">한국투자증권 OpenAPI 키를 설정하세요</p>
                        </div>
                    </div>
                    <a
                        href="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
                    >
                        <Key size={16} />
                        API 키 설정으로 이동
                    </a>
                </div>
            </div>
        </DashboardLayout>
    );
}
