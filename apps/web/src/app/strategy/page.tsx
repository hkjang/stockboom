'use client';

import { StockChart } from '@/components/charts/StockChart';
import { TradeHistory } from '@/components/trades/TradeHistory';
import { AIReportCard } from '@/components/ai/AIReportCard';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function StrategyPage() {
    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">매매 전략</h1>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    + 새 전략 만들기
                </button>
            </div>

            {/* Strategy List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow p-4">
                        <h2 className="text-lg font-semibold mb-4">내 전략</h2>
                        <div className="space-y-2">
                            <div className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <h3 className="font-medium">단기 모멘텀</h3>
                                <p className="text-sm text-gray-500">SMA + RSI</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strategy Builder */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold mb-4">전략 설정</h2>
                        <p className="text-gray-500">왼쪽에서 전략을 선택하거나 새로 만드세요.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
