'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
    TrendingUp, TrendingDown, Activity, BarChart3, Globe, Building2,
    RefreshCw, ArrowUpRight, ArrowDownRight, Clock, Wifi, WifiOff
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

export default function MarketDataDashboard() {
    const { data: marketData, mutate, isLoading } = useSWR('/api/admin/market-data', fetcher, {
        refreshInterval: 60000,
    });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Mock data for demo (replace with real API data)
    const indices = marketData?.indices || [
        { name: 'KOSPI', value: 2547.82, change: 12.45, changePercent: 0.49, volume: 453200000 },
        { name: 'KOSDAQ', value: 842.31, change: -5.23, changePercent: -0.62, volume: 892100000 },
        { name: 'KRX100', value: 5823.15, change: 28.72, changePercent: 0.50, volume: 125000000 },
    ];

    const topVolume = marketData?.topVolume || [
        { rank: 1, symbol: '005930', name: '삼성전자', price: 71000, change: 1.8, volume: 15234567 },
        { rank: 2, symbol: '000660', name: 'SK하이닉스', price: 145000, change: -0.5, volume: 8456123 },
        { rank: 3, symbol: '373220', name: 'LG에너지솔루션', price: 420000, change: 2.1, volume: 567890 },
        { rank: 4, symbol: '035420', name: 'NAVER', price: 235000, change: 0.8, volume: 1234567 },
        { rank: 5, symbol: '035720', name: '카카오', price: 55000, change: -1.2, volume: 3456789 },
    ];

    const foreignNet = marketData?.foreignNet || [
        { rank: 1, symbol: '005930', name: '삼성전자', netBuying: 125000, holdingPct: 52.3 },
        { rank: 2, symbol: '000660', name: 'SK하이닉스', netBuying: 85000, holdingPct: 48.7 },
        { rank: 3, symbol: '051910', name: 'LG화학', netBuying: 45000, holdingPct: 35.2 },
        { rank: 4, symbol: '005380', name: '현대차', netBuying: 32000, holdingPct: 41.5 },
        { rank: 5, symbol: '035420', name: 'NAVER', netBuying: 28000, holdingPct: 55.8 },
    ];

    const institutionalNet = marketData?.institutionalNet || [
        { rank: 1, symbol: '373220', name: 'LG에너지솔루션', netBuying: 95000 },
        { rank: 2, symbol: '006400', name: '삼성SDI', netBuying: 72000 },
        { rank: 3, symbol: '051910', name: 'LG화학', netBuying: 58000 },
        { rank: 4, symbol: '000660', name: 'SK하이닉스', netBuying: 45000 },
        { rank: 5, symbol: '035720', name: '카카오', netBuying: -32000 },
    ];

    const sectors = marketData?.sectors || [
        { name: '반도체', change: 2.3, stocks: 45 },
        { name: '2차전지', change: 1.8, stocks: 32 },
        { name: '바이오', change: -0.5, stocks: 128 },
        { name: '자동차', change: 1.2, stocks: 28 },
        { name: '금융', change: -0.3, stocks: 65 },
        { name: 'IT서비스', change: 0.8, stocks: 89 },
        { name: '건설', change: -1.2, stocks: 42 },
        { name: '화학', change: 0.5, stocks: 56 },
    ];

    const isMarketOpen = () => {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const min = now.getMinutes();
        const time = hour * 100 + min;
        return day >= 1 && day <= 5 && time >= 900 && time < 1530;
    };

    const IndexCard = ({ index }: { index: any }) => (
        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-xl p-4 hover:from-white/15 hover:to-white/10 transition-all">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-blue-400" />
                    <span className="text-sm font-medium text-white">{index.name}</span>
                </div>
                <div className={`flex items-center gap-1 text-xs ${index.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {index.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
                </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{index.value.toLocaleString('ko-KR', { minimumFractionDigits: 2 })}</p>
            <div className="flex justify-between text-xs text-blue-200/70">
                <span>{index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}</span>
                <span>거래량 {(index.volume / 100000000).toFixed(1)}억</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <BarChart3 size={24} className="text-cyan-400" />
                        시장 데이터 대시보드
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">실시간 시장 현황 및 투자자 동향</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${isMarketOpen() ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {isMarketOpen() ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {isMarketOpen() ? '장중' : '장마감'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-blue-200">
                        <Clock size={14} />
                        {currentTime.toLocaleTimeString('ko-KR')}
                    </div>
                    <button 
                        onClick={() => mutate()} 
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg flex items-center gap-1"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </div>

            {/* Market Indices */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {indices.map((index, i) => (
                    <IndexCard key={i} index={index} />
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Volume Stocks */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <TrendingUp size={14} className="text-purple-400" />
                        거래량 상위
                    </h3>
                    <div className="space-y-2">
                        {topVolume.map((stock, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center">{stock.rank}</span>
                                    <div>
                                        <p className="text-white text-sm font-medium">{stock.name}</p>
                                        <p className="text-blue-200/50 text-xs">{stock.symbol}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-white text-sm">₩{stock.price.toLocaleString()}</p>
                                    <p className={`text-xs ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Foreign Investor Flow */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Globe size={14} className="text-blue-400" />
                        외국인 순매수
                    </h3>
                    <div className="space-y-2">
                        {foreignNet.map((stock, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center">{stock.rank}</span>
                                    <div>
                                        <p className="text-white text-sm font-medium">{stock.name}</p>
                                        <p className="text-blue-200/50 text-xs">보유율 {stock.holdingPct}%</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-medium ${stock.netBuying >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stock.netBuying >= 0 ? '+' : ''}{(stock.netBuying / 1000).toFixed(0)}천주
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Institutional Flow */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Building2 size={14} className="text-orange-400" />
                        기관 순매수
                    </h3>
                    <div className="space-y-2">
                        {institutionalNet.map((stock, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-xs flex items-center justify-center">{stock.rank}</span>
                                    <p className="text-white text-sm font-medium">{stock.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-medium ${stock.netBuying >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stock.netBuying >= 0 ? '+' : ''}{(stock.netBuying / 1000).toFixed(0)}천주
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sector Heatmap */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <BarChart3 size={14} className="text-cyan-400" />
                        업종별 현황
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                        {sectors.map((sector, i) => {
                            const intensity = Math.min(Math.abs(sector.change) / 3, 1);
                            const bgColor = sector.change >= 0 
                                ? `rgba(34, 197, 94, ${0.15 + intensity * 0.35})` 
                                : `rgba(239, 68, 68, ${0.15 + intensity * 0.35})`;
                            return (
                                <div 
                                    key={i} 
                                    className="p-2 rounded-lg text-center transition-all hover:scale-105"
                                    style={{ backgroundColor: bgColor }}
                                >
                                    <p className="text-white text-xs font-medium truncate">{sector.name}</p>
                                    <p className={`text-sm font-bold ${sector.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(1)}%
                                    </p>
                                    <p className="text-[10px] text-blue-200/50">{sector.stocks}종목</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer Info */}
            <div className="text-center text-xs text-blue-200/50">
                데이터 제공: KIS API, Naver Finance, 공공데이터포털 | 마지막 업데이트: {new Date().toLocaleString('ko-KR')}
            </div>
        </div>
    );
}
