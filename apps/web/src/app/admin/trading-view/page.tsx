'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { 
    TrendingUp, TrendingDown, Activity, BarChart3, Clock, 
    RefreshCw, Play, Pause, Settings, Target, AlertTriangle,
    Zap, ChevronUp, ChevronDown, ArrowRight, Volume2
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface Signal {
    type: 'BUY' | 'SELL' | 'HOLD';
    strength: number;
    indicator: string;
    price: number;
    timestamp: Date;
}

export default function TradingViewPage() {
    const { data: stocksData } = useSWR('/api/admin/stocks', fetcher);
    const [selectedStock, setSelectedStock] = useState<string>('005930');
    const [isLive, setIsLive] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [signals, setSignals] = useState<Signal[]>([]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Simulated real-time data
    const [priceData, setPriceData] = useState({
        current: 71500,
        open: 71000,
        high: 72100,
        low: 70800,
        volume: 15234567,
        change: 500,
        changePercent: 0.70,
    });

    const [indicators, setIndicators] = useState({
        rsi: 58.5,
        macd: { value: 125, signal: 98, histogram: 27 },
        stochastic: { k: 72, d: 68 },
        atr: 1250,
        adx: 32,
        vwap: 71200,
    });

    // Simulated price updates
    useEffect(() => {
        if (!isLive) return;
        
        const interval = setInterval(() => {
            setPriceData(prev => {
                const changeAmount = (Math.random() - 0.5) * 200;
                const newPrice = Math.max(prev.low, Math.min(prev.high, prev.current + changeAmount));
                const newHigh = Math.max(prev.high, newPrice);
                const newLow = Math.min(prev.low, newPrice);
                
                return {
                    ...prev,
                    current: Math.round(newPrice),
                    high: newHigh,
                    low: newLow,
                    change: Math.round(newPrice - prev.open),
                    changePercent: ((newPrice - prev.open) / prev.open * 100),
                    volume: prev.volume + Math.floor(Math.random() * 10000),
                };
            });

            // Update indicators randomly
            setIndicators(prev => ({
                ...prev,
                rsi: Math.max(0, Math.min(100, prev.rsi + (Math.random() - 0.5) * 5)),
                stochastic: {
                    k: Math.max(0, Math.min(100, prev.stochastic.k + (Math.random() - 0.5) * 3)),
                    d: Math.max(0, Math.min(100, prev.stochastic.d + (Math.random() - 0.5) * 2)),
                },
                adx: Math.max(0, Math.min(100, prev.adx + (Math.random() - 0.5) * 2)),
            }));

            // Random signal generation
            if (Math.random() > 0.95) {
                const types: ('BUY' | 'SELL' | 'HOLD')[] = ['BUY', 'SELL', 'HOLD'];
                const indicatorNames = ['RSI', 'MACD', 'Stochastic', 'ADX', 'Bollinger'];
                setSignals(prev => [{
                    type: types[Math.floor(Math.random() * 3)],
                    strength: Math.floor(Math.random() * 40) + 60,
                    indicator: indicatorNames[Math.floor(Math.random() * indicatorNames.length)],
                    price: priceData.current,
                    timestamp: new Date(),
                }, ...prev.slice(0, 9)]);
            }
        }, 1000);
        
        return () => clearInterval(interval);
    }, [isLive, priceData.current, priceData.open]);

    const getSignalColor = (type: string) => {
        switch (type) {
            case 'BUY': return 'text-green-400 bg-green-400/20';
            case 'SELL': return 'text-red-400 bg-red-400/20';
            default: return 'text-yellow-400 bg-yellow-400/20';
        }
    };

    const getRSIStatus = (rsi: number) => {
        if (rsi >= 70) return { label: '과매수', color: 'text-red-400' };
        if (rsi <= 30) return { label: '과매도', color: 'text-green-400' };
        return { label: '중립', color: 'text-yellow-400' };
    };

    const rsiStatus = getRSIStatus(indicators.rsi);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity size={24} className="text-cyan-400" />
                        실시간 트레이딩 뷰
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">실시간 시세 및 기술적 분석</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-blue-200">
                        <Clock size={14} />
                        {currentTime.toLocaleTimeString('ko-KR')}
                    </div>
                    <button 
                        onClick={() => setIsLive(!isLive)}
                        className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 transition-colors ${
                            isLive ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                        }`}
                    >
                        {isLive ? <Pause size={12} /> : <Play size={12} />}
                        {isLive ? '실시간' : '일시정지'}
                    </button>
                </div>
            </div>

            {/* Price Display */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-white">삼성전자</span>
                            <span className="text-sm text-blue-200">005930</span>
                            {isLive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-3xl font-bold text-white">₩{priceData.current.toLocaleString()}</span>
                            <span className={`text-lg font-semibold flex items-center gap-1 ${priceData.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {priceData.change >= 0 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                {priceData.change >= 0 ? '+' : ''}{priceData.change.toLocaleString()} ({priceData.changePercent.toFixed(2)}%)
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-xs text-blue-200">시가</p>
                            <p className="text-white font-medium">₩{priceData.open.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-blue-200">고가</p>
                            <p className="text-red-400 font-medium">₩{priceData.high.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-blue-200">저가</p>
                            <p className="text-blue-400 font-medium">₩{priceData.low.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-blue-200">거래량</p>
                            <p className="text-white font-medium">{(priceData.volume / 1000000).toFixed(1)}M</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Technical Indicators Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* RSI */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-200">RSI (14)</span>
                        <span className={`text-xs ${rsiStatus.color}`}>{rsiStatus.label}</span>
                    </div>
                    <p className="text-xl font-bold text-white">{indicators.rsi.toFixed(1)}</p>
                    <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${indicators.rsi >= 70 ? 'bg-red-500' : indicators.rsi <= 30 ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${indicators.rsi}%` }}
                        />
                    </div>
                </div>

                {/* MACD */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-200">MACD</span>
                        <span className={`text-xs ${indicators.macd.histogram >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {indicators.macd.histogram >= 0 ? '상승' : '하락'}
                        </span>
                    </div>
                    <p className="text-xl font-bold text-white">{indicators.macd.value}</p>
                    <p className="text-xs text-blue-200/70">시그널: {indicators.macd.signal}</p>
                </div>

                {/* Stochastic */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-200">Stochastic</span>
                        <span className={`text-xs ${indicators.stochastic.k >= 80 ? 'text-red-400' : indicators.stochastic.k <= 20 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {indicators.stochastic.k >= 80 ? '과매수' : indicators.stochastic.k <= 20 ? '과매도' : '중립'}
                        </span>
                    </div>
                    <p className="text-xl font-bold text-white">%K: {indicators.stochastic.k.toFixed(0)}</p>
                    <p className="text-xs text-blue-200/70">%D: {indicators.stochastic.d.toFixed(0)}</p>
                </div>

                {/* ADX */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-200">ADX</span>
                        <span className={`text-xs ${indicators.adx >= 25 ? 'text-green-400' : 'text-gray-400'}`}>
                            {indicators.adx >= 25 ? '추세' : '비추세'}
                        </span>
                    </div>
                    <p className="text-xl font-bold text-white">{indicators.adx.toFixed(1)}</p>
                    <p className="text-xs text-blue-200/70">{indicators.adx >= 50 ? '강한 추세' : indicators.adx >= 25 ? '추세 형성' : '횡보'}</p>
                </div>

                {/* ATR */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-200">ATR (14)</span>
                        <span className="text-xs text-cyan-400">변동성</span>
                    </div>
                    <p className="text-xl font-bold text-white">₩{indicators.atr.toLocaleString()}</p>
                    <p className="text-xs text-blue-200/70">{(indicators.atr / priceData.current * 100).toFixed(2)}%</p>
                </div>

                {/* VWAP */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-200">VWAP</span>
                        <span className={`text-xs ${priceData.current >= indicators.vwap ? 'text-green-400' : 'text-red-400'}`}>
                            {priceData.current >= indicators.vwap ? '상단' : '하단'}
                        </span>
                    </div>
                    <p className="text-xl font-bold text-white">₩{indicators.vwap.toLocaleString()}</p>
                    <p className="text-xs text-blue-200/70">
                        {priceData.current >= indicators.vwap ? '+' : ''}{(priceData.current - indicators.vwap).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Signals Feed */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Zap size={14} className="text-yellow-400" />
                    실시간 시그널
                </h3>
                {signals.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {signals.map((signal, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSignalColor(signal.type)}`}>
                                        {signal.type}
                                    </span>
                                    <span className="text-white text-sm">{signal.indicator}</span>
                                    <span className="text-blue-200/70 text-xs">강도: {signal.strength}%</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-white text-sm">₩{signal.price.toLocaleString()}</p>
                                    <p className="text-xs text-blue-200/50">{signal.timestamp.toLocaleTimeString('ko-KR')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-blue-200/50 text-sm text-center py-4">시그널 대기 중...</p>
                )}
            </div>
        </div>
    );
}
