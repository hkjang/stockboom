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
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
        }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

type TabType = 'opendart' | 'stocks' | 'scheduler' | 'history';

const tabs = [
    { id: 'opendart' as TabType, label: 'OpenDart', icon: '🏢', description: '기업코드 및 공시 데이터' },
    { id: 'stocks' as TabType, label: '주가 데이터', icon: '📈', description: '가격 및 캔들 수집' },
    { id: 'scheduler' as TabType, label: '스케줄러', icon: '⏰', description: '자동 수집 관리' },
    { id: 'history' as TabType, label: '작업 히스토리', icon: '📋', description: '수집 작업 로그' },
];

export default function AdminDataCollection() {
    const [activeTab, setActiveTab] = useState<TabType>('opendart');

    const { data: stats, isLoading: statsLoading, mutate: mutateStats } = useSWR(
        '/api/admin/data-collection/stats',
        fetcher,
        { refreshInterval: 10000 }
    );

    const handleRefresh = () => {
        mutateStats();
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                            📊
                        </span>
                        데이터 수동 수집
                    </h1>
                    <p className="text-gray-400 mt-1">
                        주식 데이터 수동 수집 및 관리
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex items-center gap-2 self-start"
                >
                    <RefreshIcon className="w-4 h-4" />
                    새로고침
                </button>
            </div>

            {/* Stats Cards */}
            <DataCollectionStats stats={stats} loading={statsLoading} />

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 p-1 bg-gray-800/50 rounded-xl border border-gray-700">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 min-w-[180px] px-4 py-3 rounded-lg font-medium transition-all ${activeTab === tab.id
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-lg">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </div>
                        {activeTab === tab.id && (
                            <p className="text-xs text-indigo-200 mt-1 hidden md:block">
                                {tab.description}
                            </p>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'opendart' && (
                    <OpenDartTab onRefresh={handleRefresh} />
                )}
                {activeTab === 'stocks' && (
                    <StockDataTab onRefresh={handleRefresh} />
                )}
                {activeTab === 'scheduler' && (
                    <SchedulerTab onRefresh={handleRefresh} />
                )}
                {activeTab === 'history' && (
                    <JobHistoryTab onRefresh={handleRefresh} />
                )}
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
