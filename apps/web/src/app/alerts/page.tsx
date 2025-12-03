'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import EditAlertModal from '@/components/EditAlertModal';
import { Bell, BellOff, Trash2, Edit } from 'lucide-react';

export default function AlertsPage() {
    const [loading, setLoading] = useState(true);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [alertToEdit, setAlertToEdit] = useState<any>(null);

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/alerts', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setAlerts(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말로 이 알림을 삭제하시겠습니까?')) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/alerts/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            fetchAlerts();
        } catch (error) {
            console.error('Failed to delete alert:', error);
        }
    };

    const getAlertTypeText = (type: string) => {
        const types: { [key: string]: string } = {
            'PRICE_CHANGE': '가격 변동',
            'INDICATOR_SIGNAL': '지표 시그널',
            'STRATEGY_SIGNAL': '전략 시그널',
            'NEWS_MENTION': '뉴스 언급',
        };
        return types[type] || type;
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="text-white text-xl">Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">알림설정</h2>
                    <p className="text-blue-200">가격 및 지표 알림 관리</p>
                </div>

                {alerts.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
                        <div className="text-6xl mb-4">🔔</div>
                        <h3 className="text-2xl font-bold text-white mb-2">알림이 없습니다</h3>
                        <p className="text-blue-300">가격 변동이나 지표 신호에 대한 알림을 설정하세요.</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {alerts.map((alert) => (
                            <div
                                key={alert.id}
                                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/15 transition"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-3">
                                        {alert.isActive ? (
                                            <Bell size={20} className="text-blue-400 mt-1" />
                                        ) : (
                                            <BellOff size={20} className="text-gray-400 mt-1" />
                                        )}
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-1">{alert.name}</h3>
                                            <p className="text-blue-300 text-sm">{alert.description}</p>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${alert.isActive
                                        ? 'bg-green-600/20 text-green-400'
                                        : 'bg-gray-600/20 text-gray-400'
                                        }`}>
                                        {alert.isActive ? '활성' : '비활성'}
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-xs font-semibold">
                                            {getAlertTypeText(alert.type)}
                                        </span>
                                    </div>

                                    {alert.stock && (
                                        <div className="text-white text-sm">
                                            종목: {alert.stock.name}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 text-sm text-blue-200">
                                        {alert.webPush && <span className="px-2 py-1 bg-white/10 rounded">웹푸시</span>}
                                        {alert.email && <span className="px-2 py-1 bg-white/10 rounded">이메일</span>}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-white/10">
                                    <button
                                        onClick={() => {
                                            setAlertToEdit(alert);
                                            setIsEditModalOpen(true);
                                        }}
                                        className="flex-1 px-4 py-2 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition flex items-center justify-center gap-2"
                                    >
                                        <Edit size={16} />
                                        수정
                                    </button>
                                    <button
                                        onClick={() => handleDelete(alert.id)}
                                        className="flex-1 px-4 py-2 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={16} />
                                        삭제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <EditAlertModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setAlertToEdit(null);
                }}
                onSuccess={() => {
                    fetchAlerts();
                    setIsEditModalOpen(false);
                    setAlertToEdit(null);
                }}
                alert={alertToEdit}
            />
        </DashboardLayout>
    );
}
