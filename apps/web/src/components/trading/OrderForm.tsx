'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Check } from 'lucide-react';

interface OrderFormProps {
    symbol: string;
    symbolName: string;
    currentPrice: number;
    initialPrice?: number;
    onOrderSubmit?: (order: OrderData) => void;
}

interface OrderData {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    price?: number;
}

export default function OrderForm({
    symbol,
    symbolName,
    currentPrice,
    initialPrice,
    onOrderSubmit,
}: OrderFormProps) {
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
    const [quantity, setQuantity] = useState<string>('');
    const [price, setPrice] = useState<string>(currentPrice?.toString() || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // 가격 업데이트 (외부에서 호가 클릭 시)
    useEffect(() => {
        if (initialPrice) {
            setPrice(initialPrice.toString());
        }
    }, [initialPrice]);

    // 현재가 변경 시 시장가 주문의 예상 금액 표시용
    useEffect(() => {
        if (orderType === 'MARKET') {
            setPrice(currentPrice?.toString() || '');
        }
    }, [currentPrice, orderType]);

    const totalAmount = (Number(quantity) || 0) * (Number(price) || 0);

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('ko-KR').format(num);
    };

    const handleQuantityPreset = (preset: 'all' | 'half' | 'quarter' | 'custom') => {
        // 실제로는 잔고/주수 기반으로 계산해야 함
        switch (preset) {
            case 'all':
                // 전량 주문 (예시)
                break;
            case 'half':
                // 50% 주문
                break;
            case 'quarter':
                // 25% 주문
                break;
        }
    };

    const validateOrder = (): boolean => {
        if (!symbol) {
            setError('종목을 선택해주세요');
            return false;
        }
        if (!quantity || Number(quantity) <= 0) {
            setError('수량을 입력해주세요');
            return false;
        }
        if (orderType === 'LIMIT' && (!price || Number(price) <= 0)) {
            setError('가격을 입력해주세요');
            return false;
        }
        return true;
    };

    const handleSubmit = async (confirmed = false) => {
        setError(null);

        if (!validateOrder()) return;

        if (!confirmed) {
            setShowConfirm(true);
            return;
        }

        setShowConfirm(false);
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const orderData: OrderData = {
                symbol,
                side,
                orderType,
                quantity: Number(quantity),
                ...(orderType === 'LIMIT' && { price: Number(price) }),
            };

            const res = await fetch('/api/trading/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(orderData),
            });

            if (res.ok) {
                setSuccess(true);
                setQuantity('');
                onOrderSubmit?.(orderData);
                setTimeout(() => setSuccess(false), 3000);
            } else {
                const data = await res.json();
                setError(data.message || '주문 실패');
            }
        } catch (err) {
            setError('주문 처리 중 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden">
            {/* Side Tabs */}
            <div className="grid grid-cols-2">
                <button
                    onClick={() => setSide('BUY')}
                    className={`py-3 font-semibold text-center transition ${
                        side === 'BUY'
                            ? 'bg-red-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                >
                    <TrendingUp size={16} className="inline mr-2" />
                    매수
                </button>
                <button
                    onClick={() => setSide('SELL')}
                    className={`py-3 font-semibold text-center transition ${
                        side === 'SELL'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                >
                    <TrendingDown size={16} className="inline mr-2" />
                    매도
                </button>
            </div>

            <div className="p-4 space-y-4">
                {/* Symbol Info */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">종목</span>
                    <span className="text-white font-medium">
                        {symbolName} <span className="text-gray-400">({symbol})</span>
                    </span>
                </div>

                {/* Order Type */}
                <div>
                    <label className="text-sm text-gray-400 mb-2 block">주문유형</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setOrderType('LIMIT')}
                            className={`py-2 rounded-lg text-sm font-medium transition ${
                                orderType === 'LIMIT'
                                    ? 'bg-white/20 text-white border border-white/30'
                                    : 'bg-white/5 text-gray-400 border border-transparent hover:border-white/20'
                            }`}
                        >
                            지정가
                        </button>
                        <button
                            onClick={() => setOrderType('MARKET')}
                            className={`py-2 rounded-lg text-sm font-medium transition ${
                                orderType === 'MARKET'
                                    ? 'bg-white/20 text-white border border-white/30'
                                    : 'bg-white/5 text-gray-400 border border-transparent hover:border-white/20'
                            }`}
                        >
                            시장가
                        </button>
                    </div>
                </div>

                {/* Price Input */}
                {orderType === 'LIMIT' && (
                    <div>
                        <label className="text-sm text-gray-400 mb-2 block">가격 (원)</label>
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="주문 가격"
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-right text-lg font-medium focus:outline-none focus:border-blue-400"
                        />
                    </div>
                )}

                {/* Quantity Input */}
                <div>
                    <label className="text-sm text-gray-400 mb-2 block">수량 (주)</label>
                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="주문 수량"
                        min="1"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-right text-lg font-medium focus:outline-none focus:border-blue-400"
                    />
                    <div className="grid grid-cols-4 gap-2 mt-2">
                        {['10', '50', '100', '500'].map((q) => (
                            <button
                                key={q}
                                onClick={() => setQuantity(q)}
                                className="py-1 text-xs text-gray-400 bg-white/5 rounded hover:bg-white/10 transition"
                            >
                                {q}주
                            </button>
                        ))}
                    </div>
                </div>

                {/* Total Amount */}
                <div className="p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">예상 체결금액</span>
                        <span className="text-white text-lg font-bold">
                            ₩{formatNumber(totalAmount)}
                        </span>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                        <AlertCircle size={16} className="text-red-400" />
                        <span className="text-red-300 text-sm">{error}</span>
                    </div>
                )}

                {/* Success Message */}
                {success && (
                    <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                        <Check size={16} className="text-green-400" />
                        <span className="text-green-300 text-sm">주문이 접수되었습니다</span>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    onClick={() => handleSubmit(false)}
                    disabled={loading || !quantity}
                    className={`w-full py-4 rounded-lg font-bold text-lg transition ${
                        side === 'BUY'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                    ) : (
                        `${side === 'BUY' ? '매수' : '매도'} 주문`
                    )}
                </button>
            </div>

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-white/20 rounded-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">주문 확인</h3>
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between">
                                <span className="text-gray-400">종목</span>
                                <span className="text-white">{symbolName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">구분</span>
                                <span className={side === 'BUY' ? 'text-red-400' : 'text-blue-400'}>
                                    {side === 'BUY' ? '매수' : '매도'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">유형</span>
                                <span className="text-white">{orderType === 'LIMIT' ? '지정가' : '시장가'}</span>
                            </div>
                            {orderType === 'LIMIT' && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">가격</span>
                                    <span className="text-white">₩{formatNumber(Number(price))}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-400">수량</span>
                                <span className="text-white">{formatNumber(Number(quantity))}주</span>
                            </div>
                            <div className="flex justify-between pt-3 border-t border-white/10">
                                <span className="text-gray-400">예상금액</span>
                                <span className="text-white font-bold">₩{formatNumber(totalAmount)}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => handleSubmit(true)}
                                className={`py-3 rounded-lg font-semibold transition ${
                                    side === 'BUY'
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
