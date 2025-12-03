import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';

interface AdminUserApiKeysDialogProps {
    userId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function AdminUserApiKeysDialog({ userId, isOpen, onClose }: AdminUserApiKeysDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [keys, setKeys] = useState({
        kisAppKey: '',
        kisAppSecret: '',
        kisAccountNumber: '',
        kisMockMode: true,
        openDartApiKey: '',
    });
    const [showKeys, setShowKeys] = useState({
        kisAppKey: false,
        kisAppSecret: false,
        kisAccountNumber: false,
        openDartApiKey: false,
    });

    useEffect(() => {
        if (isOpen && userId) {
            fetchKeys();
        } else {
            // Reset state when closed
            setKeys({
                kisAppKey: '',
                kisAppSecret: '',
                kisAccountNumber: '',
                kisMockMode: true,
                openDartApiKey: '',
            });
        }
    }, [isOpen, userId]);

    const fetchKeys = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/users/${userId}/api-keys`, {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    setKeys({
                        kisAppKey: data.kisAppKey || '',
                        kisAppSecret: data.kisAppSecret || '',
                        kisAccountNumber: data.kisAccountNumber || '',
                        kisMockMode: data.kisMockMode ?? true,
                        openDartApiKey: data.openDartApiKey || '',
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch API keys:', error);
            alert('API 키 정보를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/users/${userId}/api-keys`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify(keys),
            });

            if (res.ok) {
                alert('API 키가 저장되었습니다.');
                onClose();
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('Failed to save API keys:', error);
            alert('API 키 저장에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!userId || !confirm('정말로 이 사용자의 모든 API 키를 삭제하시겠습니까?')) return;

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/users/${userId}/api-keys`, {
                method: 'DELETE',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });

            if (res.ok) {
                alert('API 키가 삭제되었습니다.');
                onClose();
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            console.error('Failed to delete API keys:', error);
            alert('API 키 삭제에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleShow = (field: keyof typeof showKeys) => {
        setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">API 키 관리</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                {isLoading && <div className="text-center py-4">로딩 중...</div>}

                {!isLoading && (
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* KIS API Section */}
                        <div className="space-y-4 border p-4 rounded-lg bg-gray-50">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                한국투자증권 (KIS) API
                                <Badge variant={keys.kisAppKey ? 'success' : 'default'} size="sm">
                                    {keys.kisAppKey ? '설정됨' : '미설정'}
                                </Badge>
                            </h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">App Key</label>
                                <div className="relative">
                                    <input
                                        type={showKeys.kisAppKey ? "text" : "password"}
                                        value={keys.kisAppKey}
                                        onChange={e => setKeys({ ...keys, kisAppKey: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                                        placeholder="KIS App Key 입력"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleShow('kisAppKey')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showKeys.kisAppKey ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">App Secret</label>
                                <div className="relative">
                                    <input
                                        type={showKeys.kisAppSecret ? "text" : "password"}
                                        value={keys.kisAppSecret}
                                        onChange={e => setKeys({ ...keys, kisAppSecret: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                                        placeholder="KIS App Secret 입력"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleShow('kisAppSecret')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showKeys.kisAppSecret ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호 (8+2자리)</label>
                                <div className="relative">
                                    <input
                                        type={showKeys.kisAccountNumber ? "text" : "password"}
                                        value={keys.kisAccountNumber}
                                        onChange={e => setKeys({ ...keys, kisAccountNumber: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                                        placeholder="1234567801"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleShow('kisAccountNumber')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showKeys.kisAccountNumber ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="kisMockMode"
                                    checked={keys.kisMockMode}
                                    onChange={e => setKeys({ ...keys, kisMockMode: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="kisMockMode" className="text-sm text-gray-700">
                                    모의투자 모드 사용 (체크 해제 시 실거래)
                                </label>
                            </div>
                        </div>

                        {/* OpenDart API Section */}
                        <div className="space-y-4 border p-4 rounded-lg bg-gray-50">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                OpenDart API
                                <Badge variant={keys.openDartApiKey ? 'success' : 'default'} size="sm">
                                    {keys.openDartApiKey ? '설정됨' : '미설정'}
                                </Badge>
                            </h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                <div className="relative">
                                    <input
                                        type={showKeys.openDartApiKey ? "text" : "password"}
                                        value={keys.openDartApiKey}
                                        onChange={e => setKeys({ ...keys, openDartApiKey: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                                        placeholder="OpenDart API Key 입력"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleShow('openDartApiKey')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showKeys.openDartApiKey ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between pt-4 border-t">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                                모든 키 삭제
                            </button>
                            <div className="space-x-2">
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
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
