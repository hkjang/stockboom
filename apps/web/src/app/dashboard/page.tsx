'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [portfolios, setPortfolios] = useState([]);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/auth/login');
            return;
        }

        fetchData(token);
    }, []);

    const fetchData = async (token: string) => {
        try {
            // Fetch user profile
            const profileRes = await fetch('/api/auth/profile', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (profileRes.ok) {
                const profileData = await profileRes.json();
                setUser(profileData);
            }

            // Fetch portfolios
            const portfoliosRes = await fetch('/api/portfolios', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (portfoliosRes.ok) {
                const portfoliosData = await portfoliosRes.json();
                setPortfolios(portfoliosData);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Navigation */}
            <nav className="bg-white/5 backdrop-blur-lg border-b border-white/10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-white">📈 StockBoom</h1>
                        <div className="flex items-center gap-4">
                            <span className="text-blue-200">{user?.email}</span>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-600/20 text-red-200 rounded-lg hover:bg-red-600/30 transition"
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
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
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            + 새 포트폴리오
                        </button>
                    </div>

                    {portfolios.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📊</div>
                            <p className="text-blue-200 mb-4">아직 포트폴리오가 없습니다</p>
                            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
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
                                                ₩{portfolio.totalValue?.toLocaleString() || '0'}
                                            </div>
                                            <div className={`text-sm ${portfolio.totalReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct?.toFixed(2) || '0.00'}%
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
        </div>
    );
}
