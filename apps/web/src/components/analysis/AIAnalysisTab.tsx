'use client';

import { Brain, AlertTriangle, Target, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

interface AIAnalysisData {
    report?: {
        recommendation: string;
        riskScore: number;
        confidence: number;
        summary: string;
        createdAt: string;
    } | null;
    patterns?: {
        patterns: Array<{
            type: string;
            signal: string;
            confidence: number;
            description: string;
        }>;
        description: string;
    };
    anomalies?: {
        hasAnomaly: boolean;
        anomalies: Array<{
            type: string;
            severity: string;
            description: string;
            zScore?: string;
        }>;
        severity: string;
        description: string;
    };
}

interface AIAnalysisTabProps {
    data: AIAnalysisData | null;
    isLoading: boolean;
    error?: string;
    onGenerateReport?: () => void;
}

// Recommendation Badge
function RecommendationBadge({ recommendation }: { recommendation: string }) {
    const getStyle = () => {
        switch (recommendation) {
            case 'BUY':
                return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30';
            case 'STRONG_BUY':
                return 'bg-gradient-to-r from-green-400 to-teal-400 text-white shadow-lg shadow-green-400/30';
            case 'SELL':
                return 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30';
            case 'STRONG_SELL':
                return 'bg-gradient-to-r from-red-400 to-orange-500 text-white shadow-lg shadow-red-400/30';
            default:
                return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg shadow-yellow-500/30';
        }
    };

    const getIcon = () => {
        if (recommendation.includes('BUY')) return <TrendingUp className="w-5 h-5" />;
        if (recommendation.includes('SELL')) return <TrendingDown className="w-5 h-5" />;
        return <Activity className="w-5 h-5" />;
    };

    const getLabel = () => {
        switch (recommendation) {
            case 'BUY': return '매수';
            case 'STRONG_BUY': return '적극 매수';
            case 'SELL': return '매도';
            case 'STRONG_SELL': return '적극 매도';
            default: return '관망';
        }
    };

    return (
        <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-lg ${getStyle()}`}>
            {getIcon()}
            <span>{getLabel()}</span>
        </div>
    );
}

// Risk Score Gauge
function RiskGauge({ score }: { score: number }) {
    const getColor = () => {
        if (score >= 70) return 'text-red-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-green-400';
    };

    const getLabel = () => {
        if (score >= 70) return '고위험';
        if (score >= 40) return '중위험';
        return '저위험';
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-600/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-blue-200 font-medium">리스크 점수</span>
            </div>
            <div className="flex items-end gap-4">
                <div className={`text-5xl font-bold ${getColor()}`}>{score}</div>
                <div className="text-gray-400 pb-2">/ 100</div>
            </div>
            <div className="mt-4">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                        style={{ width: `${score}%` }}
                    ></div>
                </div>
                <div className={`text-sm mt-2 font-semibold ${getColor()}`}>{getLabel()}</div>
            </div>
        </div>
    );
}

// Confidence Gauge
function ConfidenceGauge({ score }: { score: number }) {
    return (
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                    <Target className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-blue-200 font-medium">신뢰도</span>
            </div>
            <div className="flex items-end gap-4">
                <div className="text-5xl font-bold text-blue-400">{score}</div>
                <div className="text-gray-400 pb-2">%</div>
            </div>
            <div className="mt-4">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                        style={{ width: `${score}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}

// Pattern Card
function PatternCard({ pattern }: { pattern: any }) {
    const getSignalColor = () => {
        if (pattern.signal === 'BULLISH') return 'border-green-500/30 bg-green-500/10';
        if (pattern.signal === 'BEARISH') return 'border-red-500/30 bg-red-500/10';
        return 'border-yellow-500/30 bg-yellow-500/10';
    };

    return (
        <div className={`rounded-xl p-5 border ${getSignalColor()} transition-all hover:scale-[1.02]`}>
            <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-white">{pattern.type.replace(/_/g, ' ')}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${pattern.signal === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
                    pattern.signal === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                    }`}>
                    {pattern.signal === 'BULLISH' ? '상승' : pattern.signal === 'BEARISH' ? '하락' : '중립'}
                </span>
            </div>
            <p className="text-sm text-gray-400">{pattern.description}</p>
            <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">신뢰도:</span>
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500"
                        style={{ width: `${pattern.confidence}%` }}
                    ></div>
                </div>
                <span className="text-xs text-blue-400">{pattern.confidence}%</span>
            </div>
        </div>
    );
}

// Anomaly Alert
function AnomalyAlert({ anomaly }: { anomaly: any }) {
    const getSeverityStyle = () => {
        switch (anomaly.severity) {
            case 'HIGH':
                return 'border-red-500/30 bg-red-500/10';
            case 'MEDIUM':
                return 'border-yellow-500/30 bg-yellow-500/10';
            default:
                return 'border-blue-500/30 bg-blue-500/10';
        }
    };

    return (
        <div className={`rounded-xl p-4 border ${getSeverityStyle()}`}>
            <div className="flex items-start gap-3">
                <Zap className={`w-5 h-5 mt-0.5 ${anomaly.severity === 'HIGH' ? 'text-red-400' :
                    anomaly.severity === 'MEDIUM' ? 'text-yellow-400' : 'text-blue-400'
                    }`} />
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{anomaly.type.replace(/_/g, ' ')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${anomaly.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                            anomaly.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-blue-500/20 text-blue-400'
                            }`}>
                            {anomaly.severity === 'HIGH' ? '고' : anomaly.severity === 'MEDIUM' ? '중' : '저'}
                        </span>
                    </div>
                    <p className="text-sm text-gray-400">{anomaly.description}</p>
                </div>
            </div>
        </div>
    );
}

