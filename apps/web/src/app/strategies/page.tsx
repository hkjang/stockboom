'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import EditStrategyModal from '@/components/EditStrategyModal';
import { HelpTooltip, HelpModal, HelpButton, pageHelpContent } from '@/components/ui/HelpTooltip';
import { Play, Pause, Trash2, Edit, TrendingUp, HelpCircle } from 'lucide-react';

export default function StrategiesPage() {
    const [loading, setLoading] = useState(true);
    const [strategies, setStrategies] = useState<any[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [strategyToEdit, setStrategyToEdit] = useState<any>(null);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        fetchStrategies();
    }, []);

    const fetchStrategies = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/strategies', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setStrategies(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to fetch strategies:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말로 이 전략을 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/strategies/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            fetchStrategies();
        } catch (error) {
            console.error('Failed to delete strategy:', error);
        }
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
                title={pageHelpContent.strategy.title}
                sections={pageHelpContent.strategy.sections}
            />

            <div className="container mx-auto px-6 py-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            전략관리
                            <HelpTooltip term="strategy" position="right">
                                <HelpCircle size={18} className="text-gray-400" />
                            </HelpTooltip>
                        </h2>
                        <p className="text-blue-200">자동매매 전략 설정 및 백테스팅</p>
                    </div>
                    <HelpButton onClick={() => setShowHelp(true)} />
                </div>

                {strategies.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
                        <div className="text-6xl mb-4">⚡</div>
                        <h3 className="text-2xl font-bold text-white mb-2">전략이 없습니다</h3>
                        <p className="text-blue-300">자동매매 전략을 생성하여 수익을 극대화하세요.</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {strategies.map((strategy) => (
                            <div
                                key={strategy.id}
                                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white mb-1">{strategy.name}</h3>
                                        <p className="text-blue-300 text-sm">{strategy.description}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${strategy.isActive
                                        ? 'bg-green-600/20 text-green-400'
                                        : 'bg-gray-600/20 text-gray-400'
                                        }`}>
                                        {strategy.isActive ? '활성' : '비활성'}
                                    </div>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-blue-300 text-sm">유형</span>
                                        <span className="text-white font-semibold text-sm">{strategy.type}</span>
                                    </div>

                                    {strategy.backtestReturn !== null && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-blue-300 text-sm">백테스트 수익률</span>
                                            <span className={`font-semibold text-sm ${Number(strategy.backtestReturn) >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {Number(strategy.backtestReturn) >= 0 ? '+' : ''}{Number(strategy.backtestReturn).toFixed(2)}%
                                            </span>
                                        </div>
                                    )}

                                    {strategy.winRate !== null && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-blue-300 text-sm flex items-center gap-1">
                                                승률
                                                <HelpTooltip term="winRate" position="left">
                                                    <HelpCircle size={10} className="text-gray-500" />
                                                </HelpTooltip>
                                            </span>
                                            <span className="text-white font-semibold text-sm">{Number(strategy.winRate).toFixed(1)}%</span>
                                        </div>
                                    )}

                                    {strategy.sharpeRatio !== null && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-blue-300 text-sm flex items-center gap-1">
                                                샤프 지수
                                                <HelpTooltip term="sharpeRatio" position="left">
                                                    <HelpCircle size={10} className="text-gray-500" />
                                                </HelpTooltip>
                                            </span>
                                            <span className="text-white font-semibold text-sm">{Number(strategy.sharpeRatio).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-white/10">
                                    <button
                                        onClick={() => {
                                            setStrategyToEdit(strategy);
                                            setIsEditModalOpen(true);
                                        }}
                                        className="flex-1 px-4 py-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition flex items-center justify-center gap-2"
                                    >
                                        <Edit size={16} />
                                        수정
                                    </button>
                                    <button
                                        onClick={() => handleDelete(strategy.id)}
                                        className="flex-1 px-4 py-2 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={16} />
                                        삭제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <EditStrategyModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setStrategyToEdit(null);
                }}
                onSuccess={() => {
                    fetchStrategies();
                    setIsEditModalOpen(false);
                    setStrategyToEdit(null);
                }}
                strategy={strategyToEdit}
            />
        </DashboardLayout>
    );
}
