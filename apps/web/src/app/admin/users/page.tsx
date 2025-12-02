'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AdminUsers() {
    const [searchTerm, setSearchTerm] = useState('');
    const { data: users, mutate } = useSWR('/api/admin/users', fetcher);

    const filteredUsers = users?.filter((user: any) =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleToggleStatus = async (userId: string, isActive: boolean) => {
        try {
            await fetch(`/api/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });
            mutate();
        } catch (error) {
            console.error('Failed to toggle user status:', error);
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
                                        <button className="text-indigo-600 hover:text-indigo-900">
                                            수정
                                        </button>
                                        <button className="text-red-600 hover:text-red-900">
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