export default function AIAnalysisTab({ data, isLoading, error, onGenerateReport }: AIAnalysisTabProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                    <Brain className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-purple-400" />
                </div>
                <p className="text-purple-300 mt-6">AI가 분석 중입니다...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-white mb-2">AI 분석 오류</h3>
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    const hasNoData = !data?.report && (!data?.patterns?.patterns?.length) && (!data?.anomalies?.anomalies?.length);

    if (hasNoData) {
        return (
            <div className="text-center py-16">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-bold text-white mb-2">AI 분석 데이터가 없습니다</h3>
                <p className="text-purple-300 mb-6">이 종목에 대한 AI 분석을 생성해보세요.</p>
                {onGenerateReport && (
                    <button
                        onClick={onGenerateReport}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold text-white hover:from-purple-500 hover:to-pink-500 transition-all transform hover:scale-105"
                    >
                        AI 분석 생성하기
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* AI Report */}
            {data?.report && (
                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-purple-600/30 rounded-lg">
                            <Brain className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">AI 종합 분석 리포트</h3>
                            <p className="text-sm text-purple-300">
                                {new Date(data.report.createdAt).toLocaleDateString('ko-KR')} 생성
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
                        <RecommendationBadge recommendation={data.report.recommendation} />
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <RiskGauge score={Number(data.report.riskScore)} />
                            <ConfidenceGauge score={Number(data.report.confidence)} />
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-5">
                        <h4 className="text-sm font-semibold text-purple-300 mb-2">분석 요약</h4>
                        <p className="text-gray-300 leading-relaxed">{data.report.summary}</p>
                    </div>
                </div>
            )}

            {/* Pattern Detection */}
            {data?.patterns && data.patterns.patterns.length > 0 && (
                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">📈 차트 패턴 감지</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.patterns.patterns.map((pattern, index) => (
                            <PatternCard key={index} pattern={pattern} />
                        ))}
                    </div>
                </div>
            )}

            {/* Anomaly Detection */}
            {data?.anomalies && data.anomalies.hasAnomaly && (
                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">⚡ 이상 징후 탐지</h3>
                        <span className={`text-xs px-3 py-1 rounded-full ${data.anomalies.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                            data.anomalies.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                            }`}>
                            {data.anomalies.severity === 'HIGH' ? '주의 필요' :
                                data.anomalies.severity === 'MEDIUM' ? '관찰 필요' : '정상'}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {data.anomalies.anomalies.map((anomaly, index) => (
                            <AnomalyAlert key={index} anomaly={anomaly} />
                        ))}
                    </div>
                </div>
            )}

            {/* No Anomalies */}
            {data?.anomalies && !data.anomalies.hasAnomaly && (
                <div className="bg-green-500/10 backdrop-blur-lg rounded-xl p-6 border border-green-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-full">
                            <Activity className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-green-400">이상 징후 없음</h3>
                            <p className="text-sm text-gray-400">현재 거래량 및 가격 변동이 정상 범위 내입니다.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
