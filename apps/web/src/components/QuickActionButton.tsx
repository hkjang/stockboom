'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, 
    TrendingUp, 
    Zap, 
    Target, 
    PieChart,
    X
} from 'lucide-react';

interface QuickAction {
    id: string;
    icon: any;
    label: string;
    color: string;
    path?: string;
    action?: () => void;
}

const quickActions: QuickAction[] = [
    {
        id: 'new-order',
        icon: TrendingUp,
        label: '빠른 주문',
        color: 'bg-green-500 hover:bg-green-600',
        path: '/trading',
    },
    {
        id: 'new-strategy',
        icon: Zap,
        label: '새 전략',
        color: 'bg-purple-500 hover:bg-purple-600',
        path: '/strategies?new=true',
    },
    {
        id: 'add-watchlist',
        icon: Target,
        label: '종목 추가',
        color: 'bg-blue-500 hover:bg-blue-600',
        path: '/watchlist',
    },
    {
        id: 'portfolio',
        icon: PieChart,
        label: '포트폴리오',
        color: 'bg-orange-500 hover:bg-orange-600',
        path: '/portfolios',
    },
];

export default function QuickActionButton() {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    const handleAction = (action: QuickAction) => {
        if (action.path) {
            router.push(action.path);
        } else if (action.action) {
            action.action();
        }
        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center 
                           transition-all duration-300 ${
                    isOpen 
                        ? 'bg-red-500 hover:bg-red-600 rotate-45' 
                        : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                }`}
            >
                {isOpen ? (
                    <X size={24} className="text-white" />
                ) : (
                    <Plus size={24} className="text-white" />
                )}
            </button>

            {/* Quick Actions Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Actions */}
                    <div className="absolute bottom-16 right-0 z-50 flex flex-col gap-2 items-end">
                        {quickActions.map((action, index) => (
                            <button
                                key={action.id}
                                onClick={() => handleAction(action)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-white 
                                           shadow-lg transition-all duration-200 
                                           animate-in slide-in-from-bottom-2 ${action.color}`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <action.icon size={18} />
                                <span className="text-sm font-medium whitespace-nowrap">
                                    {action.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
