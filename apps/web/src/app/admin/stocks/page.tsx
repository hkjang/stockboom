'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
        }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

export default function AdminStocks() {
    const [searchTerm, setSearchTerm] = useState('');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const { data, mutate } = useSWR('/api/admin/stocks', fetcher);

    const stocks = data?.stocks || [];
    const total = data?.total || 0;

    const filteredStocks = stocks.filter((stock: any) =>
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleBulkImport = async () => {
        try {
            const parsedStocks = JSON.parse(jsonInput);
            if (!Array.isArray(parsedStocks)) {
                alert('JSON must be an array of stock objects');
                return;
            }

            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/stocks/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({ stocks: parsedStocks }),
            });

            const result = await res.json();
            alert(`성공: ${result.success?.length || 0}, 실패: ${result.failed?.length || 0}`);
            setShowBulkModal(false);
            setJsonInput('');
            mutate();
        } catch (error) {
            console.error('Bulk import failed:', error);
            alert('대량 등록 실패: ' + (error as Error).message);
        }
    };

    const handleDelete = async (stockId: string) => {
        if (!confirm('이 종목을 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/stocks/${stockId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });
            mutate();
            alert('삭제되었습니다.');
        } catch (error) {
            console.error('Delete failed:', error);
            alert('삭제 실패');
        }
    };

    const exampleJson = `[
  {
    "symbol": "005930",
    "name": "삼성전자",
    "market": "KOSPI",
    "sector": "전기전자"
  },
  {
    "symbol": "000660",
    "name": "SK하이닉스",
    "market": "KOSPI",
    "sector": "반도체"
  }
]`;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">종목 관리</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowBulkModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        📦 대량 등록
                    </button>
                </div>
            </div>

            {/* Search */}
            <Card>
                <input
                    type="text"
                    placeholder="종목 코드 또는 이름으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <div className="text-sm text-gray-600">총 종목 수</div>
                    <div className="text-2xl font-bold">{total}</div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-600">거래 가능</div>
                    <div className="text-2xl font-bold text-green-600">
                        {stocks.filter((s: any) => s.isTradable).length}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-600">비활성</div>
                    <div className="text-2xl font-bold text-gray-400">
                        {stocks.filter((s: any) => !s.isActive).length}
                    </div>
                </Card>
            </div>

            {/* Stocks Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    종목코드
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    종목명
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    시장
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    섹터
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    데이터 수집 현황 (건수/최신)
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    상태
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    작업
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStocks?.map((stock: any) => (
                                <tr key={stock.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-mono text-sm">{stock.symbol}</td>
                                    <td className="px-6 py-4">{stock.name}</td>
                                    <td className="px-6 py-4">
                                        <Badge variant="default" size="sm">{stock.market}</Badge>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{stock.sector || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-4 justify-center text-xs">
                                            <div className="flex flex-col items-center" title={`캔들: ${stock.stats?.candles?.lastUpdated ? new Date(stock.stats.candles.lastUpdated).toLocaleString() : '없음'}`}>
                                                <span className="text-gray-500 mb-1">캔들</span>
                                                <Badge variant={stock.stats?.candles?.count > 0 ? 'info' : 'default'} size="sm">
                                                    {stock.stats?.candles?.count || 0}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col items-center" title={`지표: ${stock.stats?.indicators?.lastUpdated ? new Date(stock.stats.indicators.lastUpdated).toLocaleString() : '없음'}`}>
                                                <span className="text-gray-500 mb-1">지표</span>
                                                <Badge variant={stock.stats?.indicators?.count > 0 ? 'info' : 'default'} size="sm">
                                                    {stock.stats?.indicators?.count || 0}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col items-center" title={`뉴스: ${stock.stats?.news?.lastUpdated ? new Date(stock.stats.news.lastUpdated).toLocaleString() : '없음'}`}>
                                                <span className="text-gray-500 mb-1">뉴스</span>
                                                <Badge variant={stock.stats?.news?.count > 0 ? 'info' : 'default'} size="sm">
                                                    {stock.stats?.news?.count || 0}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col items-center" title={`AI: ${stock.stats?.aiReports?.lastUpdated ? new Date(stock.stats.aiReports.lastUpdated).toLocaleString() : '없음'}`}>
                                                <span className="text-gray-500 mb-1">AI</span>
                                                <Badge variant={stock.stats?.aiReports?.count > 0 ? 'info' : 'default'} size="sm">
                                                    {stock.stats?.aiReports?.count || 0}
                                                </Badge>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            {stock.isActive && (
                                                <Badge variant="success" size="sm">활성</Badge>
                                            )}
                                            {stock.isTradable && (
                                                <Badge variant="default" size="sm">거래가능</Badge>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleDelete(stock.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Bulk Import Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
                        <h2 className="text-2xl font-bold mb-4">종목 대량 등록</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    JSON 입력 (배열 형식)
                                </label>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={exampleJson}
                                />
                            </div>
                            <div className="bg-gray-50 p-4 rounded-md">
                                <div className="text-sm font-medium text-gray-700 mb-2">예시:</div>
                                <pre className="text-xs text-gray-600 overflow-x-auto">
                                    {exampleJson}
                                </pre>
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button
                                    onClick={() => {
                                        setShowBulkModal(false);
                                        setJsonInput('');
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleBulkImport}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    등록
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
