'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditAlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    alert: any;
}

export default function EditAlertModal({ isOpen, onClose, onSuccess, alert }: EditAlertModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [webPush, setWebPush] = useState(false);
    const [email, setEmail] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (alert) {
            setName(alert.name || '');
            setDescription(alert.description || '');
            setIsActive(alert.isActive || false);
            setWebPush(alert.webPush || false);
            setEmail(alert.email || false);
        }
    }, [alert]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/alerts/${alert.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name,
                    description,
                    isActive,
                    webPush,
                    email,
                }),
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                setError(data.message || '알림 수정에 실패했습니다.');
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
                    <h3 className="text-xl font-bold text-white">알림 수정</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-blue-200 text-sm mb-2">알림 이름 *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-blue-200 text-sm mb-2">설명</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-5 h-5 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="isActive" className="text-blue-200 text-sm">알림 활성화</label>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="webPush"
                            checked={webPush}
                            onChange={(e) => setWebPush(e.target.checked)}
                            className="w-5 h-5 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="webPush" className="text-blue-200 text-sm">웹 푸시 알림</label>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="email"
                            checked={email}
                            onChange={(e) => setEmail(e.target.checked)}
                            className="w-5 h-5 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="email" className="text-blue-200 text-sm">이메일 알림</label>
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
                            {loading ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
