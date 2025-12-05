'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { FileDropzone } from './FileDropzone';
import { useToast } from '@/components/ui/Toast';

interface OpenDartTabProps {
    onRefresh: () => void;
}

const REPORT_CODES = [
    { value: '11011', label: '사업보고서' },
    { value: '11012', label: '반기보고서' },
    { value: '11013', label: '1분기보고서' },
    { value: '11014', label: '3분기보고서' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => (CURRENT_YEAR - i).toString());

export function OpenDartTab({ onRefresh }: OpenDartTabProps) {
    const [loading, setLoading] = useState(false);
    const [corpCode, setCorpCode] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [deleteExisting, setDeleteExisting] = useState(false);

    // New state for corporate data collection
    const [collectCorpCode, setCollectCorpCode] = useState('');
    const [bizYear, setBizYear] = useState(CURRENT_YEAR.toString());
    const [reportCode, setReportCode] = useState('11011');

    const { showToast } = useToast();

    const getAuthHeader = (): Record<string, string> => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    const handleSyncCorpCodes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/data-collection/opendart/corp-codes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({}),
            });

            const data = await res.json();
            if (res.ok) {
                showToast(data.message || `${data.count}개 기업 동기화됨`, 'success');
                onRefresh();
            } else {
                throw new Error(data.error || '동기화 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUploadCorpCodes = async () => {
        if (!uploadFile) {
            showToast('파일을 선택해주세요', 'warning');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('deleteExisting', deleteExisting.toString());

            const res = await fetch('/api/admin/data-collection/opendart/upload-corp-codes', {
                method: 'POST',
                headers: getAuthHeader(),
                body: formData,
            });

            const data = await res.json();
            if (res.ok) {
                showToast(data.message || `${data.count}개 기업 등록됨`, 'success');
                setUploadFile(null);
                setDeleteExisting(false);
                onRefresh();
            } else {
                throw new Error(data.error || '업로드 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectCompanyInfo = async () => {
        if (!corpCode.trim()) {
            showToast('기업코드를 입력해주세요', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/data-collection/opendart/company-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ corpCode }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast('회사 정보가 수집되었습니다', 'success');
                setCorpCode('');
                onRefresh();
            } else {
                throw new Error(data.message || '수집 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Generic handler for corporate data collection
    const handleCollectData = async (endpoint: string, label: string) => {
        if (!collectCorpCode.trim()) {
            showToast('기업코드를 입력해주세요', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/admin/data-collection/opendart/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({
                    corpCode: collectCorpCode,
                    bizYear,
                    reportCode
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || `${label} 수집 완료`, 'success');
                onRefresh();
            } else {
                throw new Error(data.message || `${label} 수집 실패`);
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectLargeHoldings = async () => {
        if (!collectCorpCode.trim()) {
            showToast('기업코드를 입력해주세요', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/data-collection/opendart/large-holdings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ corpCode: collectCorpCode }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || '대량보유 정보 수집 완료', 'success');
                onRefresh();
            } else {
                throw new Error(data.message || '대량보유 정보 수집 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Corp Codes Sync */}
            <Card className="bg-gray-800/50 border-gray-700">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <SyncIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">기업코드 동기화</h3>
                            <p className="text-sm text-gray-400">OpenDart API에서 기업코드 목록을 가져옵니다</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSyncCorpCodes}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Spinner /> 처리중...
                            </>
                        ) : (
                            <>🔄 API에서 동기화</>
                        )}
                    </button>
                </div>
            </Card>

            {/* File Upload */}
            <Card className="bg-gray-800/50 border-gray-700">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                            <UploadIcon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">파일 업로드</h3>
                            <p className="text-sm text-gray-400">corpCode.xml 또는 ZIP 파일을 직접 업로드합니다</p>
                        </div>
                    </div>

                    <FileDropzone
                        onFileSelect={setUploadFile}
                        currentFile={uploadFile}
                        loading={loading}
                    />

                    <div className="mt-4 space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={deleteExisting}
                                onChange={(e) => setDeleteExisting(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                                disabled={loading}
                            />
                            <span className="text-sm text-gray-300">
                                기존 데이터 삭제 후 등록
                                <span className="text-gray-500">(한글 깨짐 수정 시 사용)</span>
                            </span>
                        </label>

                        <button
                            onClick={handleUploadCorpCodes}
                            disabled={loading || !uploadFile}
                            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Spinner /> 업로드 중...
                                </>
                            ) : (
                                <>📤 파일 업로드 및 동기화</>
                            )}
                        </button>
                    </div>
                </div>
            </Card>

            {/* Company Info Collection */}
            <Card className="bg-gray-800/50 border-gray-700">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <BuildingIcon className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">회사 정보 수집</h3>
                            <p className="text-sm text-gray-400">특정 기업의 상세 정보를 수집합니다</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="기업코드 입력 (예: 00126380)"
                            value={corpCode}
                            onChange={(e) => setCorpCode(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            disabled={loading}
                        />
                        <button
                            onClick={handleCollectCompanyInfo}
                            disabled={loading || !corpCode.trim()}
                            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            수집
                        </button>
                    </div>
                </div>
            </Card>

            {/* Corporate Data Collection Section */}
            <div className="border-t border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <DocumentIcon className="w-5 h-5 text-amber-400" />
                    정기보고서 주요정보 수집
                </h3>

                {/* Common Input Fields */}
                <Card className="bg-gray-800/50 border-gray-700 mb-4">
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">기업코드</label>
                                <input
                                    type="text"
                                    placeholder="예: 00126380"
                                    value={collectCorpCode}
                                    onChange={(e) => setCollectCorpCode(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm"
                                    disabled={loading}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">사업연도</label>
                                <select
                                    value={bizYear}
                                    onChange={(e) => setBizYear(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm"
                                    disabled={loading}
                                >
                                    {YEARS.map(year => (
                                        <option key={year} value={year}>{year}년</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">보고서 유형</label>
                                <select
                                    value={reportCode}
                                    onChange={(e) => setReportCode(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm"
                                    disabled={loading}
                                >
                                    {REPORT_CODES.map(rc => (
                                        <option key={rc.value} value={rc.value}>{rc.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Collection Buttons Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Executives */}
                    <Card className="bg-gray-800/50 border-gray-700 hover:border-cyan-500/50 transition-colors">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <UsersIcon className="w-5 h-5 text-cyan-400" />
                                <h4 className="font-medium text-white">임원 현황</h4>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">임원 명단 및 직위, 경력 정보</p>
                            <button
                                onClick={() => handleCollectData('executives', '임원 현황')}
                                disabled={loading || !collectCorpCode.trim()}
                                className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Spinner /> : '수집'}
                            </button>
                        </div>
                    </Card>

                    {/* Outside Directors */}
                    <Card className="bg-gray-800/50 border-gray-700 hover:border-violet-500/50 transition-colors">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <UserCheckIcon className="w-5 h-5 text-violet-400" />
                                <h4 className="font-medium text-white">사외이사 현황</h4>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">사외이사 명단 및 전문분야</p>
                            <button
                                onClick={() => handleCollectData('outside-directors', '사외이사')}
                                disabled={loading || !collectCorpCode.trim()}
                                className="w-full px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Spinner /> : '수집'}
                            </button>
                        </div>
                    </Card>

                    {/* Major Shareholders */}
                    <Card className="bg-gray-800/50 border-gray-700 hover:border-rose-500/50 transition-colors">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <ChartPieIcon className="w-5 h-5 text-rose-400" />
                                <h4 className="font-medium text-white">최대주주 현황</h4>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">최대주주 명단 및 지분율</p>
                            <button
                                onClick={() => handleCollectData('major-shareholders', '최대주주')}
                                disabled={loading || !collectCorpCode.trim()}
                                className="w-full px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Spinner /> : '수집'}
                            </button>
                        </div>
                    </Card>

                    {/* Dividends */}
                    <Card className="bg-gray-800/50 border-gray-700 hover:border-amber-500/50 transition-colors">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <CurrencyIcon className="w-5 h-5 text-amber-400" />
                                <h4 className="font-medium text-white">배당 정보</h4>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">배당금 및 배당수익률</p>
                            <button
                                onClick={() => handleCollectData('dividends', '배당 정보')}
                                disabled={loading || !collectCorpCode.trim()}
                                className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Spinner /> : '수집'}
                            </button>
                        </div>
                    </Card>

                    {/* Large Holdings */}
                    <Card className="bg-gray-800/50 border-gray-700 hover:border-teal-500/50 transition-colors">
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <ScaleIcon className="w-5 h-5 text-teal-400" />
                                <h4 className="font-medium text-white">대량보유 상황</h4>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">5% 이상 대량보유 주주</p>
                            <button
                                onClick={handleCollectLargeHoldings}
                                disabled={loading || !collectCorpCode.trim()}
                                className="w-full px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Spinner /> : '수집'}
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Icons & Components
function Spinner() {
    return <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}

function SyncIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );
}

function UploadIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
    );
}

function BuildingIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    );
}

function DocumentIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );
}

function UsersIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    );
}

function UserCheckIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
    );
}

function ChartPieIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
    );
}

function CurrencyIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function ScaleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
    );
}

