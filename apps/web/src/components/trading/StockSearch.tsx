'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, TrendingUp, TrendingDown } from 'lucide-react';

interface Stock {
    id: string;
    symbol: string;
    name: string;
    market: string;
    currentPrice?: number;
    changeRate?: number;
}

interface StockSearchProps {
    onSelect: (stock: Stock) => void;
    selectedSymbol?: string;
}

export default function StockSearch({ onSelect, selectedSymbol }: StockSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 디바운스 검색
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`, {
                    headers: getAuthHeader(),
                });

                if (res.ok) {
                    const data = await res.json();
                    setResults(data.slice(0, 10)); // 최대 10개
                }
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (stock: Stock) => {
        setSelectedStock(stock);
        setQuery('');
        setIsOpen(false);
        onSelect(stock);
    };

    const handleClear = () => {
        setSelectedStock(null);
        setQuery('');
        inputRef.current?.focus();
    };

    const formatNumber = (num?: number) => {
        if (num === undefined) return '-';
        return new Intl.NumberFormat('ko-KR').format(num);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Selected Stock Display or Search Input */}
            {selectedStock ? (
                <div className="flex items-center gap-3 p-3 bg-white/10 border border-white/20 rounded-lg">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{selectedStock.name}</span>
                            <span className="text-gray-400 text-sm">{selectedStock.symbol}</span>
                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                                {selectedStock.market}
                            </span>
                        </div>
                        {selectedStock.currentPrice && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-white font-medium">
                                    ₩{formatNumber(selectedStock.currentPrice)}
                                </span>
                                {selectedStock.changeRate !== undefined && (
                                    <span className={`text-sm flex items-center gap-1 ${
                                        selectedStock.changeRate >= 0 ? 'text-red-400' : 'text-blue-400'
                                    }`}>
                                        {selectedStock.changeRate >= 0 ? (
                                            <TrendingUp size={14} />
                                        ) : (
                                            <TrendingDown size={14} />
                                        )}
                                        {selectedStock.changeRate >= 0 ? '+' : ''}{selectedStock.changeRate.toFixed(2)}%
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleClear}
                        className="p-2 hover:bg-white/10 rounded-lg transition"
                    >
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder="종목명 또는 종목코드 검색..."
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    {loading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                        </div>
                    )}
                </div>
            )}

            {/* Search Results Dropdown */}
            {isOpen && query && results.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-gray-900 border border-white/20 rounded-lg shadow-xl overflow-hidden">
                    {results.map((stock) => (
                        <button
                            key={stock.id}
                            onClick={() => handleSelect(stock)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition text-left"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">{stock.name}</span>
                                    <span className="text-gray-400 text-sm">{stock.symbol}</span>
                                </div>
                                <span className="text-xs text-gray-500">{stock.market}</span>
                            </div>
                            {stock.currentPrice && (
                                <span className="text-white font-medium">
                                    ₩{formatNumber(stock.currentPrice)}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* No Results */}
            {isOpen && query && !loading && results.length === 0 && (
                <div className="absolute z-50 w-full mt-2 bg-gray-900 border border-white/20 rounded-lg p-4 text-center">
                    <p className="text-gray-400">검색 결과가 없습니다</p>
                </div>
            )}
        </div>
    );
}
