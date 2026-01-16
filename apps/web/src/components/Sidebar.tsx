'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Briefcase, Star, TrendingUp, Zap, BarChart3, Bell, Shield, FileSearch, Scale } from 'lucide-react';

const menuItems = [
    { name: '대시보드', path: '/dashboard', icon: Home },
    { name: '포트폴리오', path: '/portfolios', icon: Briefcase },
    { name: '관심종목', path: '/watchlist', icon: Star },
    { name: '거래내역', path: '/trades', icon: TrendingUp },
    { name: '전략관리', path: '/strategies', icon: Zap },
    { name: '종목분석', path: '/analysis', icon: BarChart3 },
    { name: '재무비교', path: '/analysis/comparison', icon: Scale },
    { name: '공시검색', path: '/analysis/disclosures', icon: FileSearch },
    { name: '알림설정', path: '/alerts', icon: Bell },
];

export default function Sidebar() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/analysis') return pathname === '/analysis';
        return pathname === path || pathname?.startsWith(path + '/');
    };

    return (
        <aside className="w-64 bg-white/5 backdrop-blur-lg border-r border-white/10 h-screen sticky top-0 overflow-y-auto">
            <div className="p-6">
                <Link href="/dashboard" className="flex items-center gap-2 mb-8">
                    <span className="text-2xl">📈</span>
                    <h1 className="text-xl font-bold text-white">StockBoom</h1>
                </Link>

                {/* Main Menu */}
                <nav className="space-y-1">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm ${active
                                    ? 'bg-blue-600 text-white'
                                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <Icon size={18} />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Admin Link */}
                <div className="mt-6 pt-6 border-t border-white/10">
                    <Link
                        href="/admin"
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm ${pathname?.startsWith('/admin')
                            ? 'bg-purple-600 text-white'
                            : 'text-purple-300 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <Shield size={18} />
                        <span>관리자</span>
                    </Link>
                </div>
            </div>
        </aside>
    );
}
