'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import CreatePortfolioModal from '@/components/CreatePortfolioModal';
import EditPortfolioModal from '@/components/EditPortfolioModal';
import { HelpTooltip, HelpModal, HelpButton, pageHelpContent } from '@/components/ui/HelpTooltip';
import { Trash2, RefreshCw, Plus, TrendingUp, TrendingDown, Edit, HelpCircle } from 'lucide-react';

export default function PortfoliosPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [portfolios, setPortfolios] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedPortfolio, setSelectedPortfolio] = useState<any>(null);
    const [portfolioToEdit, setPortfolioToEdit] = useState<any>(null);
    const [showHelp, setShowHelp] = useState(false);

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

    const handleDelete = async (id: string) => {
        if (!confirm('정말로 이 포트폴리오를 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/portfolios/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                fetchPortfolios();
            }
        } catch (error) {
            console.error('Failed to delete portfolio:', error);
        }
    };

    const handleSync = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/portfolios/${id}/sync`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                fetchPortfolios();
                alert('브로커 동기화가 완료되었습니다.');
            }
        } catch (error) {
            console.error('Failed to sync portfolio:', error);
        }
    };

    const handlePortfolioClick = (portfolio: any) => {
        setSelectedPortfolio(portfolio);
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
            {/* Help Modal */}
            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                title={pageHelpContent.portfolio.title}
                sections={pageHelpContent.portfolio.sections}
            />

            <div className="container mx-auto px-6 py-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            포트폴리오
                            <HelpTooltip term="portfolio" position="right">
                                <HelpCircle size={18} className="text-gray-400" />
                            </HelpTooltip>
                        </h2>
                        <p className="text-blue-200">내 투자 포트폴리오 관리</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <HelpButton onClick={() => setShowHelp(true)} />
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            <Plus size={20} />
                            새 포트폴리오
                        </button>
                    </div>
                </div>

                {portfolios.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
                        <div className="text-6xl mb-4">💼</div>
                        <h3 className="text-2xl font-bold text-white mb-2">포트폴리오가 없습니다</h3>
                        <p className="text-blue-300 mb-6">첫 번째 포트폴리오를 만들어보세요.</p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            포트폴리오 만들기
                        </button>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {portfolios.map((portfolio) => {
                            const returnPct = Number(portfolio.totalReturnPct || 0);
                            const isPositive = returnPct >= 0;

                            return (
                                <div
                                    key={portfolio.id}
                                    className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition cursor-pointer"
                                    onClick={() => handlePortfolioClick(portfolio)}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold text-white mb-1">{portfolio.name}</h3>
                                            <p className="text-blue-300 text-sm">{portfolio.description}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPortfolioToEdit(portfolio);
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="p-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition"
                                                title="수정"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSync(portfolio.id);
                                                }}
                                                className="p-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition"
                                                title="브로커 동기화"
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(portfolio.id);
                                                }}
                                                className="p-2 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition"
                                                title="삭제"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-blue-300 text-sm mb-1">총 평가액</div>
                                            <div className="text-2xl font-bold text-white">
                                                ₩{Number(portfolio.totalValue || 0).toLocaleString()}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-blue-300 text-sm mb-1">현금 잔액</div>
                                            <div className="text-lg font-semibold text-white">
                                                ₩{Number(portfolio.cashBalance || 0).toLocaleString()}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                                            <div className="text-blue-300 text-sm">수익률</div>
                                            <div className={`flex items-center gap-1 font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                                {isPositive ? '+' : ''}{returnPct.toFixed(2)}%
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="text-blue-300 text-sm">자동매매</div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${portfolio.autoTrade ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
                                                {portfolio.autoTrade ? '활성' : '비활성'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <CreatePortfolioModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    fetchPortfolios();
                    setIsModalOpen(false);
                }}
            />

            <EditPortfolioModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setPortfolioToEdit(null);
                }}
                onSuccess={() => {
                    fetchPortfolios();
                    setIsEditModalOpen(false);
                    setPortfolioToEdit(null);
                }}
                portfolio={portfolioToEdit}
            />
        </DashboardLayout>
    );
}
