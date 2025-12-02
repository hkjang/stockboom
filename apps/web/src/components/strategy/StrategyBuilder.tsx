'use client';

import { useState } from 'react';
import { Card } from '../ui/Card';

interface StrategyBuilderProps {
    onSave?: (strategy: any) => void;
}

export function StrategyBuilder({ onSave }: StrategyBuilderProps) {
    const [strategyName, setStrategyName] = useState('');
    const [indicators, setIndicators] = useState({
        sma: { enabled: false, periods: [20, 60] },
        rsi: { enabled: false, period: 14, overbought: 70, oversold: 30 },
        macd: { enabled: false },
        stochastic: { enabled: false, kPeriod: 14, dPeriod: 3 },
    });
    const [stopLoss, setStopLoss] = useState(5);
    const [takeProfit, setTakeProfit] = useState(10);
    const [maxPositionSize, setMaxPositionSize] = useState(1000000);

    const handleSave = () => {
        const strategy = {
            name: strategyName,
            config: { indicators },
            stopLossPercent: stopLoss,
            takeProfitPercent: takeProfit,
            maxPositionSize,
        };
        onSave?.(strategy);
    };

    return (
        <div className="space-y-6">
            <Card title="전략 기본 정보">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            전략 이름
                        </label>
                        <input
                            type="text"
                            value={strategyName}
                            onChange={(e) => setStrategyName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="예: 단기 모멘텀 전략"
                        />
                    </div>
                </div>
            </Card>

            <Card title="기술적 지표">
                <div className="space-y-4">
                    {/* SMA */}
                    <div className="border-b pb-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={indicators.sma.enabled}
                                    onChange={(e) => setIndicators({
                                        ...indicators,
                                        sma: { ...indicators.sma, enabled: e.target.checked }
                                    })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="font-medium">이동평균선 (SMA)</span>
                            </label>
                        </div>
                        {indicators.sma.enabled && (
                            <div className="ml-6 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-600">기간:</label>
                                    <input
                                        type="number"
                                        value={indicators.sma.periods[0]}
                                        onChange={(e) => setIndicators({
                                            ...indicators,
                                            sma: { ...indicators.sma, periods: [Number(e.target.value), indicators.sma.periods[1]] }
                                        })}
                                        className="w-20 px-2 py-1 border rounded"
                                    />
                                    <input
                                        type="number"
                                        value={indicators.sma.periods[1]}
                                        onChange={(e) => setIndicators({
                                            ...indicators,
                                            sma: { ...indicators.sma, periods: [indicators.sma.periods[0], Number(e.target.value)] }
                                        })}
                                        className="w-20 px-2 py-1 border rounded"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RSI */}
                    <div className="border-b pb-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={indicators.rsi.enabled}
                                    onChange={(e) => setIndicators({
                                        ...indicators,
                                        rsi: { ...indicators.rsi, enabled: e.target.checked }
                                    })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="font-medium">RSI</span>
                            </label>
                        </div>
                        {indicators.rsi.enabled && (
                            <div className="ml-6 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-600 w-20">기간:</label>
                                    <input
                                        type="number"
                                        value={indicators.rsi.period}
                                        onChange={(e) => setIndicators({
                                            ...indicators,
                                            rsi: { ...indicators.rsi, period: Number(e.target.value) }
                                        })}
                                        className="w-20 px-2 py-1 border rounded"
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-600 w-20">과매수:</label>
                                    <input
                                        type="number"
                                        value={indicators.rsi.overbought}
                                        onChange={(e) => setIndicators({
                                            ...indicators,
                                            rsi: { ...indicators.rsi, overbought: Number(e.target.value) }
                                        })}
                                        className="w-20 px-2 py-1 border rounded"
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-600 w-20">과매도:</label>
                                    <input
                                        type="number"
                                        value={indicators.rsi.oversold}
                                        onChange={(e) => setIndicators({
                                            ...indicators,
                                            rsi: { ...indicators.rsi, oversold: Number(e.target.value) }
                                        })}
                                        className="w-20 px-2 py-1 border rounded"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MACD */}
                    <div className="border-b pb-4">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={indicators.macd.enabled}
                                onChange={(e) => setIndicators({
                                    ...indicators,
                                    macd: { enabled: e.target.checked }
                                })}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="font-medium">MACD</span>
                        </label>
                    </div>

                    {/* Stochastic */}
                    <div>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={indicators.stochastic.enabled}
                                onChange={(e) => setIndicators({
                                    ...indicators,
                                    stochastic: { ...indicators.stochastic, enabled: e.target.checked }
                                })}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="font-medium">Stochastic</span>
                        </label>
                    </div>
                </div>
            </Card>

            <Card title="리스크 관리">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            손절 비율 (%)
                        </label>
                        <input
                            type="number"
                            value={stopLoss}
                            onChange={(e) => setStopLoss(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            min="0"
                            max="100"
                            step="0.5"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            매수가 대비 {stopLoss}% 하락 시 자동 손절
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            익절 비율 (%)
                        </label>
                        <input
                            type="number"
                            value={takeProfit}
                            onChange={(e) => setTakeProfit(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            min="0"
                            max="1000"
                            step="0.5"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            매수가 대비 {takeProfit}% 상승 시 자동 익절
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            최대 포지션 크기 (원)
                        </label>
                        <input
                            type="number"
                            value={maxPositionSize}
                            onChange={(e) => setMaxPositionSize(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            step="100000"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            종목당 최대 투자 금액: {maxPositionSize.toLocaleString()}원
                        </p>
                    </div>
                </div>
            </Card>

            <div className="flex justify-end space-x-3">
                <button
                    type="button"
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    취소
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    저장
                </button>
            </div>
        </div>
    );
}
