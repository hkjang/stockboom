'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';

interface StockChartProps {
    data: Array<{
        timestamp: string;
        close: number;
        sma20?: number;
        sma60?: number;
    }>;
    showIndicators?: {
        sma20?: boolean;
        sma60?: boolean;
    };
}

export function StockChart({ data, showIndicators = {} }: StockChartProps) {
    return (
        <Card title="주가 차트">
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${Math.round(value).toLocaleString()}`}
                    />
                    <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString()}원`, '']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('ko-KR')}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="종가"
                        dot={false}
                    />
                    {showIndicators.sma20 && (
                        <Line
                            type="monotone"
                            dataKey="sma20"
                            stroke="#10b981"
                            strokeWidth={1.5}
                            name="SMA 20"
                            dot={false}
                            strokeDasharray="5 5"
                        />
                    )}
                    {showIndicators.sma60 && (
                        <Line
                            type="monotone"
                            dataKey="sma60"
                            stroke="#f59e0b"
                            strokeWidth={1.5}
                            name="SMA 60"
                            dot={false}
                            strokeDasharray="5 5"
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </Card>
    );
}
