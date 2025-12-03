'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';

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

const metricTypes = [
    { value: 'price', label: '시세 데이터', description: '실시간 주가 정보' },
    { value: 'volume', label: '거래량', description: '거래량 정보' },
    { value: 'candles', label: '캔들 데이터', description: '분봉, 일봉, 주봉 등' },
    { value: 'company_info', label: '기업 정보', description: '기업 개황, 재무 정보' },
    { value: 'financials', label: '재무제표', description: '손익계산서, 재무상태표 등' },
];

const dataSources = [
    { value: 'kis', label: 'KIS API', color: 'blue' },
    { value: 'yahoo', label: 'Yahoo Finance', color: 'purple' },
    { value: 'opendart', label: 'OpenDart', color: 'green' },
];

export default function AdminDataSources() {
    const { data: configs, mutate } = useSWR('/api/admin/data-sources', fetcher);
    const [editingMetric, setEditingMetric] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});

    const handleEdit = (config: any) => {
        setEditingMetric(config.metricType);
        setFormData({
            primarySource: config.primarySource,
            fallbackSources: config.fallbackSources || [],
            isActive: config.isActive,
        });
    };

    const handleSave = async () => {
        if (!editingMetric) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/data-sources/${editingMetric}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify(formData),
            });

            mutate();
            setEditingMetric(null);
            alert('설정이 저장되었습니다.');
        } catch (error) {
            console.error('Save failed:', error);
            alert('저장 실패');
        }
    };

    const handleInitialize = async () => {
        if (!confirm('기본 설정으로 초기화하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch('/api/admin/data-sources/initialize', {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });

            mutate();
            alert('초기화되었습니다.');
        } catch (error) {
            console.error('Initialize failed:', error);
            alert('초기화 실패');
        }
    };

    const getSourceColor = (source: string) => {
        const sourceInfo = dataSources.find(s => s.value === source);
        return sourceInfo?.color || 'gray';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">데이터 소스 설정</h1>
                    <p className="text-gray-600 mt-1">각 지표별로 사용할 데이터 소스를 관리합니다</p>
                </div>
                <button
                    onClick={handleInitialize}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                    🔄 기본값으로 초기화
                </button>
            </div>

            {/* Metric Configs */}
            <div className="grid gap-4">
                {metricTypes.map((metric) => {
                    const config = configs?.find((c: any) => c.metricType === metric.value);
                    const isEditing = editingMetric === metric.value;

                    return (
                        <Card key={metric.value}>
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold">{metric.label}</h3>
                                    <p className="text-sm text-gray-600">{metric.description}</p>

                                    {isEditing ? (
                                        <div className="mt-4 space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    주 데이터 소스
                                                </label>
                                                <select
                                                    value={formData.primarySource}
                                                    onChange={(e) => setFormData({ ...formData, primarySource: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                >
                                                    {dataSources.map(source => (
                                                        <option key={source.value} value={source.value}>
                                                            {source.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    백업 소스 (우선순위 순)
                                                </label>
                                                <div className="space-y-2">
                                                    {dataSources.filter(s => s.value !== formData.primarySource).map(source => (
                                                        <label key={source.value} className="flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.fallbackSources?.includes(source.value)}
                                                                onChange={(e) => {
                                                                    const fallbacks = formData.fallbackSources || [];
                                                                    if (e.target.checked) {
                                                                        setFormData({ ...formData, fallbackSources: [...fallbacks, source.value] });
                                                                    } else {
                                                                        setFormData({ ...formData, fallbackSources: fallbacks.filter((s: string) => s !== source.value) });
                                                                    }
                                                                }}
                                                                className="mr-2"
                                                            />
                                                            {source.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isActive}
                                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                    className="mr-2"
                                                />
                                                <label className="text-sm font-medium text-gray-700">활성화</label>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSave}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    onClick={() => setEditingMetric(null)}
                                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : config ? (
                                        <div className="mt-4 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-600">주 소스:</span>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded bg-${getSourceColor(config.primarySource)}-100 text-${getSourceColor(config.primarySource)}-800`}>
                                                    {dataSources.find(s => s.value === config.primarySource)?.label}
                                                </span>
                                            </div>
                                            {config.fallbackSources?.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-600">백업:</span>
                                                    <div className="flex gap-1">
                                                        {config.fallbackSources.map((source: string, idx: number) => (
                                                            <span key={source} className={`px-2 py-1 text-xs rounded bg-gray-100 text-gray-700`}>
                                                                {idx + 1}. {dataSources.find(s => s.value === source)?.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div>
                                                <span className={`text-xs ${config.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {config.isActive ? '● 활성' : '○ 비활성'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 text-sm text-gray-500">설정되지 않음</div>
                                    )}
                                </div>

                                {!isEditing && (
                                    <button
                                        onClick={() => handleEdit(config || { metricType: metric.value, primarySource: 'kis', fallbackSources: [], isActive: true })}
                                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                    >
                                        수정
                                    </button>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
