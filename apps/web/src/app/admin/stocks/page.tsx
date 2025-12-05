'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { swrFetcher } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { getAuthHeader } from '@/hooks/useAuth';

// Types
interface StockStats {
    candles?: { count: number; lastUpdated?: string };
    indicators?: { count: number; lastUpdated?: string };
    news?: { count: number; lastUpdated?: string };
    aiReports?: { count: number; lastUpdated?: string };
}

interface Stock {
    id: string;
    symbol: string;
    name: string;
    market: string;
    sector?: string;
    isActive: boolean;
    isTradable: boolean;
    stats?: StockStats;
}

interface StocksResponse {
    stocks: Stock[];
    total: number;
}

interface StockDetail extends Stock {
    createdAt?: string;
    updatedAt?: string;
    lastPriceUpdate?: string;
    // OpenDart fields
    corpCode?: string;
    stockCode?: string;
    corpName?: string;
    corpNameEng?: string;
    ceoName?: string;
    corpCls?: string;
    address?: string;
    homePage?: string;
    irUrl?: string;
    phoneNumber?: string;
    faxNumber?: string;
    // Market data
    currentPrice?: number;
    openPrice?: number;
    highPrice?: number;
    lowPrice?: number;
    volume?: number;
    marketCap?: number;
}

export default function AdminStocks() {
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
    const [jsonInput, setJsonInput] = useState('');
    const { data, mutate } = useSWR<StocksResponse>('/api/admin/stocks', swrFetcher);

    const stocks = data?.stocks || [];
    const total = data?.total || 0;

    const filteredStocks = stocks.filter((stock) =>
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleBulkImport = async () => {
        try {
            const parsedStocks = JSON.parse(jsonInput);
            if (!Array.isArray(parsedStocks)) {
                showToast('JSON must be an array of stock objects', 'error');
                return;
            }

            const res = await fetch('/api/admin/stocks/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ stocks: parsedStocks }),
            });

            const result = await res.json();
            showToast(`성공: ${result.success?.length || 0}, 실패: ${result.failed?.length || 0}`, 'success');
            setShowBulkModal(false);
            setJsonInput('');
            mutate();
        } catch (error) {
            console.error('Bulk import failed:', error);
            showToast('대량 등록 실패: ' + (error as Error).message, 'error');
        }
    };

    const handleStockClick = (stockId: string) => {
        setSelectedStockId(stockId);
        setShowDetailsModal(true);
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
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStocks?.map((stock: any) => (
                                <tr key={stock.id} className="hover:bg-gray-50">
                                    <td
                                        className="px-6 py-4 font-mono text-sm text-blue-600 cursor-pointer hover:underline"
                                        onClick={() => handleStockClick(stock.id)}
                                    >
                                        {stock.symbol}
                                    </td>
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

            {/* Stock Details Modal */}
            {showDetailsModal && selectedStockId && (
                <StockDetailsModal
                    stockId={selectedStockId}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedStockId(null);
                    }}
                    onUpdate={() => {
                        mutate();
                    }}
                />
            )}
        </div>
    );
}

interface StockDetailsModalProps {
    stockId: string;
    onClose: () => void;
    onUpdate: () => void;
}

