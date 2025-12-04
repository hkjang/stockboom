'use client';

import { useState } from 'react';
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
        { name: '사용자 관리', href: '/admin/users', icon: '👥' },
        { name: '종목 관리', href: '/admin/stocks', icon: '📈' },
        { name: '데이터 수집', href: '/admin/data-collection', icon: '💾' },
        { name: '데이터 소스', href: '/admin/data-sources', icon: '🔌' },
        { name: '시스템 모니터링', href: '/admin/monitoring', icon: '🖥️' },
        { name: '큐 관리', href: '/admin/queues', icon: '📋' },
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-gray-900">관리자 패널</h1>
                        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
                            ← 사용자 대시보드로
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex gap-6">
                    {/* Sidebar */}
                    <aside className="w-64 flex-shrink-0">
                        <nav className="bg-white rounded-lg shadow p-4 space-y-1">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="mr-3 text-xl">{item.icon}</span>
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
