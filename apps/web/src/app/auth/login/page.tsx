'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Store token
                localStorage.setItem('token', data.access_token);
                // Redirect to dashboard
                router.push('/dashboard');
            } else {
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">📈 StockBoom</h1>
                    <p className="text-blue-200">로그인하여 시작하세요</p>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-blue-100 mb-2">
                                이메일
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400"
                                placeholder="user@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-blue-100 mb-2">
                                비밀번호
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <a href="/auth/register" className="text-blue-300 hover:text-blue-200 text-sm">
                            계정이 없으신가요? 회원가입
                        </a>
                    </div>

                    {/* 개발용 자동 입력 버튼 */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <p className="text-xs text-blue-300/50 mb-3 text-center">🔧 개발 테스트용</p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmail('admin@stockboom.com');
                                        setPassword('password123');
                                    }}
                                    className="flex-1 py-2 bg-purple-600/30 border border-purple-400/30 text-purple-200 rounded-lg text-xs hover:bg-purple-600/50 transition"
                                >
                                    👑 관리자
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmail('trader1@example.com');
                                        setPassword('password123');
                                    }}
                                    className="flex-1 py-2 bg-green-600/30 border border-green-400/30 text-green-200 rounded-lg text-xs hover:bg-green-600/50 transition"
                                >
                                    👤 일반 사용자
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 text-center">
                    <a href="/" className="text-blue-300 hover:text-blue-200 text-sm">
                        ← 홈으로 돌아가기
                    </a>
                </div>
            </div>
        </div>
    );
}
