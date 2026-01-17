'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    Home, 
    Briefcase, 
    Star, 
    TrendingUp, 
    Zap, 
    BarChart3, 
    Bell, 
    Shield, 
    FileSearch, 
    Scale, 
    Activity, 
    Settings,
    Target,
    PieChart,
    LineChart,
    Cpu,
    HelpCircle,
    ChevronRight
} from 'lucide-react';

interface MenuItem {
    name: string;
    path: string;
    icon: any;
    badge?: string;
}

interface MenuGroup {
    title: string;
    items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
    {
        title: '홈',
        items: [
            { name: '대시보드', path: '/dashboard', icon: Home },
        ],
    },
    {
        title: '트레이딩',
        items: [
            { name: '실시간 매매', path: '/trading', icon: Activity, badge: 'LIVE' },
            { name: '거래내역', path: '/trades', icon: TrendingUp },
            { name: '포트폴리오', path: '/portfolios', icon: Briefcase },
            { name: '관심종목', path: '/watchlist', icon: Star },
        ],
    },
    {
        title: '전략 & 분석',
        items: [
            { name: '전략관리', path: '/strategies', icon: Zap },
            { name: '종목분석', path: '/analysis', icon: BarChart3 },
            { name: '재무비교', path: '/analysis/comparison', icon: Scale },
            { name: '공시검색', path: '/analysis/disclosures', icon: FileSearch },
        ],
    },
    {
        title: '설정',
        items: [
            { name: '알림설정', path: '/alerts', icon: Bell },
            { name: '설정', path: '/settings', icon: Settings },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/analysis') return pathname === '/analysis';
        if (path === '/settings') return pathname === '/settings';
        return pathname === path || pathname?.startsWith(path + '/');
    };

    return (
        <aside className="w-64 bg-white/5 backdrop-blur-lg border-r border-white/10 h-screen sticky top-0 flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <TrendingUp className="text-white" size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">StockBoom</h1>
                        <span className="text-xs text-blue-300">자동매매 시스템</span>
                    </div>
                </Link>
            </div>

            {/* Menu Groups */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                {menuGroups.map((group) => (
                    <div key={group.title}>
                        <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 px-3">
                            {group.title}
                        </h3>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);

                                return (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                                            active
                                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25'
                                                : 'text-blue-200 hover:bg-white/10 hover:text-white'
                                        }`}
                                    >
                                        <Icon size={18} className={active ? 'text-white' : 'text-blue-400 group-hover:text-white'} />
                                        <span className="flex-1 text-sm font-medium">{item.name}</span>
                                        {item.badge && (
                                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                active ? 'bg-white/20 text-white' : 'bg-green-500/20 text-green-400'
                                            }`}>
                                                {item.badge}
                                            </span>
                                        )}
                                        {active && (
                                            <ChevronRight size={14} className="text-white/70" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Bottom Section */}
            <div className="p-4 border-t border-white/10 space-y-2">
                {/* Admin Link */}
                <Link
                    href="/admin"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                        pathname?.startsWith('/admin')
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/25'
                            : 'text-purple-300 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    <Shield size={18} />
                    <span className="text-sm font-medium">관리자 콘솔</span>
                </Link>

                {/* Help Link */}
                <Link
                    href="/help"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                        pathname === '/help'
                            ? 'bg-white/10 text-white'
                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    <HelpCircle size={18} />
                    <span className="text-sm font-medium">도움말</span>
                </Link>

                {/* Version Info */}
                <div className="px-3 py-2 text-xs text-gray-500">
                    v1.0.0 Expert Edition
                </div>
            </div>
        </aside>
    );
}
