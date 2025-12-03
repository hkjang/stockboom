'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
        }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

function EditUserModal({ user, isOpen, onClose, onSave }: { user: any, isOpen: boolean, onClose: () => void, onSave: (data: any) => Promise<void> }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    // Sync state when user changes
    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
        }
    }, [user]);

    if (!isOpen || !user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({ name, email });
        onClose();
    };

    const handleResetPassword = async () => {
        if (!confirm('이 사용자의 비밀번호를 초기화하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                }
            });
            const data = await res.json();

            if (data.success && data.tempPassword) {
                alert(`비밀번호가 초기화되었습니다.\n\n임시 비밀번호: ${data.tempPassword}\n\n이 비밀번호를 사용자에게 안전하게 전달해 주세요.`);
            } else {
                alert('비밀번호 초기화에 실패했습니다.');
            }
        } catch (error) {
            console.error('Password reset failed:', error);
            alert('비밀번호 초기화 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold mb-4">사용자 정보 수정</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">이메일</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">이름</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="border-t pt-4">
                        <button
                            type="button"
                            onClick={handleResetPassword}
                            className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                        >
                            🔑 비밀번호 초기화
                        </button>
                    </div>
                    <div className="flex justify-end space-x-2 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            저장
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function AdminUsers() {
    const [searchTerm, setSearchTerm] = useState('');
    const { data: users, mutate } = useSWR('/api/admin/users', fetcher);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const filteredUsers = Array.isArray(users)
        ? users.filter((user: any) =>
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : [];

    const handleToggleStatus = async (userId: string, isActive: boolean) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({ isActive: !isActive }),
            });
            mutate();
        } catch (error) {
            console.error('Failed to toggle user status:', error);
            alert('상태 변경 실패');
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });
            mutate();
            alert('사용자가 삭제되었습니다.');
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert('삭제 실패');
        }
    };

    const handleEditClick = (user: any) => {
        setEditingUser(user);
        setIsEditModalOpen(true);
    };

    const handleSaveUser = async (data: any) => {
        if (!editingUser) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify(data),
            });
            mutate();
            alert('사용자 정보가 수정되었습니다.');
        } catch (error) {
            console.error('Failed to update user:', error);
            alert('수정 실패');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">사용자 관리</h1>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    + 새 사용자
                </button>
            </div>

            {/* Search */}
            <Card>
                <input
                    type="text"
                    placeholder="이메일 또는 이름으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </Card>

            {/* Users Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    사용자
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    2FA
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    가입일
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    최근 로그인
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    상태
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    작업
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers?.map((user: any) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <div className="font-medium text-gray-900">{user.email}</div>
                                            <div className="text-sm text-gray-500">{user.name || 'N/A'}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.twoFactorEnabled ? (
                                            <Badge variant="success" size="sm">활성</Badge>
                                        ) : (
                                            <Badge variant="default" size="sm">비활성</Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {user.lastLoginAt
                                            ? new Date(user.lastLoginAt).toLocaleDateString('ko-KR')
                                            : 'N/A'
                                        }
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge
                                            variant={user.isActive ? 'success' : 'danger'}
                                            size="sm"
                                        >
                                            {user.isActive ? '활성' : '비활성'}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                        <button
                                            onClick={() => handleToggleStatus(user.id, user.isActive)}
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            {user.isActive ? '비활성화' : '활성화'}
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(user)}
                                            className="text-indigo-600 hover:text-indigo-900"
                                        >
                                            수정
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <EditUserModal
                user={editingUser}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveUser}
            />
        </div>
    );
}
