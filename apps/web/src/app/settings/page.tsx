'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Settings, Key, Link2, Shield, Bell, User, HelpCircle } from 'lucide-react';
import { HelpModal, HelpButton, pageHelpContent } from '@/components/ui/HelpTooltip';
import { useState } from 'react';

const settingsMenu = [
    {
        title: 'API 키 설정',
        description: '한국투자증권 API 키를 관리합니다',
        href: '/settings/api-keys',
        icon: Key,
        color: 'bg-blue-500',
    },
    {
        title: '증권사 연동',
        description: '증권사 계좌 연동 및 토큰 관리',
        href: '/settings/broker',
        icon: Link2,
        color: 'bg-green-500',
    },
];

export default function SettingsPage() {
    const router = useRouter();
    const [showHelp, setShowHelp] = useState(false);

    return (
        <DashboardLayout>
            {/* Help Modal */}
            <HelpModal
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                title="설정 가이드"
                sections={[
                    {
                        heading: 'API 키 설정',
                        content: '한국투자증권에서 발급받은 API 키를 등록해야 자동매매가 가능해요.',
                        tips: ['API 키는 절대 타인과 공유하지 마세요', '모의투자용과 실전투자용 키가 다릅니다']
                    },
                    {
                        heading: '증권사 연동',
                        content: '증권사 계좌를 연동하면 잔고 조회, 주문 체결이 가능해요.',
                        tips: ['처음에는 모의투자 계좌로 테스트하세요', '토큰은 24시간마다 갱신됩니다']
                    },
                ]}
            />

            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Settings className="text-blue-400" size={32} />
                            설정
                        </h2>
                        <p className="text-blue-200">계정 및 시스템 설정을 관리합니다</p>
                    </div>
                    <HelpButton onClick={() => setShowHelp(true)} />
                </div>

                {/* Settings Menu Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                    {settingsMenu.map((item) => (
                        <button
                            key={item.href}
                            onClick={() => router.push(item.href)}
                            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 
                                       hover:bg-white/20 hover:border-blue-400/50 transition-all duration-200
                                       text-left group"
                        >
                            <div className="flex items-start gap-4">
                                <div className={`${item.color} p-3 rounded-lg group-hover:scale-110 transition`}>
                                    <item.icon size={24} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-2">
                                        {item.title}
                                    </h3>
                                    <p className="text-blue-200 text-sm">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Info Section */}
                <div className="mt-12 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Shield size={20} className="text-green-400" />
                        보안 안내
                    </h3>
                    <ul className="space-y-2 text-blue-200 text-sm">
                        <li>• API 키와 비밀키는 암호화되어 저장됩니다.</li>
                        <li>• 모의투자 환경에서 충분히 테스트 후 실전투자를 진행하세요.</li>
                        <li>• 자동매매 전략은 항상 손절 설정을 권장합니다.</li>
                    </ul>
                </div>
            </div>
        </DashboardLayout>
    );
}
