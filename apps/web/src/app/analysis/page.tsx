'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Search, TrendingUp, Newspaper, Brain } from 'lucide-react';

export default function AnalysisPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">종목분석</h2>
                    <p className="text-blue-200">기술적 지표 및 AI 분석</p>
                </div>

                {/* Search Bar */}
                <div className="mb-8">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-300" size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="종목명 또는 종목코드로 검색..."
                            className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Feature Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition cursor-pointer">
                        <div className="flex justify-center mb-4">
                            <div className="p-4 bg-blue-600/20 rounded-full">
                                <TrendingUp size={32} className="text-blue-400" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">기술적 분석</h3>
                        <p className="text-blue-300 text-sm">RSI, MACD, 볼린저 밴드 등 다양한 기술적 지표 분석</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition cursor-pointer">
                        <div className="flex justify-center mb-4">
                            <div className="p-4 bg-purple-600/20 rounded-full">
                                <Brain size={32} className="text-purple-400" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">AI 분석</h3>
                        <p className="text-blue-300 text-sm">인공지능 기반 종목 분석 및 투자 인사이트</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition cursor-pointer">
                        <div className="flex justify-center mb-4">
                            <div className="p-4 bg-green-600/20 rounded-full">
                                <Newspaper size={32} className="text-green-400" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">뉴스 & 센티먼트</h3>
                        <p className="text-blue-300 text-sm">실시간 뉴스 분석 및 시장 감성 지표</p>
                    </div>
                </div>

                {/* Placeholder Content */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-2xl font-bold text-white mb-2">종목을 검색하세요</h3>
                    <p className="text-blue-300">종목을 검색하면 상세한 분석 결과를 확인할 수 있습니다.</p>
                </div>
            </div>
        </DashboardLayout>
    );
}
