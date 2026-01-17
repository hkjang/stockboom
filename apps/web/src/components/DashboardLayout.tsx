'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import MarketStatusIndicator from './MarketStatusIndicator';
import GlobalSearch from './GlobalSearch';
import QuickActionButton from './QuickActionButton';
import { User, LogOut, Settings, ChevronDown, HelpCircle, CreditCard, Menu, X } from 'lucide-react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/auth/login');
            return;
        }

        fetchUser(token);
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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

    const userMenuItems = [
        { icon: User, label: '프로필', href: '/profile' },
        { icon: Settings, label: '설정', href: '/settings' },
        { icon: CreditCard, label: '증권사 연동', href: '/settings/broker' },
        { icon: HelpCircle, label: '도움말', href: '/help' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
                <Sidebar />
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <div className="absolute left-0 top-0 h-full">
                        <Sidebar />
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col min-h-screen">
                {/* Top Navigation Bar */}
                <nav className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-20">
                    <div className="px-4 lg:px-6 py-3">
                        <div className="flex items-center justify-between gap-4">
                            {/* Left side */}
                            <div className="flex items-center gap-4">
                                {/* Mobile Menu Button */}
                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition"
                                >
                                    {isMobileMenuOpen ? (
                                        <X size={20} className="text-white" />
                                    ) : (
                                        <Menu size={20} className="text-white" />
                                    )}
                                </button>

                                {/* Market Status (Desktop) */}
                                <div className="hidden md:block">
                                    <MarketStatusIndicator />
                                </div>
                            </div>

                            {/* Right side */}
                            <div className="flex items-center gap-2 sm:gap-3">
                                {/* Global Search */}
                                <GlobalSearch />

                                {/* Notification Bell */}
                                <NotificationBell />

                                {/* User Menu */}
                                <div className="relative" ref={menuRef}>
                                    <button
                                        onClick={() => setShowUserMenu(!showUserMenu)}
                                        className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-white/5 
                                                   hover:bg-white/10 transition-all duration-200 border border-white/10"
                                    >
                                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full 
                                                        flex items-center justify-center text-white font-semibold text-sm">
                                            {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <span className="hidden sm:inline text-sm text-white font-medium max-w-[100px] truncate">
                                            {user?.name || user?.email?.split('@')[0] || '사용자'}
                                        </span>
                                        <ChevronDown 
                                            size={16} 
                                            className={`hidden sm:block text-blue-300 transition-transform duration-200 ${
                                                showUserMenu ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {showUserMenu && (
                                        <div className="absolute right-0 mt-2 w-56 bg-slate-800/95 backdrop-blur-lg 
                                                        rounded-xl border border-white/10 shadow-xl overflow-hidden
                                                        animate-in fade-in slide-in-from-top-2 duration-200">
                                            {/* User Info Header */}
                                            <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                                                <p className="text-sm font-medium text-white truncate">
                                                    {user?.name || '사용자'}
                                                </p>
                                                <p className="text-xs text-blue-300 truncate">
                                                    {user?.email}
                                                </p>
                                            </div>

                                            {/* Menu Items */}
                                            <div className="py-2">
                                                {userMenuItems.map((item) => (
                                                    <button
                                                        key={item.label}
                                                        onClick={() => {
                                                            router.push(item.href);
                                                            setShowUserMenu(false);
                                                        }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm 
                                                                   text-blue-200 hover:bg-white/10 hover:text-white 
                                                                   transition-colors"
                                                    >
                                                        <item.icon size={16} />
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Logout */}
                                            <div className="border-t border-white/10 py-2">
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm 
                                                               text-red-400 hover:bg-red-500/10 hover:text-red-300 
                                                               transition-colors"
                                                >
                                                    <LogOut size={16} />
                                                    로그아웃
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Market Status */}
                    <div className="md:hidden px-4 pb-3">
                        <MarketStatusIndicator />
                    </div>
                </nav>

                {/* Main Content */}
                <main className="flex-1 overflow-auto relative">
                    {children}

                    {/* Floating Action Button */}
                    <div className="fixed bottom-6 right-6 z-30">
                        <QuickActionButton />
                    </div>
                </main>
            </div>
        </div>
    );
}
