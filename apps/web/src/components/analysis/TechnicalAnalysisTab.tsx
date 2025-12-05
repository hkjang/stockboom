'use client';

import { useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Area, ComposedChart, Bar, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity, BarChart2 } from 'lucide-react';

interface TechnicalData {
    stock: {
        id: string;
        symbol: string;
        name: string;
        currentPrice: number;
        market: string;
    };
    indicators: {
        rsi?: { value: number; signal: string; description: string };
        macd?: { macd: number; signal: number; histogram: number; trend: string };
        bollingerBands?: { upper: number; middle: number; lower: number; position: string };
        stochastic?: { k: number; d: number; signal: string };
        movingAverages?: { sma20: number; sma50: number | null; ema12: number; trend: string };
    };
    chartData: Array<{
        timestamp: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }>;
    signal: {
        signal: string;
        strength: number;
        indicators: { rsi: string; macd: string };
        timestamp: string;
    } | null;
}

interface TechnicalAnalysisTabProps {
    data: TechnicalData | null;
    isLoading: boolean;
    error?: string;
}

// Signal Badge Component
function SignalBadge({ signal, strength }: { signal: string; strength?: number }) {
    const getSignalStyle = () => {
        switch (signal) {
            case 'STRONG_BUY':
                return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
            case 'BUY':
                return 'bg-green-500/20 text-green-400 border border-green-500/30';
            case 'HOLD':
                return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
            case 'SELL':
                return 'bg-red-500/20 text-red-400 border border-red-500/30';
            case 'STRONG_SELL':
                return 'bg-gradient-to-r from-red-500 to-rose-500 text-white';
            default:
                return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
        }
    };

    const getIcon = () => {
        if (signal.includes('BUY')) return <TrendingUp className="w-4 h-4" />;
        if (signal.includes('SELL')) return <TrendingDown className="w-4 h-4" />;
        return <Minus className="w-4 h-4" />;
    };

    return (
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${getSignalStyle()}`}>
            {getIcon()}
            <span>{signal.replace('_', ' ')}</span>
            {strength && <span className="text-xs opacity-75">({strength}%)</span>}
        </div>
    );
}

// Indicator Card Component
function IndicatorCard({
    title,
    value,
    signal,
    description,
    icon: Icon,
    color
}: {
    title: string;
    value: string | number;
    signal?: string;
    description?: string;
    icon: any;
    color: string;
}) {
    const getSignalColor = (s?: string) => {
        if (!s) return 'text-gray-400';
        if (s === 'BUY' || s === 'BULLISH' || s === 'OVERSOLD') return 'text-green-400';
        if (s === 'SELL' || s === 'BEARISH' || s === 'OVERBOUGHT') return 'text-red-400';
        return 'text-yellow-400';
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all hover:transform hover:scale-[1.02]">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-blue-200 font-medium">{title}</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            {signal && (
                <div className={`text-sm font-semibold ${getSignalColor(signal)}`}>
                    {signal}
                </div>
            )}
            {description && (
                <div className="text-xs text-gray-400 mt-1">{description}</div>
            )}
        </div>
    );
}

// RSI Gauge Component
function RSIGauge({ value }: { value: number }) {
    const getColor = () => {
        if (value >= 70) return '#ef4444';
        if (value <= 30) return '#22c55e';
        return '#eab308';
    };

    const percentage = (value / 100) * 100;

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
                <span className="text-blue-200 font-medium">RSI (14)</span>
                <span className="text-2xl font-bold text-white">{value.toFixed(1)}</span>
            </div>
            <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                <div className="absolute inset-0 flex">
                    <div className="w-[30%] bg-green-500/30"></div>
                    <div className="w-[40%] bg-yellow-500/30"></div>
                    <div className="w-[30%] bg-red-500/30"></div>
                </div>
                <div
                    className="absolute h-full w-1 bg-white rounded-full shadow-lg transition-all duration-500"
                    style={{ left: `calc(${percentage}% - 2px)` }}
                ></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>과매도 (0-30)</span>
                <span>중립 (30-70)</span>
                <span>과매수 (70-100)</span>
            </div>
            <div className="mt-3 text-center">
                <span
                    className={`text-sm font-semibold px-3 py-1 rounded-full ${value >= 70 ? 'bg-red-500/20 text-red-400' :
                        value <= 30 ? 'bg-green-500/20 text-green-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}
                >
                    {value >= 70 ? '과매수 구간' : value <= 30 ? '과매도 구간' : '중립 구간'}
                </span>
            </div>
        </div>
    );
}

// MACD Chart Component
function MACDChart({ data, macdData }: { data: any[]; macdData: any }) {
    if (!macdData) return null;

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
                <span className="text-blue-200 font-medium">MACD</span>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${macdData.trend === 'BULLISH' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                    {macdData.trend === 'BULLISH' ? '상승 추세' : '하락 추세'}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                    <div className="text-xs text-gray-400">MACD</div>
                    <div className="text-lg font-bold text-white">{macdData.macd?.toFixed(2)}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-400">Signal</div>
                    <div className="text-lg font-bold text-white">{macdData.signal?.toFixed(2)}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-400">Histogram</div>
                    <div className={`text-lg font-bold ${(macdData.histogram ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {macdData.histogram?.toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TechnicalAnalysisTab({ data, isLoading, error }: TechnicalAnalysisTabProps) {
    const [showVolume, setShowVolume] = useState(true);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-blue-300">기술적 분석 데이터를 불러오는 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-white mb-2">데이터 로드 실패</h3>
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    if (!data || !data.chartData || data.chartData.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-white mb-2">데이터가 없습니다</h3>
                <p className="text-blue-300">이 종목의 기술적 분석 데이터가 충분하지 않습니다.</p>
            </div>
        );
    }

    const { indicators, chartData, signal } = data;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Overall Signal */}
            {signal && (
                <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-1">종합 트레이딩 시그널</h3>
                            <p className="text-sm text-blue-200">RSI, MACD 등 복합 지표 기반</p>
                        </div>
                        <SignalBadge signal={signal.signal} strength={signal.strength} />
                    </div>
                </div>
            )}

            {/* Price Chart */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">가격 차트</h3>
                    <label className="flex items-center gap-2 text-sm text-blue-200 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showVolume}
                            onChange={(e) => setShowVolume(e.target.checked)}
                            className="rounded"
                        />
                        거래량 표시
                    </label>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                            dataKey="timestamp"
                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis
                            yAxisId="price"
                            domain={['auto', 'auto']}
                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                            tickFormatter={(value) => value.toLocaleString()}
                        />
                        {showVolume && (
                            <YAxis
                                yAxisId="volume"
                                orientation="right"
                                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                            />
                        )}
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1f2937',
                                border: '1px solid #374151',
                                borderRadius: '8px',
                            }}
                            labelFormatter={(label) => new Date(label).toLocaleDateString('ko-KR')}
                            formatter={(value: number, name: string) => [
                                name === 'volume' ? `${(value / 1000000).toFixed(2)}M` : value.toLocaleString() + '원',
                                name === 'close' ? '종가' : name === 'volume' ? '거래량' : name
                            ]}
                        />
                        <Legend />
                        <Line
                            yAxisId="price"
                            type="monotone"
                            dataKey="close"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            name="종가"
                        />
                        {showVolume && (
                            <Bar
                                yAxisId="volume"
                                dataKey="volume"
                                fill="#6366f1"
                                opacity={0.3}
                                name="거래량"
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Indicators Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* RSI */}
                {indicators.rsi && (
                    <RSIGauge value={indicators.rsi.value} />
                )}

                {/* MACD */}
                {indicators.macd && (
                    <MACDChart data={chartData} macdData={indicators.macd} />
                )}

                {/* Bollinger Bands */}
                {indicators.bollingerBands && (
                    <IndicatorCard
                        title="볼린저 밴드"
                        value={`${indicators.bollingerBands.middle.toLocaleString()}`}
                        signal={indicators.bollingerBands.position === 'ABOVE_UPPER' ? '상단 돌파' :
                            indicators.bollingerBands.position === 'BELOW_LOWER' ? '하단 돌파' : '밴드 내'}
                        description={`상단: ${indicators.bollingerBands.upper.toLocaleString()} / 하단: ${indicators.bollingerBands.lower.toLocaleString()}`}
                        icon={Activity}
                        color="bg-purple-600"
                    />
                )}

                {/* Stochastic */}
                {indicators.stochastic && (
                    <IndicatorCard
                        title="스토캐스틱"
                        value={`%K: ${indicators.stochastic.k.toFixed(1)}`}
                        signal={indicators.stochastic.signal}
                        description={`%D: ${indicators.stochastic.d.toFixed(1)}`}
                        icon={BarChart2}
                        color="bg-cyan-600"
                    />
                )}

                {/* Moving Averages */}
                {indicators.movingAverages && (
                    <IndicatorCard
                        title="이동평균선"
                        value={`SMA20: ${indicators.movingAverages.sma20?.toLocaleString() ?? 'N/A'}`}
                        signal={indicators.movingAverages.trend === 'ABOVE_MA' ? '상승 추세' : '하락 추세'}
                        description={`SMA50: ${indicators.movingAverages.sma50?.toLocaleString() ?? 'N/A'} | EMA12: ${indicators.movingAverages.ema12?.toLocaleString() ?? 'N/A'}`}
                        icon={TrendingUp}
                        color="bg-orange-600"
                    />
                )}
            </div>

            {/* Individual Indicator Signals */}
            {signal?.indicators && (
                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">개별 지표 시그널</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-white/5 rounded-lg">
                            <div className="text-sm text-gray-400 mb-1">RSI</div>
                            <SignalBadge signal={signal.indicators.rsi} />
                        </div>
                        <div className="text-center p-4 bg-white/5 rounded-lg">
                            <div className="text-sm text-gray-400 mb-1">MACD</div>
                            <SignalBadge signal={signal.indicators.macd} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
