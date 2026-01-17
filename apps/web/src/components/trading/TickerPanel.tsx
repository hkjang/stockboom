'use client';

import { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TickerEntry {
    time: string;
    price: number;
    change: number;
    volume: number;
    side: 'BUY' | 'SELL';
}

interface TickerPanelProps {
    symbol: string;
    maxEntries?: number;
}

export default function TickerPanel({ symbol, maxEntries = 30 }: TickerPanelProps) {
    const [tickers, setTickers] = useState<TickerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // 초기 데이터 및 폴링
    useEffect(() => {
        const fetchTickers = async () => {
            if (!symbol) return;

            try {
                const res = await fetch(`/api/trading/tickers/${symbol}?limit=${maxEntries}`, {
                    headers: getAuthHeader(),
                });

                if (res.ok) {
                    const data = await res.json();
                    setTickers(data);
                }
            } catch (error) {
                console.error('Failed to fetch tickers:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTickers();
        const interval = setInterval(fetchTickers, 1000); // 1초마다 갱신

        return () => clearInterval(interval);
    }, [symbol, maxEntries]);

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('ko-KR').format(num);
    };

    if (loading) {
        return (
            <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
                <h3 className="text-white font-semibold">체결내역</h3>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-4 px-4 py-2 text-xs text-gray-400 border-b border-white/5">
                <div>시간</div>
                <div className="text-right">가격</div>
                <div className="text-right">등락</div>
                <div className="text-right">수량</div>
            </div>

            {/* Ticker List */}
            <div
                ref={scrollRef}
                className="max-h-80 overflow-y-auto divide-y divide-white/5"
            >
                {tickers.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">
                        체결 데이터가 없습니다
                    </div>
                ) : (
                    tickers.map((ticker, idx) => (
                        <div
                            key={idx}
                            className="grid grid-cols-4 px-4 py-2 text-sm hover:bg-white/5"
                        >
                            <div className="text-gray-400">{ticker.time}</div>
                            <div className={`text-right font-medium ${
                                ticker.side === 'BUY' ? 'text-red-400' : 'text-blue-400'
                            }`}>
                                {formatNumber(ticker.price)}
                            </div>
                            <div className={`text-right text-xs flex items-center justify-end gap-1 ${
                                ticker.change >= 0 ? 'text-red-400' : 'text-blue-400'
                            }`}>
                                {ticker.change >= 0 ? (
                                    <TrendingUp size={12} />
                                ) : (
                                    <TrendingDown size={12} />
                                )}
                                {ticker.change >= 0 ? '+' : ''}{ticker.change}
                            </div>
                            <div className="text-right text-gray-300">
                                {formatNumber(ticker.volume)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
