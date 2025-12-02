'use client';

import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface AIReportCardProps {
    report: {
        id: string;
        riskScore: number;
        confidence: number;
        summary: string;
        recommendation: 'BUY' | 'SELL' | 'HOLD';
        createdAt: string;
        stock?: {
            symbol: string;
            name: string;
        };
    };
}

export function AIReportCard({ report }: AIReportCardProps) {
    const getRiskColor = (score: number) => {
        if (score >= 70) return 'bg-red-500';
        if (score >= 40) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getRecommendationVariant = (rec: string): 'success' | 'danger' | 'warning' => {
        if (rec === 'BUY') return 'success';
        if (rec === 'SELL') return 'danger';
        return 'warning';
    };

    return (
        <Card>
            {report.stock && (
                <div className="mb-4">
                    <h4 className="font-semibold text-lg">{report.stock.name}</h4>
                    <p className="text-sm text-gray-500">{report.stock.symbol}</p>
                </div>
            )}

            {/* Risk Score */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">리스크 점수</span>
                    <span className="text-lg font-bold">{report.riskScore}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                        className={`h-3 rounded-full transition-all ${getRiskColor(report.riskScore)}`}
                        style={{ width: `${report.riskScore}%` }}
                    />
                </div>
            </div>

            {/* Confidence */}
            <div className="mb-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">신뢰도</span>
                    <span className="text-sm font-semibold">{report.confidence}%</span>
                </div>
            </div>

            {/* Recommendation */}
            <div className="mb-4">
                <Badge variant={getRecommendationVariant(report.recommendation)} size="lg">
                    {report.recommendation === 'BUY' ? '매수' : report.recommendation === 'SELL' ? '매도' : '보유'}
                </Badge>
            </div>

            {/* Summary */}
            <div className="mb-4">
                <p className="text-sm text-gray-600 leading-relaxed">{report.summary}</p>
            </div>

            {/* Timestamp */}
            <div className="text-xs text-gray-400">
                {new Date(report.createdAt).toLocaleString('ko-KR')}
            </div>
        </Card>
    );
}
