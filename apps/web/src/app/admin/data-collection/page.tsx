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

export default function AdminDataCollection() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [selectedMarket, setSelectedMarket] = useState('KOSPI');
    const [corpCode, setCorpCode] = useState('');
    const [timeframe, setTimeframe] = useState('1d');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [deleteExisting, setDeleteExisting] = useState(false);

    const { data: jobs, mutate: mutateJobs } = useSWR('/api/admin/data-collection/jobs', fetcher, {
        refreshInterval: 5000
    });

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleSyncCorpCodes = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/data-collection/opendart/corp-codes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({}),
            });

            const data = await res.json();
            if (res.ok) {
                showMessage('success', data.message || `Synced ${data.count} corporations`);
            } else {
                showMessage('error', data.error || 'Failed to sync corp codes');
            }
        } catch (error: any) {
            showMessage('error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadCorpCodes = async () => {
        if (!uploadFile) {
            showMessage('error', 'Please select a file');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('deleteExisting', deleteExisting.toString());

            const res = await fetch('/api/admin/data-collection/opendart/upload-corp-codes', {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: formData,
            });

            const data = await res.json();
            if (res.ok) {
                showMessage('success', data.message || `Uploaded and synced ${data.count} corporations`);
                setUploadFile(null);
                setDeleteExisting(false);
                // Reset file input
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                showMessage('error', data.error || 'Failed to upload file');
            }
        } catch (error: any) {
            showMessage('error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCollectCompanyInfo = async () => {
        if (!corpCode.trim()) {
            showMessage('error', 'Please enter corporation code');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/data-collection/opendart/company-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({ corpCode }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showMessage('success', 'Company info collected successfully');
                setCorpCode('');
            } else {
                showMessage('error', data.message || 'Failed to collect company info');
            }
        } catch (error: any) {
            showMessage('error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePrice = async () => {
        if (!selectedSymbol.trim()) {
            showMessage('error', 'Please enter stock symbol');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/data-collection/stocks/price', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({
                    symbol: selectedSymbol,
                    market: selectedMarket,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showMessage('success', data.message || 'Price updated successfully');
            } else {
                showMessage('error', data.error || 'Failed to update price');
            }
        } catch (error: any) {
            showMessage('error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCollectCandles = async () => {
        if (!selectedSymbol.trim()) {
            showMessage('error', 'Please enter stock symbol');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/data-collection/stocks/candles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({
                    symbol: selectedSymbol,
                    market: selectedMarket,
                    timeframe,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showMessage('success', data.message || `Collected ${data.count} candles`);
            } else {
                showMessage('error', data.error || 'Failed to collect candles');
            }
        } catch (error: any) {
            showMessage('error', error.message);
        } finally {
            setLoading(false);
            mutateJobs();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">데이터 수동 수집</h1>
            </div>

            {/* Message Display */}
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* OpenDart Section */}
            <Card>
                <div className="p-6 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-2xl">🏢</span>
                        OpenDart 데이터 수집
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <h3 className="font-medium mb-2">기업코드 동기화</h3>
                            <p className="text-sm text-gray-600 mb-3">
                                OpenDart에서 모든 상장 기업의 코드와 기본 정보를 동기화합니다.
                            </p>
                            <button
                                onClick={handleSyncCorpCodes}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {loading ? '처리중...' : '🔄 기업코드 동기화'}
                            </button>
                        </div>

                        <hr />

                        <div>
                            <h3 className="font-medium mb-2">회사 정보 수집</h3>
                            <p className="text-sm text-gray-600 mb-3">
                                특정 기업의 상세 정보를 수집합니다.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Corporation Code (e.g., 00126380)"
                                    value={corpCode}
                                    onChange={(e) => setCorpCode(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={handleCollectCompanyInfo}
                                    disabled={loading}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                                >
                                    수집
                                </button>
                            </div>
                        </div>

                        <hr />

                        <div>
                            <h3 className="font-medium mb-2">📁 파일 업로드</h3>
                            <p className="text-sm text-gray-600 mb-3">
                                다운로드 받은 corpCode.xml 또는 ZIP 파일을 직접 업로드하세요
                            </p>
                            <div className="space-y-3">
                                <input
                                    type="file"
                                    accept=".xml,.zip"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    className="block w-full text-sm text-gray-500
                                        file:mr- file:py-2 file:px-4
                                        file:rounded-lg file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-blue-50 file:text-blue-700
                                        hover:file:bg-blue-100
                                        disabled:opacity-50"
                                    disabled={loading}
                                />

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="deleteExisting"
                                        checked={deleteExisting}
                                        onChange={(e) => setDeleteExisting(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        disabled={loading}
                                    />
                                    <label htmlFor="deleteExisting" className="text-sm text-gray-700 cursor-pointer select-none">
                                        기존 데이터 삭제 후 등록 (한글 깨짐 수정 시 사용)
                                    </label>
                                </div>

                                {uploadFile && (
                                    <p className="text-sm text-gray-600">
                                        선택된 파일: <span className="font-medium">{uploadFile.name}</span>
                                    </p>
                                )}
                                <button
                                    onClick={handleUploadCorpCodes}
                                    disabled={loading || !uploadFile}
                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {loading ? '업로드 중...' : '📤 파일 업로드 및 동기화'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Stock Data Collection Section */}
            <Card>
                <div className="p-6 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-2xl">📈</span>
                        주가 데이터 수집
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">종목 코드</label>
                            <input
                                type="text"
                                placeholder="e.g., 005930"
                                value={selectedSymbol}
                                onChange={(e) => setSelectedSymbol(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">시장</label>
                            <select
                                value={selectedMarket}
                                onChange={(e) => setSelectedMarket(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="KOSPI">KOSPI</option>
                                <option value="KOSDAQ">KOSDAQ</option>
                                <option value="KONEX">KONEX</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleUpdatePrice}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
                        >
                            💰 가격 업데이트
                        </button>
                    </div>

                    <hr />

                    <div>
                        <label className="block text-sm font-medium mb-2">캔들 데이터 수집</label>
                        <div className="flex gap-2 mb-3">
                            {['1d', '1w', '1h', '5m'].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-3 py-1 rounded ${timeframe === tf ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleCollectCandles}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                        >
                            📊 캔들 데이터 수집 ({timeframe})
                        </button>
                    </div>
                </div>
            </Card>

            {/* Collection Jobs History */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-2xl">📋</span>
                        수집 작업 현황
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업명</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">에러</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {jobs && jobs.length > 0 ? (
                                    jobs.map((job: any) => (
                                        <tr key={job.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm font-mono">{job.id}</td>
                                            <td className="px-4 py-3 text-sm">{job.name}</td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    variant={
                                                        job.status === 'completed' ? 'success' :
                                                            job.status === 'failed' ? 'danger' :
                                                                job.status === 'active' ? 'info' :
                                                                    'default'
                                                    }
                                                    size="sm"
                                                >
                                                    {job.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {job.timestamp ? new Date(job.timestamp).toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-red-600">
                                                {job.failedReason || '-'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            작업 히스토리가 없습니다
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>
        </div>
    );
}
