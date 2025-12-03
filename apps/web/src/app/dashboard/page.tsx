'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CreatePortfolioModal from '@/components/CreatePortfolioModal';

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [portfolios, setPortfolios] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchPortfolios();
    }, []);

    const fetchPortfolios = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/portfolios', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setPortfolios(data);
            }
        } catch (error) {
            console.error('Failed to fetch portfolios:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePortfolioCreated = () => {
        fetchPortfolios();
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="text-white text-xl">Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">대시보드</h2>
                    <p className="text-blue-200">포트폴리오 및 투자 현황</p>
                </div>

                {/* Quick Stats */}
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-blue-300 text-sm mb-1">총 포트폴리오</div>
                        <div className="text-3xl font-bold text-white">{portfolios.length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-blue-300 text-sm mb-1">총 평가액</div>
                        <div className="text-3xl font-bold text-white">₩0</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-blue-300 text-sm mb-1">총 수익률</div>
                        <div className="text-3xl font-bold text-green-400">+0%</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-blue-300 text-sm mb-1">활성 전략</div>
                        <div className="text-3xl font-bold text-white">0</div>
                    </div>
                </div>

                {/* Portfolios */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">내 포트폴리오</h3>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            + 새 포트폴리오
                        </button>
                    </div>

                    {portfolios.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📊</div>
                            <p className="text-blue-200 mb-4">아직 포트폴리오가 없습니다</p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                첫 포트폴리오 만들기
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {portfolios.map((portfolio: any) => (
                                <div
                                    key={portfolio.id}
                                    className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition cursor-pointer"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-white font-semibold">{portfolio.name}</h4>
                                            <p className="text-blue-300 text-sm">{portfolio.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-white font-semibold">
                                                ₩{Number(portfolio.totalValue || 0).toLocaleString()}
                                            </div>
                                            <div className={`text-sm ${Number(portfolio.totalReturnPct || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {Number(portfolio.totalReturnPct || 0) >= 0 ? '+' : ''}{Number(portfolio.totalReturnPct || 0).toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition cursor-pointer">
                        <div className="text-4xl mb-3">📊</div>
                        <h4 className="text-white font-semibold mb-2">종목 분석</h4>
                        <p className="text-blue-300 text-sm">기술적 지표 및 AI 분석</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition cursor-pointer">
                        <div className="text-4xl mb-3">⚡</div>
                        <h4 className="text-white font-semibold mb-2">자동 매매</h4>
                        <p className="text-blue-300 text-sm">전략 설정 및 백테스팅</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center hover:bg-white/15 transition cursor-pointer">
                        <div className="text-4xl mb-3">🔔</div>
                        <h4 className="text-white font-semibold mb-2">알림 설정</h4>
                        <p className="text-blue-300 text-sm">가격 변동 및 신호 알림</p>
                    </div>
                </div>
            </div>

            <CreatePortfolioModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handlePortfolioCreated}
            />
        </DashboardLayout>
    );
}
