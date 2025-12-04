'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { swrFetcher, api } from '@/lib/api';

// Stock form data type
interface StockFormData {
    symbol: string;
    name: string;
    market: string;
    sector?: string;
    isActive: boolean;
    isTradable: boolean;
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
    currentPrice?: number;
    openPrice?: number;
    highPrice?: number;
    lowPrice?: number;
    volume?: number;
    marketCap?: number;
}

interface StockDetailResponse extends StockFormData {
    id: string;
    createdAt: string;
    updatedAt: string;
    lastPriceUpdate?: string;
}

interface StockDetailsModalProps {
    stockId: string;
    onClose: () => void;
    onUpdate: () => void;
    onShowToast?: (message: string, type: 'success' | 'error') => void;
}

export function StockDetailsModal({ stockId, onClose, onUpdate, onShowToast }: StockDetailsModalProps) {
    const { data: stock, mutate: mutateStock } = useSWR<StockDetailResponse>(
        `/api/admin/stocks/${stockId}`,
        swrFetcher
    );
    const [formData, setFormData] = useState<Partial<StockFormData>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (stock) {
            setFormData(stock);
        }
    }, [stock]);

    const showMessage = (message: string, type: 'success' | 'error') => {
        if (onShowToast) {
            onShowToast(message, type);
        } else {
            alert(message);
        }
    };

    if (!stock) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-full"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                </div>
            </div>
        );
    }

    const handleChange = (field: keyof StockFormData, value: string | number | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await api.patch(`/api/admin/stocks/${stockId}`, formData);
            showMessage('수정되었습니다.', 'success');
            mutateStock();
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Update failed:', error);
            showMessage('수정 실패', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('이 종목을 삭제하시겠습니까?')) return;

        try {
            await api.delete(`/api/admin/stocks/${stockId}`);
            showMessage('삭제되었습니다.', 'success');
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Delete failed:', error);
            showMessage('삭제 실패', 'error');
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
                                    onChange={(e) => handleChange('currentPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">시가</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.openPrice || ''}
                                    onChange={(e) => handleChange('openPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">고가</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.highPrice || ''}
                                    onChange={(e) => handleChange('highPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">저가</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.lowPrice || ''}
                                    onChange={(e) => handleChange('lowPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">거래량</label>
                                <input
                                    type="number"
                                    value={formData.volume || ''}
                                    onChange={(e) => handleChange('volume', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">시가총액</label>
                                <input
                                    type="number"
                                    value={formData.marketCap || ''}
                                    onChange={(e) => handleChange('marketCap', parseInt(e.target.value) || 0)}
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
