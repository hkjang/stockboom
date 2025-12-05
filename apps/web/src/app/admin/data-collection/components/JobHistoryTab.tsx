'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

interface JobHistoryTabProps {
    onRefresh: () => void;
}

export function JobHistoryTab({ onRefresh }: JobHistoryTabProps) {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const { showToast } = useToast();

    const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { type: typeFilter }),
    });

    const { data, error, isLoading, mutate } = useSWR(
        `/api/admin/data-collection/jobs-v2?${queryParams}`,
        fetcher,
        { refreshInterval: 5000 }
    );

    const getAuthHeader = (): Record<string, string> => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    const handleRetry = async (jobId: string) => {
        try {
            const res = await fetch(`/api/admin/data-collection/jobs/${jobId}/retry`, {
                method: 'POST',
                headers: getAuthHeader(),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || '재시도 요청됨', 'success');
                mutate();
                onRefresh();
            } else {
                throw new Error(data.message || '재시도 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const handleCancel = async (jobId: string) => {
        if (!confirm('이 작업을 취소하시겠습니까?')) return;

        try {
            const res = await fetch(`/api/admin/data-collection/jobs/${jobId}`, {
                method: 'DELETE',
                headers: getAuthHeader(),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || '작업 취소됨', 'success');
                mutate();
                onRefresh();
            } else {
                throw new Error(data.message || '취소 실패');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const formatTime = (timestamp: number | null) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getStatusVariant = (status: string): 'default' | 'success' | 'danger' | 'info' | 'warning' => {
        switch (status) {
            case 'completed': return 'success';
            case 'failed': return 'danger';
            case 'active': return 'info';
            case 'waiting': return 'warning';
            default: return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return '완료';
            case 'failed': return '실패';
            case 'active': return '실행 중';
            case 'waiting': return '대기';
            case 'delayed': return '지연';
            default: return status;
        }
    };

    const jobs = data?.jobs ?? [];
    const pagination = data?.pagination ?? { page: 1, limit: 15, total: 0, totalPages: 1 };

    const statuses = [
        { value: '', label: '전체' },
        { value: 'waiting', label: '대기' },
        { value: 'active', label: '실행 중' },
        { value: 'completed', label: '완료' },
        { value: 'failed', label: '실패' },
    ];

    const types = [
        { value: '', label: '전체' },
        { value: 'collect-candles', label: '캔들 수집' },
        { value: 'collect-quotes', label: '시세 수집' },
    ];

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card className="bg-gray-800/50 border-gray-700">
                <div className="p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">상태:</span>
                            <div className="flex gap-1">
                                {statuses.map(s => (
                                    <button
                                        key={s.value}
                                        onClick={() => { setStatusFilter(s.value); setPage(1); }}
                                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${statusFilter === s.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                                            }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">유형:</span>
                            <select
                                value={typeFilter}
                                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white"
                            >
                                {types.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => mutate()}
                            className="ml-auto px-4 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                        >
                            🔄 새로고침
                        </button>
                    </div>
                </div>
            </Card>

            {/* Job List */}
            <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">작업</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">대상</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">상태</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">진행률</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">시간</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={7} className="px-4 py-4">
                                            <div className="h-4 bg-gray-700/50 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-red-400">
                                        데이터를 불러올 수 없습니다
                                    </td>
                                </tr>
                            ) : jobs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                        작업 기록이 없습니다
                                    </td>
                                </tr>
                            ) : (
                                jobs.map((job: any) => (
                                    <tr key={job.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                                            {String(job.id).slice(0, 8)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white">
                                            {job.name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-300">
                                            {job.data?.symbol || job.data?.corpCode || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={getStatusVariant(job.status)} size="sm">
                                                {getStatusLabel(job.status)}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            {job.status === 'active' && (
                                                <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 transition-all"
                                                        style={{ width: `${job.progress || 0}%` }}
                                                    />
                                                </div>
                                            )}
                                            {job.status !== 'active' && (
                                                <span className="text-sm text-gray-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-400">
                                            {formatTime(job.timestamp)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                {job.status === 'failed' && (
                                                    <button
                                                        onClick={() => handleRetry(job.id)}
                                                        className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded transition-colors"
                                                    >
                                                        재시도
                                                    </button>
                                                )}
                                                {(job.status === 'waiting' || job.status === 'delayed') && (
                                                    <button
                                                        onClick={() => handleCancel(job.id)}
                                                        className="px-2 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded transition-colors"
                                                    >
                                                        취소
                                                    </button>
                                                )}
                                                {job.failedReason && (
                                                    <span
                                                        title={job.failedReason}
                                                        className="px-2 py-1 text-xs bg-red-600/10 text-red-400 rounded cursor-help truncate max-w-[100px]"
                                                    >
                                                        {job.failedReason.slice(0, 20)}...
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
                        <p className="text-sm text-gray-400">
                            총 {pagination.total}개 중 {(page - 1) * pagination.limit + 1}-
                            {Math.min(page * pagination.limit, pagination.total)}개
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                이전
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-400">
                                {page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                다음
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
