'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const navigation = [
        { name: '대시보드', href: '/admin', icon: '📊' },
        { name: '사용자', href: '/admin/users', icon: '👥' },
        { name: '종목', href: '/admin/stocks', icon: '📈' },
        { name: '데이터 수집', href: '/admin/data-collection', icon: '💾' },
        { name: '데이터 소스', href: '/admin/data-sources', icon: '🔌' },
        { name: '모니터링', href: '/admin/monitoring', icon: '🖥️' },
        { name: '큐', href: '/admin/queues', icon: '📋' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-sm">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">⚙️</span>
                            <h1 className="text-base font-semibold text-white">관리자</h1>
                        </div>
                        <Link
                            href="/dashboard"
                            className="px-3 py-1.5 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                        >
                            ← 대시보드
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex gap-4">
                    {/* Sidebar */}
                    <aside className="w-48 flex-shrink-0">
                        <nav className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-2 space-y-0.5 sticky top-14">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href ||
                                    (item.href !== '/admin' && pathname.startsWith(item.href));
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${isActive
                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-600/20'
                                            : 'text-blue-200 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <span className="mr-2 text-sm">{item.icon}</span>
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
