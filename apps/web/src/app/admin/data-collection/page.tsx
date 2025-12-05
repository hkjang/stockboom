'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DataCollectionStats } from './components/DataCollectionStats';
import { OpenDartTab } from './components/OpenDartTab';
import { StockDataTab } from './components/StockDataTab';
import { SchedulerTab } from './components/SchedulerTab';
import { JobHistoryTab } from './components/JobHistoryTab';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

type TabType = 'opendart' | 'stocks' | 'scheduler' | 'history';

const tabs = [
    { id: 'opendart' as TabType, label: 'OpenDart', icon: '🏢' },
    { id: 'stocks' as TabType, label: '주가 데이터', icon: '📈' },
    { id: 'scheduler' as TabType, label: '스케줄러', icon: '⏰' },
    { id: 'history' as TabType, label: '히스토리', icon: '📋' },
];

export default function AdminDataCollection() {
    const [activeTab, setActiveTab] = useState<TabType>('opendart');

    const { data: stats, isLoading: statsLoading, mutate: mutateStats } = useSWR(
        '/api/admin/data-collection/stats',
        fetcher,
        { refreshInterval: 10000 }
    );

    const handleRefresh = () => mutateStats();

    return (
        <div className="space-y-4 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">데이터 수집</h1>
                    <p className="text-xs text-gray-400 mt-0.5">주식 데이터 수동 수집 및 관리</p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors flex items-center gap-1.5"
                >
                    <RefreshIcon className="w-3 h-3" />
                    새로고침
                </button>
            </div>

            {/* Stats Cards */}
            <DataCollectionStats stats={stats} loading={statsLoading} />

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg border border-gray-700">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <span className="mr-1.5">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[300px]">
                {activeTab === 'opendart' && <OpenDartTab onRefresh={handleRefresh} />}
                {activeTab === 'stocks' && <StockDataTab onRefresh={handleRefresh} />}
                {activeTab === 'scheduler' && <SchedulerTab onRefresh={handleRefresh} />}
                {activeTab === 'history' && <JobHistoryTab onRefresh={handleRefresh} />}
            </div>
        </div>
    );
}

function RefreshIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    );
}
