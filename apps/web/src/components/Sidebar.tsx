'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Briefcase, TrendingUp, Zap, BarChart3, Bell, Shield } from 'lucide-react';

const menuItems = [
    { name: '대시보드', path: '/dashboard', icon: Home },
    { name: '포트폴리오', path: '/portfolios', icon: Briefcase },
    { name: '거래내역', path: '/trades', icon: TrendingUp },
    { name: '전략관리', path: '/strategies', icon: Zap },
    { name: '종목분석', path: '/analysis', icon: BarChart3 },
    { name: '알림설정', path: '/alerts', icon: Bell },
    { name: '관리자', path: '/admin', icon: Shield },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-white/5 backdrop-blur-lg border-r border-white/10 h-screen sticky top-0">
            <div className="p-6">
                <Link href="/dashboard" className="flex items-center gap-2 mb-8">
                    <span className="text-2xl">📈</span>
                    <h1 className="text-xl font-bold text-white">StockBoom</h1>
                </Link>

                <nav className="space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <Icon size={20} />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}
