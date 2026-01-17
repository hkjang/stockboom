'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CreatePortfolioModal from '@/components/CreatePortfolioModal';
import { HelpTooltip, HelpModal, HelpButton, pageHelpContent } from '@/components/ui/HelpTooltip';
import { HelpCircle } from 'lucide-react';

interface Portfolio {
    id: string;
    name: string;
    description: string;
    totalValue: string | number;
    totalReturn: string | number;
    totalReturnPct: string | number;
    cashBalance: string | number;
}

interface Strategy {
    id: string;
    isActive: boolean;
}

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return { 'Authorization': `Bearer ${token}` };
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [portfoliosRes, strategiesRes] = await Promise.all([
                fetch('/api/portfolios', { headers: getAuthHeader() }),
                fetch('/api/strategies', { headers: getAuthHeader() }),
            ]);

            if (portfoliosRes.ok) {
                const data = await portfoliosRes.json();
                setPortfolios(data);
            }

            if (strategiesRes.ok) {
                const data = await strategiesRes.json();
                setStrategies(data);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePortfolioCreated = () => {
        fetchData();
    };

    // Calculate aggregated stats
    const stats = useMemo(() => {
        const totalValue = portfolios.reduce((sum, p) => sum + Number(p.totalValue || 0), 0);
        const totalCash = portfolios.reduce((sum, p) => sum + Number(p.cashBalance || 0), 0);
        const totalReturn = portfolios.reduce((sum, p) => sum + Number(p.totalReturn || 0), 0);

        // Calculate weighted average return percentage
        let totalReturnPct = 0;
        if (totalValue > 0) {
            totalReturnPct = (totalReturn / (totalValue - totalReturn)) * 100;
        }

        const activeStrategies = strategies.filter(s => s.isActive).length;

        return {
            totalPortfolios: portfolios.length,
            totalValue,
            totalReturnPct,
            activeStrategies,
            isPositive: totalReturnPct >= 0,
        };
    }, [portfolios, strategies]);

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
            {/* Help Modal */}
            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                title={pageHelpContent.dashboard.title}
                sections={pageHelpContent.dashboard.sections}
            />

            <div className="container mx-auto px-6 py-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            대시보드
                            <HelpTooltip term="portfolio" position="right">
                                <HelpCircle size={18} className="text-gray-400" />
                            </HelpTooltip>
                        </h2>
                        <p className="text-blue-200">포트폴리오 및 투자 현황</p>
                    </div>
                    <HelpButton onClick={() => setShowHelp(true)} />
                </div>

                {/* Quick Stats */}
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-blue-300 text-sm mb-1">총 포트폴리오</div>
                        <div className="text-3xl font-bold text-white">{stats.totalPortfolios}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-blue-300 text-sm mb-1 flex items-center gap-1">
                            총 평가액
                            <HelpTooltip term="unrealizedPnl" position="bottom">
                                <HelpCircle size={12} className="text-gray-400" />
                            </HelpTooltip>
                        </div>
                        <div className="text-3xl font-bold text-white">
                            ₩{stats.totalValue.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-blue-300 text-sm mb-1 flex items-center gap-1">
                            총 수익률
                            <HelpTooltip term="pnl" position="bottom">
                                <HelpCircle size={12} className="text-gray-400" />
                            </HelpTooltip>
                        </div>
                        <div className={`text-3xl font-bold ${stats.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {stats.isPositive ? '+' : ''}{stats.totalReturnPct.toFixed(2)}%
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-blue-300 text-sm mb-1 flex items-center gap-1">
                            활성 전략
                            <HelpTooltip term="strategy" position="bottom">
                                <HelpCircle size={12} className="text-gray-400" />
                            </HelpTooltip>
                        </div>
                        <div className="text-3xl font-bold text-white">{stats.activeStrategies}</div>
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
