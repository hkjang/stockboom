'use client';

import { useState } from 'react';
import { 
    Play, Pause, BarChart2, Calendar, TrendingUp, TrendingDown,
    Settings, Download, RefreshCw, AlertCircle, CheckCircle
} from 'lucide-react';

interface BacktestResult {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    tradeCount: number;
    avgHoldingDays: number;
    profitFactor: number;
}

export default function BacktestPage() {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [config, setConfig] = useState({
        strategy: 'rsi_oversold',
        symbol: '005930',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        initialCapital: 10000000,
        positionSize: 10,
        stopLoss: 5,
        takeProfit: 15,
    });
    const [result, setResult] = useState<BacktestResult | null>(null);

    const strategies = [
        { id: 'rsi_oversold', name: 'RSI 과매도 반등', description: 'RSI 30 이하 진입, 70 이상 청산' },
        { id: 'macd_crossover', name: 'MACD 골든크로스', description: 'MACD 시그널 돌파 시 진입' },
        { id: 'bollinger_bounce', name: '볼린저밴드 반등', description: '하단 밴드 터치 시 매수' },
        { id: 'golden_cross', name: '골든 크로스', description: 'SMA20/SMA50 교차' },
        { id: 'momentum', name: '모멘텀 전략', description: '52주 신고가 돌파' },
    ];

    const handleRunBacktest = () => {
        setIsRunning(true);
        setProgress(0);
        setResult(null);

        // Simulate backtest progress
        const interval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) {
                    clearInterval(interval);
                    setIsRunning(false);
                    // Generate mock result
                    setResult({
                        totalReturn: 23.5 + (Math.random() - 0.5) * 10,
                        winRate: 58 + (Math.random() - 0.5) * 15,
                        sharpeRatio: 1.45 + (Math.random() - 0.5) * 0.5,
                        maxDrawdown: 12.3 + (Math.random() - 0.5) * 5,
                        tradeCount: Math.floor(40 + Math.random() * 30),
                        avgHoldingDays: Math.floor(5 + Math.random() * 10),
                        profitFactor: 1.8 + (Math.random() - 0.5) * 0.4,
                    });
                    return 100;
                }
                return p + 2;
            });
        }, 50);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <BarChart2 size={24} className="text-green-400" />
                        백테스팅
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">과거 데이터로 전략 성과 검증</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Strategy Selection */}
                    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <Settings size={14} className="text-blue-400" />
                            전략 선택
                        </h3>
                        <div className="space-y-2">
                            {strategies.map(s => (
                                <label 
                                    key={s.id}
                                    className={`block p-2 rounded-lg cursor-pointer transition-all ${
                                        config.strategy === s.id 
                                            ? 'bg-blue-600/30 border border-blue-500' 
                                            : 'bg-white/5 border border-transparent hover:bg-white/10'
                                    }`}
                                >
                                    <input 
                                        type="radio"
                                        name="strategy"
                                        value={s.id}
                                        checked={config.strategy === s.id}
                                        onChange={e => setConfig(c => ({ ...c, strategy: e.target.value }))}
                                        className="sr-only"
                                    />
                                    <div className="text-white text-sm font-medium">{s.name}</div>
                                    <div className="text-blue-200/60 text-xs">{s.description}</div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Parameters */}
                    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-white mb-3">파라미터 설정</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-blue-200 mb-1 block">종목코드</label>
                                <input 
                                    type="text" 
                                    value={config.symbol}
                                    onChange={e => setConfig(c => ({ ...c, symbol: e.target.value }))}
                                    className="w-full px-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-blue-200 mb-1 block">시작일</label>
                                    <input 
                                        type="date" 
                                        value={config.startDate}
                                        onChange={e => setConfig(c => ({ ...c, startDate: e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-blue-200 mb-1 block">종료일</label>
                                    <input 
                                        type="date" 
                                        value={config.endDate}
                                        onChange={e => setConfig(c => ({ ...c, endDate: e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-blue-200 mb-1 block">초기 자본 (₩)</label>
                                <input 
                                    type="number" 
                                    value={config.initialCapital}
                                    onChange={e => setConfig(c => ({ ...c, initialCapital: +e.target.value }))}
                                    className="w-full px-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs text-blue-200 mb-1 block">포지션 %</label>
                                    <input 
                                        type="number" 
                                        value={config.positionSize}
                                        onChange={e => setConfig(c => ({ ...c, positionSize: +e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white"
                                        min="1" max="100"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-blue-200 mb-1 block">손절 %</label>
                                    <input 
                                        type="number" 
                                        value={config.stopLoss}
                                        onChange={e => setConfig(c => ({ ...c, stopLoss: +e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-blue-200 mb-1 block">익절 %</label>
                                    <input 
                                        type="number" 
                                        value={config.takeProfit}
                                        onChange={e => setConfig(c => ({ ...c, takeProfit: +e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Run Button */}
                    <button
                        onClick={handleRunBacktest}
                        disabled={isRunning}
                        className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                            isRunning 
                                ? 'bg-gray-600 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                        } text-white`}
                    >
                        {isRunning ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                백테스트 실행 중... {progress}%
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                백테스트 실행
                            </>
                        )}
                    </button>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Progress Bar */}
                    {isRunning && (
                        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                            <div className="flex justify-between text-sm text-white mb-2">
                                <span>백테스트 진행중...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <>
                            {/* Key Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                                    <p className="text-xs text-blue-200 mb-1">총 수익률</p>
                                    <p className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                                    </p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                                    <p className="text-xs text-blue-200 mb-1">승률</p>
                                    <p className="text-2xl font-bold text-white">{result.winRate.toFixed(1)}%</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                                    <p className="text-xs text-blue-200 mb-1">샤프 비율</p>
                                    <p className={`text-2xl font-bold ${result.sharpeRatio >= 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {result.sharpeRatio.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                                    <p className="text-xs text-blue-200 mb-1">최대 낙폭</p>
                                    <p className="text-2xl font-bold text-red-400">-{result.maxDrawdown.toFixed(2)}%</p>
                                </div>
                            </div>

                            {/* Detailed Metrics */}
                            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-white mb-3">상세 결과</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-blue-200">총 거래 횟수</p>
                                        <p className="text-lg font-medium text-white">{result.tradeCount}회</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-200">평균 보유 기간</p>
                                        <p className="text-lg font-medium text-white">{result.avgHoldingDays}일</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-200">손익비 (Profit Factor)</p>
                                        <p className={`text-lg font-medium ${result.profitFactor >= 1.5 ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {result.profitFactor.toFixed(2)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-200">최종 자산</p>
                                        <p className="text-lg font-medium text-white">
                                            ₩{Math.round(config.initialCapital * (1 + result.totalReturn / 100)).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Performance Grade */}
                            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-white mb-3">성과 평가</h3>
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                                        result.sharpeRatio >= 1.5 && result.winRate >= 55 ? 'bg-green-500/30 text-green-400' :
                                        result.sharpeRatio >= 1.0 && result.winRate >= 50 ? 'bg-blue-500/30 text-blue-400' :
                                        result.sharpeRatio >= 0.5 ? 'bg-yellow-500/30 text-yellow-400' :
                                        'bg-red-500/30 text-red-400'
                                    }`}>
                                        {result.sharpeRatio >= 1.5 && result.winRate >= 55 ? 'A' :
                                         result.sharpeRatio >= 1.0 && result.winRate >= 50 ? 'B' :
                                         result.sharpeRatio >= 0.5 ? 'C' : 'D'}
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        {result.sharpeRatio >= 1.5 && <p className="text-green-400 flex items-center gap-1"><CheckCircle size={12} /> 우수한 위험 대비 수익</p>}
                                        {result.winRate >= 55 && <p className="text-green-400 flex items-center gap-1"><CheckCircle size={12} /> 높은 승률</p>}
                                        {result.maxDrawdown > 20 && <p className="text-red-400 flex items-center gap-1"><AlertCircle size={12} /> 높은 낙폭 위험</p>}
                                        {result.profitFactor < 1.5 && <p className="text-yellow-400 flex items-center gap-1"><AlertCircle size={12} /> 손익비 개선 필요</p>}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {!result && !isRunning && (
                        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-12 text-center">
                            <BarChart2 size={48} className="mx-auto text-blue-400/50 mb-4" />
                            <p className="text-blue-200">전략과 파라미터를 설정하고 백테스트를 실행하세요</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
