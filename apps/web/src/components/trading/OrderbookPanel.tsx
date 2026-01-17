'use client';

import { useEffect, useState, useRef } from 'react';

interface OrderbookEntry {
    price: number;
    quantity: number;
}

interface OrderbookData {
    symbol: string;
    asks: OrderbookEntry[];
    bids: OrderbookEntry[];
    totalAskQuantity: number;
    totalBidQuantity: number;
    currentPrice: number;
    changeRate: number;
    timestamp: Date;
}

interface OrderbookPanelProps {
    symbol: string;
    onPriceClick?: (price: number) => void;
}

export default function OrderbookPanel({ symbol, onPriceClick }: OrderbookPanelProps) {
    const [orderbook, setOrderbook] = useState<OrderbookData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // REST API로 초기 데이터 로드
    useEffect(() => {
        const fetchOrderbook = async () => {
            if (!symbol) return;
            setLoading(true);
            setError(null);

            try {
                const res = await fetch(`/api/trading/orderbook/${symbol}`, {
                    headers: getAuthHeader(),
                });

                if (res.ok) {
                    const data = await res.json();
                    setOrderbook(data);
                } else {
                    setError('호가 데이터를 불러올 수 없습니다');
                }
            } catch (err) {
                setError('서버 연결 오류');
            } finally {
                setLoading(false);
            }
        };

        fetchOrderbook();
        const interval = setInterval(fetchOrderbook, 2000); // 2초마다 갱신

        return () => clearInterval(interval);
    }, [symbol]);

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('ko-KR').format(num);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('ko-KR').format(price);
    };

    // 최대 수량 계산 (바 차트 비율용)
    const maxQuantity = orderbook
        ? Math.max(
            ...orderbook.asks.map(a => a.quantity),
            ...orderbook.bids.map(b => b.quantity),
            1
        )
        : 1;

    if (loading && !orderbook) {
        return (
            <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-4 h-full">
                <div className="flex items-center justify-center h-full">
                    <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-4">
                <div className="text-center py-8">
                    <div className="text-red-400 mb-2">⚠️</div>
                    <div className="text-red-300 text-sm">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-white font-semibold">호가</h3>
                {orderbook && (
                    <div className={`text-sm font-medium ${orderbook.changeRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {orderbook.changeRate >= 0 ? '+' : ''}{orderbook.changeRate.toFixed(2)}%
                    </div>
                )}
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-3 px-4 py-2 text-xs text-gray-400 border-b border-white/5">
                <div className="text-right">잔량</div>
                <div className="text-center">호가</div>
                <div className="text-left">수량</div>
            </div>

            {/* Sell Orders (Asks) - Ascending */}
            <div className="divide-y divide-white/5">
                {orderbook?.asks.slice().reverse().slice(0, 10).map((ask, idx) => (
                    <div
                        key={`ask-${idx}`}
                        className="grid grid-cols-3 px-4 py-1.5 text-sm hover:bg-blue-500/10 cursor-pointer relative group"
                        onClick={() => onPriceClick?.(ask.price)}
                    >
                        {/* Background bar */}
                        <div
                            className="absolute right-0 top-0 bottom-0 bg-blue-500/20"
                            style={{ width: `${(ask.quantity / maxQuantity) * 100}%` }}
                        />
                        <div className="text-blue-300 text-right z-10">{formatNumber(ask.quantity)}</div>
                        <div className="text-blue-400 text-center font-medium z-10 group-hover:underline">
                            {formatPrice(ask.price)}
                        </div>
                        <div className="z-10" />
                    </div>
                ))}
            </div>

            {/* Current Price */}
            {orderbook && (
                <div className="px-4 py-3 bg-white/10 border-y border-white/20">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">현재가</span>
                        <span className={`text-xl font-bold ${orderbook.changeRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            {formatPrice(orderbook.currentPrice)}
                        </span>
                    </div>
                </div>
            )}

            {/* Buy Orders (Bids) - Descending */}
            <div className="divide-y divide-white/5">
                {orderbook?.bids.slice(0, 10).map((bid, idx) => (
                    <div
                        key={`bid-${idx}`}
                        className="grid grid-cols-3 px-4 py-1.5 text-sm hover:bg-red-500/10 cursor-pointer relative group"
                        onClick={() => onPriceClick?.(bid.price)}
                    >
                        {/* Background bar */}
                        <div
                            className="absolute left-0 top-0 bottom-0 bg-red-500/20"
                            style={{ width: `${(bid.quantity / maxQuantity) * 100}%` }}
                        />
                        <div className="z-10" />
                        <div className="text-red-400 text-center font-medium z-10 group-hover:underline">
                            {formatPrice(bid.price)}
                        </div>
                        <div className="text-red-300 text-left z-10">{formatNumber(bid.quantity)}</div>
                    </div>
                ))}
            </div>

            {/* Footer - Totals */}
            <div className="px-4 py-3 border-t border-white/10 grid grid-cols-2 gap-4 text-xs">
                <div className="text-center">
                    <div className="text-gray-400">총 매도잔량</div>
                    <div className="text-blue-300 font-medium">{formatNumber(orderbook?.totalAskQuantity || 0)}</div>
                </div>
                <div className="text-center">
                    <div className="text-gray-400">총 매수잔량</div>
                    <div className="text-red-300 font-medium">{formatNumber(orderbook?.totalBidQuantity || 0)}</div>
                </div>
            </div>
        </div>
    );
}
