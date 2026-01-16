'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/Badge';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

function EditUserModal({ user, isOpen, onClose, onSave }: { user: any, isOpen: boolean, onClose: () => void, onSave: (data: any) => Promise<void> }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (user) { setName(user.name || ''); setEmail(user.email || ''); }
    }, [user]);

    if (!isOpen || !user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({ name, email });
        onClose();
    };

    const handleResetPassword = async () => {
        if (!confirm('비밀번호를 초기화하시겠습니까?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            const data = await res.json();
            if (data.success && data.tempPassword) {
                alert(`임시 비밀번호: ${data.tempPassword}`);
            } else {
                alert('초기화 실패');
            }
        } catch { alert('오류 발생'); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-xl max-w-sm w-full p-4">
                <h2 className="text-sm font-semibold text-white mb-3">사용자 수정</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs text-blue-200 mb-1">이메일</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white" required />
                    </div>
                    <div>
                        <label className="block text-xs text-blue-200 mb-1">이름</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white" />
                    </div>
                    <button type="button" onClick={handleResetPassword}
                        className="w-full px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
                        🔑 비밀번호 초기화
                    </button>
                    <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                        <button type="button" onClick={onClose}
                            className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-blue-200 rounded-lg">취소</button>
                        <button type="submit"
                            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

import AdminUserApiKeysDialog from './AdminUserApiKeysDialog';

export default function AdminUsers() {
    const [searchTerm, setSearchTerm] = useState('');
    const { data: users, mutate } = useSWR('/api/admin/users', fetcher);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [apiKeyUser, setApiKeyUser] = useState<any>(null);
    const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);

    const filteredUsers = Array.isArray(users) ? users.filter((user: any) =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const handleToggleStatus = async (userId: string, isActive: boolean) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify({ isActive: !isActive }),
        });
        mutate();
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('사용자를 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        mutate();
    };

    const handleSaveUser = async (data: any) => {
        if (!editingUser) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/users/${editingUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify(data),
        });
        mutate();
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white">사용자 관리</h1>
                    <p className="text-xs text-blue-200 mt-0.5">사용자 계정 관리</p>
                </div>
                <button className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                    + 새 사용자
                </button>
            </div>

            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3">
                <input type="text" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300/50" />
            </div>

            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-3 py-2 text-left text-blue-200">사용자</th>
                            <th className="px-3 py-2 text-left text-blue-200">2FA</th>
                            <th className="px-3 py-2 text-left text-blue-200">가입일</th>
                            <th className="px-3 py-2 text-left text-blue-200">상태</th>
                            <th className="px-3 py-2 text-right text-blue-200">작업</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {filteredUsers?.map((user: any) => (
                            <tr key={user.id} className="hover:bg-white/5">
                                <td className="px-3 py-2">
                                    <div className="text-white">{user.email}</div>
                                    <div className="text-blue-300/70">{user.name || 'N/A'}</div>
                                </td>
                                <td className="px-3 py-2">
                                    <Badge variant={user.twoFactorEnabled ? 'success' : 'default'} size="sm">
                                        {user.twoFactorEnabled ? '✓' : '✗'}
                                    </Badge>
                                </td>
                                <td className="px-3 py-2 text-blue-200">
                                    {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                                </td>
                                <td className="px-3 py-2">
                                    <Badge variant={user.isActive ? 'success' : 'danger'} size="sm">
                                        {user.isActive ? '활성' : '비활성'}
                                    </Badge>
                                </td>
                                <td className="px-3 py-2 text-right space-x-1">
                                    <button onClick={() => { setApiKeyUser(user); setIsApiKeyDialogOpen(true); }}
                                        className="px-1.5 py-0.5 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded">API</button>
                                    <button onClick={() => handleToggleStatus(user.id, user.isActive)}
                                        className="px-1.5 py-0.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded">
                                        {user.isActive ? '비활성화' : '활성화'}
                                    </button>
                                    <button onClick={() => { setEditingUser(user); setIsEditModalOpen(true); }}
                                        className="px-1.5 py-0.5 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 rounded">수정</button>
                                    <button onClick={() => handleDelete(user.id)}
                                        className="px-1.5 py-0.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded">삭제</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <EditUserModal user={editingUser} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveUser} />
            <AdminUserApiKeysDialog userId={apiKeyUser?.id || null} isOpen={isApiKeyDialogOpen} onClose={() => setIsApiKeyDialogOpen(false)} />
        </div>
    );
}
