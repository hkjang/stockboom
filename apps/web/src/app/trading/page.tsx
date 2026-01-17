'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import StockSearch from '@/components/trading/StockSearch';
import OrderbookPanel from '@/components/trading/OrderbookPanel';
import OrderForm from '@/components/trading/OrderForm';
import TickerPanel from '@/components/trading/TickerPanel';
import { Activity, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface Stock {
    id: string;
    symbol: string;
    name: string;
    market: string;
    currentPrice?: number;
    changeRate?: number;
}

interface PendingOrder {
    id: string;
    symbol: string;
    name: string;
    side: 'BUY' | 'SELL';
    orderType: string;
    quantity: number;
    price: number;
    filledQuantity: number;
    status: string;
    createdAt: string;
}

export default function TradingPage() {
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [selectedPrice, setSelectedPrice] = useState<number | undefined>(undefined);
    const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // 미체결 주문 조회
    useEffect(() => {
        const fetchPendingOrders = async () => {
            setLoadingOrders(true);
            try {
                const res = await fetch('/api/trading/pending-orders', {
                    headers: getAuthHeader(),
                });

                if (res.ok) {
                    const data = await res.json();
                    setPendingOrders(data);
                }
            } catch (error) {
                console.error('Failed to fetch pending orders:', error);
            } finally {
                setLoadingOrders(false);
            }
        };

        fetchPendingOrders();
        const interval = setInterval(fetchPendingOrders, 5000); // 5초마다 갱신

        return () => clearInterval(interval);
    }, []);

    const handleStockSelect = (stock: Stock) => {
        setSelectedStock(stock);
        setSelectedPrice(stock.currentPrice);
    };

    const handlePriceClick = (price: number) => {
        setSelectedPrice(price);
    };

    const handleOrderSubmit = () => {
        // 주문 후 미체결 조회 갱신
        setTimeout(() => {
            const fetchPendingOrders = async () => {
                const res = await fetch('/api/trading/pending-orders', {
                    headers: getAuthHeader(),
                });
                if (res.ok) {
                    setPendingOrders(await res.json());
                }
            };
            fetchPendingOrders();
        }, 1000);
    };

    const handleCancelOrder = async (orderId: string) => {
        try {
            const res = await fetch(`/api/trading/order/${orderId}/cancel`, {
                method: 'POST',
                headers: getAuthHeader(),
            });

            if (res.ok) {
                // 목록 갱신
                setPendingOrders(prev => prev.filter(o => o.id !== orderId));
            }
        } catch (error) {
            console.error('Cancel failed:', error);
        }
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('ko-KR').format(num);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SUBMITTED':
                return <Clock size={14} className="text-yellow-400" />;
            case 'PARTIALLY_FILLED':
                return <Activity size={14} className="text-blue-400" />;
            case 'FILLED':
                return <CheckCircle size={14} className="text-green-400" />;
            case 'CANCELLED':
                return <XCircle size={14} className="text-red-400" />;
            default:
                return <AlertCircle size={14} className="text-gray-400" />;
        }
    };

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">실시간 매매</h1>
                    <p className="text-blue-200">호가 확인 및 주문 실행</p>
                </div>

                {/* Stock Search */}
                <div className="mb-6">
                    <StockSearch
                        onSelect={handleStockSelect}
                        selectedSymbol={selectedStock?.symbol}
                    />
                </div>

                {selectedStock ? (
                    <>
                        {/* Main Trading Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                            {/* Orderbook */}
                            <div className="lg:col-span-4">
                                <OrderbookPanel
                                    symbol={selectedStock.symbol}
                                    onPriceClick={handlePriceClick}
                                />
                            </div>

                            {/* Order Form */}
                            <div className="lg:col-span-4">
                                <OrderForm
                                    symbol={selectedStock.symbol}
                                    symbolName={selectedStock.name}
                                    currentPrice={selectedStock.currentPrice || 0}
                                    initialPrice={selectedPrice}
                                    onOrderSubmit={handleOrderSubmit}
                                />
                            </div>

                            {/* Ticker Panel */}
                            <div className="lg:col-span-4">
                                <TickerPanel symbol={selectedStock.symbol} />
                            </div>
                        </div>

                        {/* Pending Orders */}
                        <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">미체결 주문</h2>
                                <span className="text-sm text-gray-400">
                                    {pendingOrders.length}건
                                </span>
                            </div>

                            {pendingOrders.length === 0 ? (
                                <div className="px-6 py-12 text-center">
                                    <div className="text-4xl mb-3">📋</div>
                                    <p className="text-gray-400">미체결 주문이 없습니다</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-gray-400">시간</th>
                                                <th className="px-4 py-3 text-left text-gray-400">종목</th>
                                                <th className="px-4 py-3 text-center text-gray-400">구분</th>
                                                <th className="px-4 py-3 text-right text-gray-400">가격</th>
                                                <th className="px-4 py-3 text-right text-gray-400">수량</th>
                                                <th className="px-4 py-3 text-right text-gray-400">체결</th>
                                                <th className="px-4 py-3 text-center text-gray-400">상태</th>
                                                <th className="px-4 py-3 text-center text-gray-400">취소</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {pendingOrders.map((order) => (
                                                <tr key={order.id} className="hover:bg-white/5">
                                                    <td className="px-4 py-3 text-gray-300">
                                                        {new Date(order.createdAt).toLocaleTimeString('ko-KR')}
                                                    </td>
                                                    <td className="px-4 py-3 text-white font-medium">
                                                        {order.name}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                            order.side === 'BUY'
                                                                ? 'bg-red-500/20 text-red-400'
                                                                : 'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                            {order.side === 'BUY' ? '매수' : '매도'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-white">
                                                        ₩{formatNumber(order.price)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-white">
                                                        {formatNumber(order.quantity)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-300">
                                                        {formatNumber(order.filledQuantity)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {getStatusIcon(order.status)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleCancelOrder(order.id)}
                                                            className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 rounded transition"
                                                        >
                                                            취소
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-12 text-center">
                        <div className="text-6xl mb-4">📈</div>
                        <h3 className="text-2xl font-bold text-white mb-2">종목을 선택하세요</h3>
                        <p className="text-gray-400">
                            상단 검색창에서 거래할 종목을 검색하고 선택하세요
                        </p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
