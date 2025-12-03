'use client';

import { useState } from 'react';
import useSWR from 'swr';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Eye, EyeOff, Save, Trash2 } from 'lucide-react';

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

export default function ApiKeysSettingsPage() {
    const { data: apiKeys, mutate } = useSWR('/api/user/api-keys', fetcher);
    const [showKisKey, setShowKisKey] = useState(false);
    const [showKisSecret, setShowKisSecret] = useState(false);
    const [showOpenDart, setShowOpenDart] = useState(false);

    const [formData, setFormData] = useState({
        kisAppKey: '',
        kisAppSecret: '',
        kisAccountNumber: '',
        kisMockMode: true,
        openDartApiKey: '',
    });

    const handleSave = async () => {
        if (!confirm('API 키를 저장하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/user/api-keys', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                alert('저장되었습니다.');
                mutate();
                // Clear form
                setFormData({
                    kisAppKey: '',
                    kisAppSecret: '',
                    kisAccountNumber: '',
                    kisMockMode: true,
                    openDartApiKey: '',
                });
            } else {
                alert('저장 실패');
            }
        } catch (error) {
            console.error('Save failed:', error);
            alert('저장 실패');
        }
    };

    const handleDelete = async () => {
        if (!confirm('모든 API 키를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/user/api-keys', {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });

            if (res.ok) {
                alert('삭제되었습니다. 이제 환경변수 키를 사용합니다.');
                mutate();
            } else {
                alert('삭제 실패');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('삭제 실패');
        }
    };

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">API 키 설정</h2>
                    <p className="text-blue-200">KIS API 및 OpenDart API 키를 관리합니다</p>
                </div>

                {/* Current Keys Status */}
                {apiKeys && (
                    <Card className="mb-6 bg-blue-900/20">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-white">현재 설정된 키</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-400">KIS API:</span>
                                    <span className="ml-2 text-white">{apiKeys.kisAppKey || '미설정'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400">OpenDart:</span>
                                    <span className="ml-2 text-white">{apiKeys.openDartApiKey || '미설정'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400">계좌번호:</span>
                                    <span className="ml-2 text-white">{apiKeys.kisAccountNumber || '미설정'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400">모의투자:</span>
                                    <span className="ml-2 text-white">{apiKeys.kisMockMode ? '활성화' : '실거래'}</span>
                                </div>
                            </div>
                            {apiKeys.lastUsedAt && (
                                <div className="text-xs text-gray-400 mt-2">
                                    마지막 사용: {new Date(apiKeys.lastUsedAt).toLocaleString('ko-KR')}
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* KIS API Settings */}
                <Card className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-4">한국투자증권 (KIS) API</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                App Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showKisKey ? 'text' : 'password'}
                                    value={formData.kisAppKey}
                                    onChange={(e) => setFormData({ ...formData, kisAppKey: e.target.value })}
                                    placeholder="KIS App Key 입력"
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                                />
                                <button
                                    onClick={() => setShowKisKey(!showKisKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showKisKey ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                App Secret
                            </label>
                            <div className="relative">
                                <input
                                    type={showKisSecret ? 'text' : 'password'}
                                    value={formData.kisAppSecret}
                                    onChange={(e) => setFormData({ ...formData, kisAppSecret: e.target.value })}
                                    placeholder="KIS App Secret 입력"
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                                />
                                <button
                                    onClick={() => setShowKisSecret(!showKisSecret)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showKisSecret ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                계좌번호
                            </label>
                            <input
                                type="text"
                                value={formData.kisAccountNumber}
                                onChange={(e) => setFormData({ ...formData, kisAccountNumber: e.target.value })}
                                placeholder="계좌번호 (숫자만)"
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.kisMockMode}
                                onChange={(e) => setFormData({ ...formData, kisMockMode: e.target.checked })}
                                className="mr-2 w-4 h-4"
                            />
                            <label className="text-sm text-gray-300">
                                모의투자 모드 사용
                            </label>
                        </div>
                    </div>
                </Card>

                {/* OpenDart API Settings */}
                <Card className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-4">OpenDart API</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                API Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showOpenDart ? 'text' : 'password'}
                                    value={formData.openDartApiKey}
                                    onChange={(e) => setFormData({ ...formData, openDartApiKey: e.target.value })}
                                    placeholder="OpenDart API Key 입력"
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                                />
                                <button
                                    onClick={() => setShowOpenDart(!showOpenDart)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showOpenDart ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-400">
                            OpenDart API 키는 <a href="https://opendart.fss.or.kr/" target="_blank" className="text-blue-400 hover:underline">https://opendart.fss.or.kr/</a>에서 발급받을 수 있습니다.
                        </p>
                    </div>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Save size={20} />
                        저장
                    </button>
                    {apiKeys && (apiKeys.kisAppKey || apiKeys.openDartApiKey) && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            <Trash2 size={20} />
                            전체 삭제
                        </button>
                    )}
                </div>

                {/* Info */}
                <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                    <h4 className="font-semibold text-yellow-400 mb-2">⚠️ 보안 안내</h4>
                    <ul className="text-sm text-yellow-200 space-y-1">
                        <li>• API 키는 AES-256-GCM 암호화되어 안전하게 저장됩니다</li>
                        <li>• 키를 설정하지 않으면 시스템 기본 설정을 사용합니다</li>
                        <li>• 실거래 모드는 매우 신중하게 사용하세요</li>
                    </ul>
                </div>
            </div>
        </DashboardLayout>
    );
}
