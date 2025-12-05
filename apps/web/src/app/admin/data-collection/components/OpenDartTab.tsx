'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { FileDropzone } from './FileDropzone';
import { useToast } from '@/components/ui/Toast';

interface OpenDartTabProps {
    onRefresh: () => void;
}

export function OpenDartTab({ onRefresh }: OpenDartTabProps) {
    const [loading, setLoading] = useState(false);
    const [corpCode, setCorpCode] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [deleteExisting, setDeleteExisting] = useState(false);
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
