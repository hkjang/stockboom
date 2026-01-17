'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Clock, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
    type: 'stock' | 'page' | 'action';
    title: string;
    subtitle?: string;
    path?: string;
    action?: () => void;
}

const quickLinks: SearchResult[] = [
    { type: 'page', title: '대시보드', subtitle: '홈 화면', path: '/dashboard' },
    { type: 'page', title: '실시간 매매', subtitle: '트레이딩', path: '/trading' },
    { type: 'page', title: '포트폴리오', subtitle: '자산 관리', path: '/portfolios' },
    { type: 'page', title: '전략 관리', subtitle: '자동매매 전략', path: '/strategies' },
    { type: 'action', title: '새 전략 만들기', subtitle: '자동매매 전략 추가', path: '/strategies?new=true' },
    { type: 'action', title: '종목 분석', subtitle: '기술적 분석', path: '/analysis' },
];

const recentSearches = [
    { title: '삼성전자', path: '/stocks/005930' },
    { title: 'SK하이닉스', path: '/stocks/000660' },
    { title: 'NAVER', path: '/stocks/035420' },
];

export default function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Keyboard shortcut (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Search logic
    useEffect(() => {
        if (!query.trim()) {
            setResults(quickLinks);
            return;
        }

        const filtered = quickLinks.filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.subtitle?.toLowerCase().includes(query.toLowerCase())
        );

        // Add stock search (mock)
        if (query.length >= 2) {
            filtered.unshift({
                type: 'stock',
                title: query.toUpperCase(),
                subtitle: '종목 검색',
                path: `/stocks/${query}`,
            });
        }

        setResults(filtered);
        setSelectedIndex(0);
    }, [query]);

    const handleKeyNavigation = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    const handleSelect = (result: SearchResult) => {
        if (result.path) {
            router.push(result.path);
        } else if (result.action) {
            result.action();
        }
        setIsOpen(false);
        setQuery('');
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 
                           hover:bg-white/10 transition text-sm text-blue-300"
            >
                <Search size={16} />
                <span className="hidden sm:inline">검색</span>
                <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-white/10 rounded text-gray-400">
                    ⌘K
                </kbd>
            </button>
        );
    }

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setIsOpen(false)}
            />

            {/* Search Modal */}
            <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4">
                <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
                        <Search size={20} className="text-blue-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyNavigation}
                            placeholder="종목명, 페이지, 기능 검색..."
                            className="flex-1 bg-transparent text-white text-lg placeholder-gray-500 
                                       outline-none"
                        />
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-white/10 rounded-lg transition"
                        >
                            <X size={18} className="text-gray-400" />
                        </button>
                    </div>

                    {/* Results */}
                    <div className="max-h-80 overflow-y-auto py-2">
                        {/* Recent Searches */}
                        {!query && recentSearches.length > 0 && (
                            <div className="px-4 py-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase">
                                    최근 검색
                                </span>
                                <div className="mt-2 space-y-1">
                                    {recentSearches.map((item, index) => (
                                        <button
                                            key={index}
                                            onClick={() => router.push(item.path)}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg 
                                                       hover:bg-white/10 text-left transition"
                                        >
                                            <Clock size={14} className="text-gray-500" />
                                            <span className="text-sm text-blue-200">{item.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Links / Results */}
                        <div className="px-4 py-2">
                            {!query && (
                                <span className="text-xs font-semibold text-gray-500 uppercase">
                                    빠른 이동
                                </span>
                            )}
                            <div className="mt-2 space-y-1">
                                {results.map((result, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleSelect(result)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg 
                                                   text-left transition ${
                                            index === selectedIndex 
                                                ? 'bg-blue-600/30 border border-blue-500/30' 
                                                : 'hover:bg-white/10'
                                        }`}
                                    >
                                        {result.type === 'stock' && (
                                            <TrendingUp size={16} className="text-green-400" />
                                        )}
                                        {result.type === 'page' && (
                                            <ArrowRight size={16} className="text-blue-400" />
                                        )}
                                        {result.type === 'action' && (
                                            <span className="text-purple-400">⚡</span>
                                        )}
                                        <div>
                                            <p className="text-sm text-white font-medium">{result.title}</p>
                                            {result.subtitle && (
                                                <p className="text-xs text-gray-500">{result.subtitle}</p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 
                                    text-[10px] text-gray-500">
                        <div className="flex items-center gap-4">
                            <span><kbd className="px-1 py-0.5 bg-white/10 rounded">↑↓</kbd> 이동</span>
                            <span><kbd className="px-1 py-0.5 bg-white/10 rounded">Enter</kbd> 선택</span>
                            <span><kbd className="px-1 py-0.5 bg-white/10 rounded">Esc</kbd> 닫기</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
