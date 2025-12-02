'use client';

import useSWR from 'swr';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Trade {
    id: string;
    createdAt: string;
    stock: {
        symbol: string;
        name: string;
    };
    orderSide: 'BUY' | 'SELL';
    quantity: number;
    avgFillPrice: number;
    status: string;
    totalAmount: number;
}

interface TradeHistoryProps {
    limit?: number;
}

export function TradeHistory({ limit = 20 }: TradeHistoryProps) {
    const { data: trades, isLoading, error } = useSWR<Trade[]>(
        `/api/trades?take=${limit}`,
        fetcher
    );

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
            FILLED: 'success',
            PENDING: 'warning',
            REJECTED: 'danger',
            CANCELLED: 'default',
            SUBMITTED: 'info',
        };
        return statusMap[status] || 'default';
    };

    if (isLoading) {
        return (
            <Card title="매매 이력">
                <div className="text-center py-8 text-gray-500">로딩 중...</div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card title="매매 이력">
                <div className="text-center py-8 text-red-500">데이터를 불러올 수 없습니다.</div>
            </Card>
        );
    }

    return (
        <Card title="매매 이력">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                시간
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                종목
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                구분
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                수량
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                평균가
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                총액
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                상태
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {trades && trades.length > 0 ? (
                            trades.map((trade) => (
                                <tr key={trade.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {new Date(trade.createdAt).toLocaleString('ko-KR')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{trade.stock.name}</div>
                                        <div className="text-sm text-gray-500">{trade.stock.symbol}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`text-sm font-semibold ${trade.orderSide === 'BUY' ? 'text-red-600' : 'text-blue-600'}`}>
                                            {trade.orderSide === 'BUY' ? '매수' : '매도'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                        {trade.quantity.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                        {trade.avgFillPrice?.toLocaleString()}원
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                        {trade.totalAmount?.toLocaleString()}원
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <Badge variant={getStatusBadge(trade.status)} size="sm">
                                            {trade.status}
                                        </Badge>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                    매매 이력이 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
