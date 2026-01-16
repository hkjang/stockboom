'use client';

import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
        .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); });
};

const metricTypes = [
    { value: 'price', label: '시세', desc: '실시간 주가' },
    { value: 'volume', label: '거래량', desc: '거래량 정보' },
    { value: 'candles', label: '캔들', desc: '분봉, 일봉 등' },
    { value: 'company_info', label: '기업정보', desc: '기업 개황' },
    { value: 'financials', label: '재무제표', desc: '손익, 재무상태표' },
];

const dataSources = [
    { value: 'kis', label: 'KIS', color: 'blue' },
    { value: 'yahoo', label: 'Yahoo', color: 'purple' },
    { value: 'opendart', label: 'OpenDart', color: 'green' },
];

export default function AdminDataSources() {
    const { data: configs, mutate } = useSWR('/api/admin/data-sources', fetcher);
    const [editingMetric, setEditingMetric] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});

    const handleEdit = (config: any) => {
        setEditingMetric(config.metricType);
        setFormData({ primarySource: config.primarySource, fallbackSources: config.fallbackSources || [], isActive: config.isActive });
    };

    const handleSave = async () => {
        if (!editingMetric) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/data-sources/${editingMetric}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify(formData),
        });
        mutate();
        setEditingMetric(null);
    };

    const handleInitialize = async () => {
        if (!confirm('기본 설정으로 초기화?')) return;
        const token = localStorage.getItem('token');
        await fetch('/api/admin/data-sources/initialize', {
            method: 'POST', headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        mutate();
    };

    const getSourceBadge = (source: string) => {
        const s = dataSources.find(d => d.value === source);
        const colors: Record<string, string> = {
            blue: 'bg-blue-600/20 text-blue-400',
            purple: 'bg-purple-600/20 text-purple-400',
            green: 'bg-emerald-600/20 text-emerald-400',
        };
        return colors[s?.color || ''] || 'bg-gray-600/20 text-gray-400';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white">데이터 소스</h1>
                    <p className="text-xs text-blue-200 mt-0.5">지표별 데이터 소스 관리</p>
                </div>
                <button onClick={handleInitialize}
                    className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-blue-200 rounded-lg">
                    🔄 초기화
                </button>
            </div>

            <div className="space-y-2">
                {metricTypes.map((metric) => {
                    const config = configs?.find((c: any) => c.metricType === metric.value);
                    const isEditing = editingMetric === metric.value;

                    return (
                        <div key={metric.value} className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-semibold text-white">{metric.label}</h3>
                                        <span className="text-xs text-blue-300/70">{metric.desc}</span>
                                    </div>

                                    {isEditing ? (
                                        <div className="mt-2 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-blue-200">주 소스:</label>
                                                <select value={formData.primarySource} onChange={(e) => setFormData({ ...formData, primarySource: e.target.value })}
                                                    className="px-2 py-1 text-xs bg-white/5 border border-white/20 rounded-lg text-white">
                                                    {dataSources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-blue-200">백업:</label>
                                                {dataSources.filter(s => s.value !== formData.primarySource).map(s => (
                                                    <label key={s.value} className="flex items-center text-xs text-blue-200">
                                                        <input type="checkbox" checked={formData.fallbackSources?.includes(s.value)}
                                                            onChange={(e) => {
                                                                const fb = formData.fallbackSources || [];
                                                                setFormData({
                                                                    ...formData,
                                                                    fallbackSources: e.target.checked ? [...fb, s.value] : fb.filter((x: string) => x !== s.value)
                                                                });
                                                            }}
                                                            className="mr-1 rounded bg-white/10 border-white/20" />
                                                        {s.label}
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center text-xs text-blue-200">
                                                    <input type="checkbox" checked={formData.isActive}
                                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                        className="mr-1 rounded bg-white/10 border-white/20" />
                                                    활성화
                                                </label>
                                                <button onClick={handleSave}
                                                    className="px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg">저장</button>
                                                <button onClick={() => setEditingMetric(null)}
                                                    className="px-2 py-0.5 text-xs bg-white/10 text-blue-200 rounded-lg">취소</button>
                                            </div>
                                        </div>
                                    ) : config ? (
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-1.5 py-0.5 text-xs rounded ${getSourceBadge(config.primarySource)}`}>
                                                {dataSources.find(s => s.value === config.primarySource)?.label}
                                            </span>
                                            {config.fallbackSources?.map((s: string) => (
                                                <span key={s} className="px-1.5 py-0.5 text-xs rounded bg-white/10 text-blue-300">
                                                    {dataSources.find(d => d.value === s)?.label}
                                                </span>
                                            ))}
                                            <span className={`text-xs ${config.isActive ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                {config.isActive ? '● 활성' : '○ 비활성'}
                                            </span>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-blue-300/70 mt-1">설정 없음</p>
                                    )}
                                </div>

                                {!isEditing && (
                                    <button onClick={() => handleEdit(config || { metricType: metric.value, primarySource: 'kis', fallbackSources: [], isActive: true })}
                                        className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg">수정</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
