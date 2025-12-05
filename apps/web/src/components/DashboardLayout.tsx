'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/auth/login');
            return;
        }

        fetchUser(token);
    }, []);

    const fetchUser = async (token: string) => {
        try {
            const res = await fetch('/api/auth/profile', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                localStorage.removeItem('token');
                router.push('/auth/login');
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Top Navigation Bar */}
                <nav className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-10">
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-end gap-4">
                            <NotificationBell />
                            <span className="text-blue-200">{user?.email}</span>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-600/20 text-red-200 rounded-lg hover:bg-red-600/30 transition"
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
