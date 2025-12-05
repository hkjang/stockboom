'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';
import { swrFetcher } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { getAuthHeader } from '@/hooks/useAuth';

interface Stock {
    id: string;
    symbol: string;
    name: string;
    market: string;
    sector?: string;
    isActive: boolean;
    isTradable: boolean;
    stats?: { candles?: { count: number }; indicators?: { count: number }; news?: { count: number }; aiReports?: { count: number } };
}

export default function AdminStocks() {
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
    const [jsonInput, setJsonInput] = useState('');
    const { data, mutate } = useSWR<{ stocks: Stock[]; total: number }>('/api/admin/stocks', swrFetcher);

    const stocks = data?.stocks || [];
    const filteredStocks = stocks.filter(s => s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleBulkImport = async () => {
        try {
            const parsed = JSON.parse(jsonInput);
            if (!Array.isArray(parsed)) { showToast('JSON 배열 필요', 'error'); return; }
            const res = await fetch('/api/admin/stocks/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ stocks: parsed }),
            });
            const result = await res.json();
            showToast(`성공: ${result.success?.length || 0}, 실패: ${result.failed?.length || 0}`, 'success');
            setShowBulkModal(false); setJsonInput(''); mutate();
        } catch (e) { showToast('등록 실패', 'error'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white">종목 관리</h1>
                    <p className="text-xs text-gray-400 mt-0.5">종목 및 데이터 수집 현황</p>
                </div>
                <button onClick={() => setShowBulkModal(true)}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">📦 대량 등록</button>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <input type="text" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-gray-700/50 border border-gray-600 rounded text-white placeholder-gray-400" />
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-400">총 종목</div>
                    <div className="text-lg font-bold text-white mt-0.5">{data?.total || 0}</div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-400">거래 가능</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{stocks.filter(s => s.isTradable).length}</div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-400">비활성</div>
                    <div className="text-lg font-bold text-gray-500 mt-0.5">{stocks.filter(s => !s.isActive).length}</div>
                </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="px-3 py-2 text-left text-gray-400">코드</th>
                            <th className="px-3 py-2 text-left text-gray-400">종목명</th>
                            <th className="px-3 py-2 text-left text-gray-400">시장</th>
                            <th className="px-3 py-2 text-center text-gray-400">데이터</th>
                            <th className="px-3 py-2 text-left text-gray-400">상태</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {filteredStocks.map((stock) => (
                            <tr key={stock.id} className="hover:bg-gray-700/30">
                                <td className="px-3 py-2 font-mono text-indigo-400 cursor-pointer hover:underline"
                                    onClick={() => { setSelectedStockId(stock.id); setShowDetailsModal(true); }}>
                                    {stock.symbol}
                                </td>
                                <td className="px-3 py-2 text-white">{stock.name}</td>
                                <td className="px-3 py-2"><Badge variant="default" size="sm">{stock.market}</Badge></td>
                                <td className="px-3 py-2">
                                    <div className="flex gap-1 justify-center">
                                        {['candles', 'indicators', 'news', 'aiReports'].map(k => (
                                            <span key={k} className={`px-1 py-0.5 rounded ${(stock.stats?.[k as keyof typeof stock.stats]?.count || 0) > 0 ? 'bg-indigo-600/20 text-indigo-400' : 'bg-gray-700/50 text-gray-500'}`}>
                                                {stock.stats?.[k as keyof typeof stock.stats]?.count || 0}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex gap-1">
                                        {stock.isActive && <Badge variant="success" size="sm">활성</Badge>}
                                        {stock.isTradable && <Badge variant="default" size="sm">거래</Badge>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showBulkModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full p-4">
                        <h2 className="text-sm font-semibold text-white mb-3">대량 등록</h2>
                        <textarea value={jsonInput} onChange={(e) => setJsonInput(e.target.value)}
                            className="w-full h-40 px-3 py-2 text-xs font-mono bg-gray-700/50 border border-gray-600 rounded text-white"
                            placeholder='[{"symbol":"005930","name":"삼성전자","market":"KOSPI"}]' />
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => { setShowBulkModal(false); setJsonInput(''); }}
                                className="px-3 py-1.5 text-xs bg-gray-700 text-gray-300 rounded">취소</button>
                            <button onClick={handleBulkImport}
                                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded">등록</button>
                        </div>
                    </div>
                </div>
            )}

            {showDetailsModal && selectedStockId && (
                <StockDetailsModal stockId={selectedStockId} onClose={() => { setShowDetailsModal(false); setSelectedStockId(null); }} onUpdate={() => mutate()} />
            )}
        </div>
    );
}

function StockDetailsModal({ stockId, onClose, onUpdate }: { stockId: string; onClose: () => void; onUpdate: () => void }) {
    const { data: stock, mutate: m } = useSWR(`/api/admin/stocks/${stockId}`, swrFetcher);
    const [formData, setFormData] = useState<any>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (stock) setFormData(stock); }, [stock]);

    if (!stock) return <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"><div className="bg-gray-800 p-4 rounded-lg text-xs text-gray-300">로딩...</div></div>;

    const handleSubmit = async () => {
        setSaving(true);
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/stocks/${stockId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify(formData),
        });
        m(); onUpdate(); onClose(); setSaving(false);
    };

    const handleDelete = async () => {
        if (!confirm('삭제?')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/stocks/${stockId}`, { method: 'DELETE', headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
        onUpdate(); onClose();
    };

    const inp = "w-full px-2 py-1 text-xs bg-gray-700/50 border border-gray-600 rounded text-white";

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-3xl w-full p-4 my-8">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-sm font-semibold text-white">종목 상세</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto text-xs">
                    <section>
                        <h3 className="text-indigo-400 font-medium mb-2">기본 정보</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {['symbol', 'name', 'market', 'sector'].map(k => (
                                <div key={k}>
                                    <label className="text-gray-400">{k}</label>
                                    <input type="text" value={formData[k] || ''} onChange={(e) => setFormData({ ...formData, [k]: e.target.value })} className={inp} />
                                </div>
                            ))}
                            <label className="flex items-center gap-1 text-gray-300 col-span-1">
                                <input type="checkbox" checked={formData.isActive || false} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="rounded bg-gray-700" />활성
                            </label>
                            <label className="flex items-center gap-1 text-gray-300 col-span-1">
                                <input type="checkbox" checked={formData.isTradable || false} onChange={(e) => setFormData({ ...formData, isTradable: e.target.checked })} className="rounded bg-gray-700" />거래가능
                            </label>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-emerald-400 font-medium mb-2">회사 정보</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {['corpCode', 'corpName', 'ceoName', 'homePage'].map(k => (
                                <div key={k}>
                                    <label className="text-gray-400">{k}</label>
                                    <input type="text" value={formData[k] || ''} onChange={(e) => setFormData({ ...formData, [k]: e.target.value })} className={inp} />
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-purple-400 font-medium mb-2">시장 데이터</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {['currentPrice', 'volume', 'marketCap'].map(k => (
                                <div key={k}>
                                    <label className="text-gray-400">{k}</label>
                                    <input type="number" value={formData[k] || ''} onChange={(e) => setFormData({ ...formData, [k]: e.target.value })} className={inp} />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="flex justify-between mt-4 pt-3 border-t border-gray-700">
                    <button onClick={handleDelete} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded">삭제</button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-3 py-1.5 text-xs bg-gray-700 text-gray-300 rounded">취소</button>
                        <button onClick={handleSubmit} disabled={saving} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded disabled:opacity-50">
                            {saving ? '저장중...' : '저장'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
