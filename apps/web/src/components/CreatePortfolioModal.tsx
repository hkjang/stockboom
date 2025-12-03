'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface CreatePortfolioModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreatePortfolioModal({ isOpen, onClose, onSuccess }: CreatePortfolioModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/portfolios', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name,
                    description,
                    cashBalance: 10000000, // Default 1천만원
                }),
            });

            if (res.ok) {
                setName('');
                setDescription('');
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                setError(data.message || '포트폴리오 생성에 실패했습니다.');
            }
        } catch (err) {
            setError('네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl max-w-md w-full border border-white/10">
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">새 포트폴리오 만들기</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-blue-200 text-sm mb-2">
                            포트폴리오 이름 *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            placeholder="예: 장기 투자 포트폴리오"
                        />
                    </div>

                    <div>
                        <label className="block text-blue-200 text-sm mb-2">
                            설명 (선택)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            placeholder="포트폴리오에 대한 간단한 설명을 입력하세요"
                        />
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <p className="text-blue-300 text-sm">
                            💡 초기 현금 잔액: ₩10,000,000
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                            <p className="text-red-300 text-sm">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name}
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? '생성 중...' : '포트폴리오 만들기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
