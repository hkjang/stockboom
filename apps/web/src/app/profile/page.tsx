'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { User, Mail, Phone, Shield, Key, Bell, Clock, Save, CheckCircle } from 'lucide-react';
import { HelpModal, HelpButton } from '@/components/ui/HelpTooltip';

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [message, setMessage] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/auth/profile', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                setFormData({
                    name: data.name || '',
                    phone: data.phone || '',
                });
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                setMessage('프로필이 저장되었습니다.');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (error) {
            console.error('Failed to save profile:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                title="프로필 가이드"
                sections={[
                    {
                        heading: '프로필 관리',
                        content: '사용자 정보를 수정하고 보안 설정을 관리할 수 있습니다.',
                        tips: ['이름과 연락처를 최신 상태로 유지하세요']
                    }
                ]}
            />

            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <User className="text-blue-400" size={32} />
                            프로필
                        </h2>
                        <p className="text-blue-200">개인 정보 및 보안 설정</p>
                    </div>
                    <HelpButton onClick={() => setShowHelp(true)} />
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Profile Card */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Basic Info */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <User size={20} className="text-blue-400" />
                                    기본 정보
                                </h3>

                                {message && (
                                    <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
                                        <CheckCircle size={16} />
                                        {message}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-blue-200 mb-1">이메일</label>
                                        <div className="flex items-center gap-2 px-4 py-3 bg-white/5 rounded-lg border border-white/10">
                                            <Mail size={16} className="text-blue-400" />
                                            <span className="text-white">{user?.email}</span>
                                            <span className="ml-auto text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">
                                                인증됨
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-blue-200 mb-1">이름</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full px-4 py-3 bg-white/5 rounded-lg border border-white/10 
                                                       text-white focus:border-blue-500 focus:outline-none"
                                            placeholder="이름을 입력하세요"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-blue-200 mb-1">전화번호</label>
                                        <div className="flex items-center gap-2">
                                            <Phone size={16} className="text-blue-400" />
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                                className="flex-1 px-4 py-3 bg-white/5 rounded-lg border border-white/10 
                                                           text-white focus:border-blue-500 focus:outline-none"
                                                placeholder="010-0000-0000"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 
                                                   text-white rounded-lg transition disabled:opacity-50"
                                    >
                                        <Save size={16} />
                                        {saving ? '저장 중...' : '변경사항 저장'}
                                    </button>
                                </div>
                            </div>

                            {/* Security */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Shield size={20} className="text-green-400" />
                                    보안 설정
                                </h3>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Key size={18} className="text-blue-400" />
                                            <div>
                                                <p className="text-white font-medium">비밀번호</p>
                                                <p className="text-sm text-blue-300">마지막 변경: 30일 전</p>
                                            </div>
                                        </div>
                                        <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition">
                                            변경
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Shield size={18} className="text-purple-400" />
                                            <div>
                                                <p className="text-white font-medium">2단계 인증</p>
                                                <p className="text-sm text-blue-300">
                                                    {user?.twoFactorEnabled ? '활성화됨' : '비활성화됨'}
                                                </p>
                                            </div>
                                        </div>
                                        <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition">
                                            {user?.twoFactorEnabled ? '비활성화' : '활성화'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Side Info */}
                        <div className="space-y-6">
                            {/* Account Status */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                                <h3 className="text-lg font-semibold text-white mb-4">계정 상태</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-blue-200">상태</span>
                                        <span className="text-green-400 font-medium">활성</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-blue-200">역할</span>
                                        <span className="text-white">{user?.role === 'ADMIN' ? '관리자' : '사용자'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-blue-200">가입일</span>
                                        <span className="text-white">
                                            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-blue-200">마지막 로그인</span>
                                        <span className="text-white">
                                            {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ko-KR') : '오늘'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Links */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                                <h3 className="text-lg font-semibold text-white mb-4">빠른 링크</h3>
                                <div className="space-y-2">
                                    <a href="/settings" className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition text-blue-200 hover:text-white">
                                        설정으로 이동
                                    </a>
                                    <a href="/settings/api-keys" className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition text-blue-200 hover:text-white">
                                        API 키 관리
                                    </a>
                                    <a href="/settings/broker" className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition text-blue-200 hover:text-white">
                                        증권사 연동
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
