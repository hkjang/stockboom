'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
    Calendar, Clock, TrendingUp, TrendingDown, 
    AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Filter
} from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => res.ok ? res.json() : null).catch(() => null);
};

interface EconomicEvent {
    id: string;
    date: string;
    time: string;
    country: 'KR' | 'US' | 'CN' | 'JP' | 'EU';
    importance: 'HIGH' | 'MEDIUM' | 'LOW';
    event: string;
    actual?: string | null;
    forecast?: string | null;
    previous?: string | null;
}

export default function EconomicCalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCountry, setSelectedCountry] = useState<string>('all');
    const [selectedImportance, setSelectedImportance] = useState<string>('all');
    
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - 3);
    const endDate = new Date(currentDate);
    endDate.setDate(endDate.getDate() + 14);
    
    const { data, mutate, isLoading, error } = useSWR(
        `/api/admin/economic-calendar?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
        fetcher
    );

    const events: EconomicEvent[] = data?.events || [];
    const isRealData = !!data?.timestamp;

    const filteredEvents = events.filter(e => {
        if (selectedCountry !== 'all' && e.country !== selectedCountry) return false;
        if (selectedImportance !== 'all' && e.importance !== selectedImportance) return false;
        return true;
    });

    const getCountryFlag = (country: string) => {
        const flags: Record<string, string> = {
            'KR': '🇰🇷',
            'US': '🇺🇸',
            'CN': '🇨🇳',
            'JP': '🇯🇵',
            'EU': '🇪🇺',
        };
        return flags[country] || '🌐';
    };

    const getImportanceColor = (importance: string) => {
        switch (importance) {
            case 'HIGH': return 'text-red-400 bg-red-400/20';
            case 'MEDIUM': return 'text-yellow-400 bg-yellow-400/20';
            default: return 'text-gray-400 bg-gray-400/20';
        }
    };

    const getResultColor = (actual?: string | null, forecast?: string | null) => {
        if (!actual || !forecast) return 'text-white';
        const actualNum = parseFloat(actual.replace(/[^0-9.-]/g, ''));
        const forecastNum = parseFloat(forecast.replace(/[^0-9.-]/g, ''));
        if (isNaN(actualNum) || isNaN(forecastNum)) return 'text-white';
        if (actualNum > forecastNum) return 'text-green-400';
        if (actualNum < forecastNum) return 'text-red-400';
        return 'text-white';
    };

    const moveDate = (days: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + days);
        setCurrentDate(newDate);
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
                    <p className="text-white">데이터를 불러올 수 없습니다</p>
                    <button onClick={() => mutate()} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calendar size={24} className="text-indigo-400" />
                        경제 캘린더
                        {isRealData && <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">LIVE</span>}
                    </h1>
                    <p className="text-xs text-blue-200 mt-0.5">글로벌 경제 지표 및 이벤트 일정</p>
                </div>
                <button 
                    onClick={() => mutate()} 
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1"
                >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    새로고침
                </button>
            </div>

            {/* Date Navigation */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <button onClick={() => moveDate(-7)} className="p-2 hover:bg-white/10 rounded-lg text-blue-200 hover:text-white">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs bg-indigo-600/50 hover:bg-indigo-600 text-white rounded-lg">
                            오늘
                        </button>
                        <span className="text-lg font-bold text-white">
                            {currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                        </span>
                    </div>
                    <button onClick={() => moveDate(7)} className="p-2 hover:bg-white/10 rounded-lg text-blue-200 hover:text-white">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 flex items-center gap-3">
                    <Filter size={14} className="text-blue-400" />
                    <div className="flex gap-2">
                        {['all', 'KR', 'US', 'CN', 'JP', 'EU'].map(c => (
                            <button
                                key={c}
                                onClick={() => setSelectedCountry(c)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedCountry === c ? 'bg-indigo-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                }`}
                            >
                                {c === 'all' ? '전체' : getCountryFlag(c)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 flex items-center gap-3">
                    <AlertCircle size={14} className="text-yellow-400" />
                    <div className="flex gap-2">
                        {['all', 'HIGH', 'MEDIUM', 'LOW'].map(i => (
                            <button
                                key={i}
                                onClick={() => setSelectedImportance(i)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedImportance === i ? 'bg-indigo-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                }`}
                            >
                                {i === 'all' ? '전체' : i === 'HIGH' ? '높음' : i === 'MEDIUM' ? '중간' : '낮음'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Events List */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-4 py-3 text-left text-blue-200 font-medium">날짜/시간</th>
                            <th className="px-4 py-3 text-left text-blue-200 font-medium">국가</th>
                            <th className="px-4 py-3 text-left text-blue-200 font-medium">중요도</th>
                            <th className="px-4 py-3 text-left text-blue-200 font-medium">이벤트</th>
                            <th className="px-4 py-3 text-right text-blue-200 font-medium">실제</th>
                            <th className="px-4 py-3 text-right text-blue-200 font-medium">예상</th>
                            <th className="px-4 py-3 text-right text-blue-200 font-medium">이전</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredEvents.length > 0 ? filteredEvents.map(event => (
                            <tr key={event.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="text-white">{event.date}</div>
                                    <div className="text-blue-200/50 text-xs flex items-center gap-1">
                                        <Clock size={10} />
                                        {event.time}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-lg">{getCountryFlag(event.country)}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getImportanceColor(event.importance)}`}>
                                        {event.importance === 'HIGH' ? '높음' : event.importance === 'MEDIUM' ? '중간' : '낮음'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-white font-medium">{event.event}</td>
                                <td className={`px-4 py-3 text-right font-bold ${getResultColor(event.actual, event.forecast)}`}>
                                    {event.actual || '-'}
                                </td>
                                <td className="px-4 py-3 text-right text-blue-200">{event.forecast || '-'}</td>
                                <td className="px-4 py-3 text-right text-blue-200/60">{event.previous || '-'}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-blue-200/50">
                                    {isLoading ? '데이터 로딩중...' : '해당 기간에 경제 이벤트가 없습니다'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex gap-6 text-xs text-blue-200/70 justify-center">
                <div className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-green-400" />
                    <span>실제 {'>'} 예상</span>
                </div>
                <div className="flex items-center gap-1">
                    <TrendingDown size={12} className="text-red-400" />
                    <span>실제 {'<'} 예상</span>
                </div>
            </div>
        </div>
    );
}