function StockDetailsModal({ stockId, onClose, onUpdate }: StockDetailsModalProps) {
    const { data: stock, mutate: mutateStock } = useSWR<StockDetail>(`/api/admin/stocks/${stockId}`, swrFetcher);
    const [formData, setFormData] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize form data when stock is loaded
    useEffect(() => {
        if (stock) {
            setFormData(stock);
        }
    }, [stock]);

    if (!stock) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full p-6">
                    <p>로딩 중...</p>
                </div>
            </div>
        );
    }

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/stocks/${stockId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error('Failed to update');

            alert('수정되었습니다.');
            mutateStock();
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Update failed:', error);
            alert('수정 실패');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('이 종목을 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/stocks/${stockId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });
            alert('삭제되었습니다.');
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('삭제 실패');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full p-6 my-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">종목 상세 정보</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
                        ×
                    </button>
                </div>

                <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* 기본 정보 */}
                    <section>
                        <h3 className="text-lg font-semibold mb-4 text-blue-600">기본 정보</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">종목코드</label>
                                <input
                                    type="text"
                                    value={formData.symbol || ''}
                                    onChange={(e) => handleChange('symbol', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">종목명</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">시장</label>
                                <input
                                    type="text"
                                    value={formData.market || ''}
                                    onChange={(e) => handleChange('market', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">섹터</label>
                                <input
                                    type="text"
                                    value={formData.sector || ''}
                                    onChange={(e) => handleChange('sector', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive || false}
                                        onChange={(e) => handleChange('isActive', e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">활성</span>
                                </label>
                            </div>
                            <div>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isTradable || false}
                                        onChange={(e) => handleChange('isTradable', e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">거래가능</span>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* 회사 정보 (OpenDart) */}
                    <section>
                        <h3 className="text-lg font-semibold mb-4 text-green-600">회사 정보 (OpenDart)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">법인코드</label>
                                <input
                                    type="text"
                                    value={formData.corpCode || ''}
                                    onChange={(e) => handleChange('corpCode', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">종목코드 (표준)</label>
                                <input
                                    type="text"
                                    value={formData.stockCode || ''}
                                    onChange={(e) => handleChange('stockCode', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
                                <input
                                    type="text"
                                    value={formData.corpName || ''}
                                    onChange={(e) => handleChange('corpName', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">회사명 (영문)</label>
                                <input
                                    type="text"
                                    value={formData.corpNameEng || ''}
                                    onChange={(e) => handleChange('corpNameEng', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">대표자명</label>
                                <input
                                    type="text"
                                    value={formData.ceoName || ''}
                                    onChange={(e) => handleChange('ceoName', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">법인구분</label>
                                <input
                                    type="text"
                                    value={formData.corpCls || ''}
                                    onChange={(e) => handleChange('corpCls', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                                <input
                                    type="text"
                                    value={formData.address || ''}
                                    onChange={(e) => handleChange('address', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">홈페이지</label>
                                <input
                                    type="text"
                                    value={formData.homePage || ''}
                                    onChange={(e) => handleChange('homePage', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">IR URL</label>
                                <input
                                    type="text"
                                    value={formData.irUrl || ''}
                                    onChange={(e) => handleChange('irUrl', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                                <input
                                    type="text"
                                    value={formData.phoneNumber || ''}
                                    onChange={(e) => handleChange('phoneNumber', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">팩스번호</label>
                                <input
                                    type="text"
                                    value={formData.faxNumber || ''}
                                    onChange={(e) => handleChange('faxNumber', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 시장 데이터 */}
                    <section>
                        <h3 className="text-lg font-semibold mb-4 text-purple-600">시장 데이터</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">현재가</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.currentPrice || ''}
                                    onChange={(e) => handleChange('currentPrice', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">시가</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.openPrice || ''}
                                    onChange={(e) => handleChange('openPrice', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">고가</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.highPrice || ''}
                                    onChange={(e) => handleChange('highPrice', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">저가</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.lowPrice || ''}
                                    onChange={(e) => handleChange('lowPrice', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">거래량</label>
                                <input
                                    type="number"
                                    value={formData.volume || ''}
                                    onChange={(e) => handleChange('volume', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">시가총액</label>
                                <input
                                    type="number"
                                    value={formData.marketCap || ''}
                                    onChange={(e) => handleChange('marketCap', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 메타데이터 (읽기 전용) */}
                    <section>
                        <h3 className="text-lg font-semibold mb-4 text-gray-600">메타데이터</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">생성일</label>
                                <input
                                    type="text"
                                    value={stock.createdAt ? new Date(stock.createdAt).toLocaleString() : ''}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">수정일</label>
                                <input
                                    type="text"
                                    value={stock.updatedAt ? new Date(stock.updatedAt).toLocaleString() : ''}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">최근 가격 업데이트</label>
                                <input
                                    type="text"
                                    value={stock.lastPriceUpdate ? new Date(stock.lastPriceUpdate).toLocaleString() : 'N/A'}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                                <input
                                    type="text"
                                    value={stock.id}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Actions */}
                <div className="flex justify-between mt-6 pt-6 border-t">
                    <button
                        onClick={handleDelete}
                        className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        삭제
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                        >
                            {isSubmitting ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
