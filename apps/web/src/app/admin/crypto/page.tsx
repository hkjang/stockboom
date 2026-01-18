'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
    Bitcoin, TrendingUp, TrendingDown, RefreshCw, 
    ChevronUp, ChevronDown, BarChart2, Clock, Gauge, AlertCircle
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface CryptoTicker {
    market: string;
    name: string;
    tradePrice: number;
    change: 'RISE' | 'EVEN' | 'FALL';
    changeRate: number;
    accTradePrice24h: number;
}

export default function CryptoDashboard() {
    const { data, mutate, isLoading, error } = useSWR('/api/admin/crypto/tickers', fetcher, {
        refreshInterval: 5000,
    });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const tickers: CryptoTicker[] = data?.tickers || [];
    const sentiment = data?.sentiment || { score: 50, label: '데이터 없음', factors: {} };
    const isRealData = !!data?.tickers?.length;

    const getSentimentColor = (score: number) => {
        if (score >= 75) return 'text-green-400 bg-green-400/20';
        if (score >= 55) return 'text-lime-400 bg-lime-400/20';
        if (score >= 45) return 'text-yellow-400 bg-yellow-400/20';
        if (score >= 25) return 'text-orange-400 bg-orange-400/20';
        return 'text-red-400 bg-red-400/20';
    };

    const formatPrice = (price: number) => {
        if (price >= 1000000) return `₩${(price / 1000000).toFixed(2)}M`;
        if (price >= 1000) return `₩${price.toLocaleString()}`;
        return `₩${price}`;
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
                        <Bitcoin size={24} className="text-orange-400" />
                        암호화폐 대시보드
                        {isRealData && <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">LIVE</span>}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">실시간 시세 및 시장 심리 분석 (Upbit API)</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-blue-200">
                        <Clock size={14} />
                        {currentTime.toLocaleTimeString('ko-KR')}
                    </div>
                    <button 
                        onClick={() => mutate()} 
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </div>

            {/* Fear & Greed Index */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Gauge size={18} className="text-yellow-400" />
                        <span className="text-sm font-medium text-white">공포 & 탐욕 지수</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${getSentimentColor(sentiment.score)}`}>
                            {sentiment.score}
                        </div>
                        <div>
                            <p className={`text-lg font-bold ${getSentimentColor(sentiment.score).split(' ')[0]}`}>{sentiment.label}</p>
                            {sentiment.factors?.risingCoins !== undefined && (
                                <>
                                    <p className="text-xs text-blue-200/70 mt-1">
                                        상승 {sentiment.factors.risingCoins} · 하락 {sentiment.factors.fallingCoins}
                                    </p>
                                    <p className="text-xs text-blue-200/70">
                                        평균 {sentiment.factors.avgChangeRate}%
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full relative">
                        <div 
                            className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-gray-800 transition-all"
                            style={{ left: `${sentiment.score}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-blue-200/50 mt-1">
                        <span>극단적 공포</span>
                        <span>극단적 탐욕</span>
                    </div>
                </div>

                {/* Top Gainer */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp size={18} className="text-green-400" />
                        <span className="text-sm font-medium text-white">최대 상승</span>
                    </div>
                    {tickers.length > 0 ? (() => {
                        const topGainer = [...tickers].sort((a, b) => b.changeRate - a.changeRate)[0];
                        return topGainer ? (
                            <div>
                                <p className="text-lg font-bold text-white">{topGainer.name || topGainer.market}</p>
                                <p className="text-2xl font-bold text-green-400">
                                    +{(topGainer.changeRate * 100).toFixed(2)}%
                                </p>
                                <p className="text-sm text-blue-200">{formatPrice(topGainer.tradePrice)}</p>
                            </div>
                        ) : null;
                    })() : <p className="text-blue-200/50">데이터 로딩중...</p>}
                </div>

                {/* Top Loser */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingDown size={18} className="text-red-400" />
                        <span className="text-sm font-medium text-white">최대 하락</span>
                    </div>
                    {tickers.length > 0 ? (() => {
                        const topLoser = [...tickers].sort((a, b) => a.changeRate - b.changeRate)[0];
                        return topLoser ? (
                            <div>
                                <p className="text-lg font-bold text-white">{topLoser.name || topLoser.market}</p>
                                <p className="text-2xl font-bold text-red-400">
                                    {(topLoser.changeRate * 100).toFixed(2)}%
                                </p>
                                <p className="text-sm text-blue-200">{formatPrice(topLoser.tradePrice)}</p>
                            </div>
                        ) : null;
                    })() : <p className="text-blue-200/50">데이터 로딩중...</p>}
                </div>
            </div>

            {/* Crypto Tickers Grid */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <BarChart2 size={14} className="text-cyan-400" />
                    주요 암호화폐
                    {isLoading && <RefreshCw size={12} className="animate-spin text-blue-400" />}
                </h3>
                {tickers.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {tickers.map((ticker, i) => (
                            <div 
                                key={i}
                                className={`p-3 rounded-lg border transition-all hover:scale-[1.02] ${
                                    ticker.change === 'RISE' 
                                        ? 'bg-green-500/10 border-green-500/30' 
                                        : ticker.change === 'FALL' 
                                        ? 'bg-red-500/10 border-red-500/30'
                                        : 'bg-white/5 border-white/10'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-white font-medium">{ticker.name || ticker.market.split('-')[1]}</p>
                                        <p className="text-[10px] text-blue-200/50">{ticker.market}</p>
                                    </div>
                                    <span className={`flex items-center text-xs ${
                                        ticker.change === 'RISE' ? 'text-green-400' : ticker.change === 'FALL' ? 'text-red-400' : 'text-gray-400'
                                    }`}>
                                        {ticker.change === 'RISE' ? <ChevronUp size={12} /> : ticker.change === 'FALL' ? <ChevronDown size={12} /> : null}
                                        {(ticker.changeRate * 100).toFixed(2)}%
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-white">{formatPrice(ticker.tradePrice)}</p>
                                <p className="text-[10px] text-blue-200/50 mt-1">
                                    거래대금 {(ticker.accTradePrice24h / 1e12).toFixed(2)}조
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-blue-200/50">암호화폐 데이터를 불러오는 중...</p>
                    </div>
                )}
            </div>

            {/* Data Source Info */}
            <div className="text-center text-xs text-blue-200/50">
                데이터 제공: Upbit API | 자동 갱신: 5초 | 마지막 업데이트: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('ko-KR') : '-'}
            </div>
        </div>
    );
}
