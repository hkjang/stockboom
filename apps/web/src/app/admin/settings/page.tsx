'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Save, RefreshCw, Plus, Trash2, Eye, EyeOff, Settings, Server, Key, Bell, Activity } from 'lucide-react';

const fetcher = (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
};

interface SystemSetting {
    id: string;
    key: string;
    value: string | null;
    description: string | null;
    category: string;
    isSecret: boolean;
    createdAt: string;
    updatedAt: string;
}

interface EnvVariable {
    key: string;
    category: string;
    isSecret: boolean;
    hasValue: boolean;
    value: string | null;
    status: 'configured' | 'not_set';
}

function Card({ title, icon, children, className = '' }: { title?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden ${className}`}>
            {title && (
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                    {icon}
                    <h3 className="text-sm font-medium text-white">{title}</h3>
                </div>
            )}
            <div className="p-4">{children}</div>
        </div>
    );
}

function CategoryIcon({ category }: { category: string }) {
    const iconMap: Record<string, React.ReactNode> = {
        general: <Settings size={16} className="text-blue-400" />,
        api: <Key size={16} className="text-purple-400" />,
        trading: <Activity size={16} className="text-emerald-400" />,
        notification: <Bell size={16} className="text-amber-400" />,
        database: <Server size={16} className="text-cyan-400" />,
        redis: <Server size={16} className="text-red-400" />,
        auth: <Key size={16} className="text-indigo-400" />,
        security: <Key size={16} className="text-rose-400" />,
    };
    return iconMap[category] || <Settings size={16} className="text-gray-400" />;
}

function SettingRow({ 
    setting, 
    onUpdate, 
    onDelete, 
    isEditing, 
    editValue, 
    setEditValue, 
    setEditingKey 
}: { 
    setting: SystemSetting;
    onUpdate: (key: string, value: string) => void;
    onDelete: (key: string) => void;
    isEditing: boolean;
    editValue: string;
    setEditValue: (v: string) => void;
    setEditingKey: (k: string | null) => void;
}) {
    const [showValue, setShowValue] = useState(false);

    return (
        <div className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
            <CategoryIcon category={setting.category} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white">{setting.key}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-white/10 rounded text-blue-300">{setting.category}</span>
                    {setting.isSecret && <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 rounded text-amber-300">비밀</span>}
                </div>
                {setting.description && (
                    <p className="text-xs text-blue-300/70 mt-0.5">{setting.description}</p>
                )}
            </div>
            <div className="flex items-center gap-2">
                {isEditing ? (
                    <>
                        <input
                            type={setting.isSecret && !showValue ? 'password' : 'text'}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-40 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white"
                            placeholder="값 입력..."
                        />
                        {setting.isSecret && (
                            <button onClick={() => setShowValue(!showValue)} className="text-gray-400 hover:text-white">
                                {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                onUpdate(setting.key, editValue);
                                setEditingKey(null);
                            }}
                            className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                            저장
                        </button>
                        <button
                            onClick={() => setEditingKey(null)}
                            className="px-2 py-1 text-xs bg-white/10 text-white rounded hover:bg-white/20"
                        >
                            취소
                        </button>
                    </>
                ) : (
                    <>
                        <span className="text-xs text-blue-200 font-mono">
                            {setting.value || <span className="text-gray-500">미설정</span>}
                        </span>
                        <button
                            onClick={() => {
                                setEditingKey(setting.key);
                                setEditValue(setting.isSecret ? '' : (setting.value || ''));
                            }}
                            className="px-2 py-1 text-xs bg-white/10 text-white rounded hover:bg-white/20"
                        >
                            수정
                        </button>
                        <button
                            onClick={() => onDelete(setting.key)}
                            className="p-1 text-red-400 hover:text-red-300"
                        >
                            <Trash2 size={14} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function EnvVarRow({ envVar }: { envVar: EnvVariable }) {
    return (
        <div className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
            <CategoryIcon category={envVar.category} />
            <div className="flex-1 min-w-0">
                <span className="text-xs font-mono text-white">{envVar.key}</span>
            </div>
            <span className="text-xs text-blue-200 font-mono">
                {envVar.hasValue ? (envVar.isSecret ? '••••••••' : envVar.value) : <span className="text-red-400">미설정</span>}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${envVar.hasValue ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {envVar.hasValue ? '설정됨' : '미설정'}
            </span>
        </div>
    );
}

export default function AdminSettingsPage() {
    const { data: settings, mutate: mutateSettings } = useSWR<SystemSetting[]>('/api/admin/settings', fetcher);
    const { data: envStatus } = useSWR<EnvVariable[]>('/api/admin/env-status', fetcher);

    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '', category: 'general', isSecret: false });
    const [showAddForm, setShowAddForm] = useState(false);
    const [activeTab, setActiveTab] = useState<'settings' | 'env'>('settings');
    const [saving, setSaving] = useState(false);

    const handleUpdateSetting = async (key: string, value: string) => {
        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/settings/${key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({ value }),
            });
            mutateSettings();
        } catch (error) {
            console.error('Failed to update setting:', error);
            alert('설정 저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSetting = async (key: string) => {
        if (!confirm(`"${key}" 설정을 삭제하시겠습니까?`)) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/admin/settings/${key}`, {
                method: 'DELETE',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
            });
            mutateSettings();
        } catch (error) {
            console.error('Failed to delete setting:', error);
            alert('설정 삭제 실패');
        }
    };

    const handleAddSetting = async () => {
        if (!newSetting.key.trim()) {
            alert('키를 입력하세요');
            return;
        }

        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify({
                    settings: [newSetting]
                }),
            });
            mutateSettings();
            setNewSetting({ key: '', value: '', description: '', category: 'general', isSecret: false });
            setShowAddForm(false);
        } catch (error) {
            console.error('Failed to add setting:', error);
            alert('설정 추가 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleInitialize = async () => {
        if (!confirm('기본 설정을 초기화하시겠습니까? 기존 설정은 유지됩니다.')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch('/api/admin/settings/initialize', {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
            });
            mutateSettings();
        } catch (error) {
            console.error('Failed to initialize settings:', error);
            alert('초기화 실패');
        }
    };

    // Group settings by category
    const groupedSettings = settings?.reduce((acc, setting) => {
        const category = setting.category || 'general';
        if (!acc[category]) acc[category] = [];
        acc[category].push(setting);
        return acc;
    }, {} as Record<string, SystemSetting[]>) || {};

    // Group env vars by category
    const groupedEnvVars = envStatus?.reduce((acc, envVar) => {
        const category = envVar.category || 'general';
        if (!acc[category]) acc[category] = [];
        acc[category].push(envVar);
        return acc;
    }, {} as Record<string, EnvVariable[]>) || {};

    const categoryLabels: Record<string, string> = {
        general: '일반',
        api: 'API',
        trading: '거래',
        notification: '알림',
        database: '데이터베이스',
        redis: 'Redis',
        auth: '인증',
        security: '보안',
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white">설정 관리</h1>
                    <p className="text-xs text-blue-200 mt-0.5">시스템 설정 및 환경변수 관리</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleInitialize}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                    >
                        <RefreshCw size={14} />
                        기본값 초기화
                    </button>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
                    >
                        <Plus size={14} />
                        설정 추가
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activeTab === 'settings'
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                            : 'text-blue-200 hover:text-white hover:bg-white/10'
                    }`}
                >
                    시스템 설정
                </button>
                <button
                    onClick={() => setActiveTab('env')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activeTab === 'env'
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                            : 'text-blue-200 hover:text-white hover:bg-white/10'
                    }`}
                >
                    환경변수 상태
                </button>
            </div>

            {/* Add Setting Form */}
            {showAddForm && (
                <Card title="새 설정 추가" icon={<Plus size={16} className="text-blue-400" />}>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-300 mb-1">키</label>
                            <input
                                type="text"
                                value={newSetting.key}
                                onChange={(e) => setNewSetting({ ...newSetting, key: e.target.value.toUpperCase() })}
                                placeholder="SETTING_KEY"
                                className="w-full px-3 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-300 mb-1">값</label>
                            <input
                                type="text"
                                value={newSetting.value}
                                onChange={(e) => setNewSetting({ ...newSetting, value: e.target.value })}
                                placeholder="설정 값"
                                className="w-full px-3 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-300 mb-1">설명</label>
                            <input
                                type="text"
                                value={newSetting.description}
                                onChange={(e) => setNewSetting({ ...newSetting, description: e.target.value })}
                                placeholder="설정 설명"
                                className="w-full px-3 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-300 mb-1">카테고리</label>
                            <select
                                value={newSetting.category}
                                onChange={(e) => setNewSetting({ ...newSetting, category: e.target.value })}
                                className="w-full px-3 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white"
                            >
                                {Object.entries(categoryLabels).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <input
                                type="checkbox"
                                checked={newSetting.isSecret}
                                onChange={(e) => setNewSetting({ ...newSetting, isSecret: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <label className="text-xs text-gray-300">비밀 값 (마스킹 처리)</label>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleAddSetting}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                        >
                            <Save size={14} />
                            저장
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="px-4 py-1.5 text-xs bg-white/10 text-white rounded hover:bg-white/20"
                        >
                            취소
                        </button>
                    </div>
                </Card>
            )}

            {/* System Settings Tab */}
            {activeTab === 'settings' && (
                <div className="space-y-4">
                    {Object.keys(groupedSettings).length === 0 ? (
                        <Card>
                            <div className="text-center py-8">
                                <Settings size={40} className="mx-auto text-gray-500 mb-3" />
                                <p className="text-sm text-gray-400">설정이 없습니다</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    "기본값 초기화" 버튼을 클릭하거나 새 설정을 추가하세요
                                </p>
                            </div>
                        </Card>
                    ) : (
                        Object.entries(groupedSettings).map(([category, catSettings]) => (
                            <Card 
                                key={category}
                                title={categoryLabels[category] || category}
                                icon={<CategoryIcon category={category} />}
                            >
                                <div className="space-y-1">
                                    {catSettings.map((setting) => (
                                        <SettingRow
                                            key={setting.key}
                                            setting={setting}
                                            onUpdate={handleUpdateSetting}
                                            onDelete={handleDeleteSetting}
                                            isEditing={editingKey === setting.key}
                                            editValue={editValue}
                                            setEditValue={setEditValue}
                                            setEditingKey={setEditingKey}
                                        />
                                    ))}
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Environment Variables Tab */}
            {activeTab === 'env' && (
                <div className="space-y-4">
                    <div className="p-3 bg-amber-900/20 border border-amber-600/30 rounded-lg">
                        <p className="text-xs text-amber-200">
                            ⚠️ 환경변수는 <code className="bg-white/10 px-1 rounded">.env</code> 파일에서 직접 수정해야 합니다.
                            변경 후 서버를 재시작하세요.
                        </p>
                    </div>

                    {Object.entries(groupedEnvVars).map(([category, catEnvVars]) => (
                        <Card 
                            key={category}
                            title={categoryLabels[category] || category}
                            icon={<CategoryIcon category={category} />}
                        >
                            <div className="space-y-1">
                                {catEnvVars.map((envVar) => (
                                    <EnvVarRow key={envVar.key} envVar={envVar} />
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
