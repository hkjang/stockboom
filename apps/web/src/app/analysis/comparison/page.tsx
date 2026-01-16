'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';

interface Stock {
    id: string;
    symbol: string;
    name: string;
    corpName?: string;
}

interface FinancialSummary {
    id: string;
    bizYear: string;
    quarter: string;
    totalAssets?: number;
    totalLiabilities?: number;
    totalEquity?: number;
    revenue?: number;
    operatingProfit?: number;
    netIncome?: number;
    eps?: number;
    bps?: number;
}

interface CompanyFinancials {
    stock: Stock;
    financials: FinancialSummary[];
}

export default function FinancialComparisonPage() {
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
    const [comparisonData, setComparisonData] = useState<CompanyFinancials[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Stock[]>([]);

    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // Search stocks
    useEffect(() => {
        const searchStocks = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }

            try {
                const res = await fetch(`/api/admin/stocks?search=${searchQuery}&take=10`, {
                    headers: getAuthHeader(),
                });
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.stocks || data);
                }
            } catch (error) {
                console.error('Search failed:', error);
            }
        };

        const debounce = setTimeout(searchStocks, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    // Fetch financial data for selected stocks
    const fetchComparisonData = async () => {
        if (selectedStocks.length === 0) return;

        setLoading(true);
        try {
            const results: CompanyFinancials[] = [];

            for (const stockId of selectedStocks) {
                const stock = stocks.find(s => s.id === stockId);
                if (!stock) continue;

                const res = await fetch(`/api/admin/stocks/${stockId}/financials`, {
                    headers: getAuthHeader(),
                });

                if (res.ok) {
                    const financials = await res.json();
                    results.push({ stock, financials });
                }
            }

            setComparisonData(results);
        } catch (error) {
            console.error('Failed to fetch comparison data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedStocks.length > 0) {
            fetchComparisonData();
        }
    }, [selectedStocks]);

    const addStock = (stock: Stock) => {
        if (!stocks.find(s => s.id === stock.id)) {
            setStocks(prev => [...prev, stock]);
        }
        if (!selectedStocks.includes(stock.id)) {
            setSelectedStocks(prev => [...prev, stock.id]);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeStock = (stockId: string) => {
        setSelectedStocks(prev => prev.filter(id => id !== stockId));
        setComparisonData(prev => prev.filter(d => d.stock.id !== stockId));
    };

    const formatNumber = (num?: number | null) => {
        if (num === null || num === undefined) return '-';
        if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(1) + '조';
        if (Math.abs(num) >= 1e8) return (num / 1e8).toFixed(1) + '억';
        if (Math.abs(num) >= 1e4) return (num / 1e4).toFixed(1) + '만';
        return new Intl.NumberFormat('ko-KR').format(num);
    };

    const getLatestFinancials = (company: CompanyFinancials) => {
        if (company.financials.length === 0) return null;
        return company.financials.sort((a, b) => {
            if (a.bizYear !== b.bizYear) return b.bizYear.localeCompare(a.bizYear);
            return b.quarter.localeCompare(a.quarter);
        })[0];
    };

    // Calculate metrics
    const calculateROE = (fin: FinancialSummary | null) => {
        if (!fin?.netIncome || !fin?.totalEquity) return null;
        return ((fin.netIncome / fin.totalEquity) * 100).toFixed(2);
    };

    const calculateDebtRatio = (fin: FinancialSummary | null) => {
        if (!fin?.totalLiabilities || !fin?.totalAssets) return null;
        return ((fin.totalLiabilities / fin.totalAssets) * 100).toFixed(2);
    };

    const calculateOperatingMargin = (fin: FinancialSummary | null) => {
        if (!fin?.operatingProfit || !fin?.revenue) return null;
        return ((fin.operatingProfit / fin.revenue) * 100).toFixed(2);
    };

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">📊 재무 비교 분석</h1>
                    <p className="text-blue-200 mt-1">여러 기업의 재무 지표를 비교 분석합니다</p>
                </div>

                {/* Stock Search & Selection */}
                <Card className="bg-gray-800/50 border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">기업 선택</h3>
                    
                    {/* Search Input */}
                    <div className="relative mb-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="기업명 또는 종목코드 검색..."
                            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                        />
                        
                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                                {searchResults.map((stock) => (
                                    <button
                                        key={stock.id}
                                        onClick={() => addStock(stock)}
                                        className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex justify-between items-center"
                                    >
                                        <span>{stock.corpName || stock.name}</span>
                                        <span className="text-gray-400 text-sm">{stock.symbol}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Stocks */}
                    <div className="flex flex-wrap gap-2">
                        {stocks.filter(s => selectedStocks.includes(s.id)).map((stock) => (
                            <span
                                key={stock.id}
                                className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/30 border border-blue-500/50 rounded-full text-blue-300"
                            >
                                {stock.corpName || stock.name} ({stock.symbol})
                                <button
                                    onClick={() => removeStock(stock.id)}
                                    className="text-blue-400 hover:text-red-400"
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                        {selectedStocks.length === 0 && (
                            <p className="text-gray-500">비교할 기업을 검색하여 추가하세요</p>
                        )}
                    </div>
                </Card>

                {/* Comparison Table */}
                {loading ? (
                    <Card className="bg-gray-800/50 border-gray-700 p-6">
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                            <span className="ml-3 text-gray-400">데이터 불러오는 중...</span>
                        </div>
                    </Card>
                ) : comparisonData.length > 0 ? (
                    <Card className="bg-gray-800/50 border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">재무 지표 비교</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="px-4 py-3 text-left text-gray-400">지표</th>
                                        {comparisonData.map((company) => (
                                            <th key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {company.stock.corpName || company.stock.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">결산기</td>
                                        {comparisonData.map((company) => {
                                            const fin = getLatestFinancials(company);
                                            return (
                                                <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                    {fin ? `${fin.bizYear} ${fin.quarter}` : '-'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">자산총계</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {formatNumber(getLatestFinancials(company)?.totalAssets)}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">부채총계</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {formatNumber(getLatestFinancials(company)?.totalLiabilities)}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">자본총계</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {formatNumber(getLatestFinancials(company)?.totalEquity)}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50 bg-blue-900/20">
                                        <td className="px-4 py-3 text-gray-400 font-medium">부채비율 (%)</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white font-medium">
                                                {calculateDebtRatio(getLatestFinancials(company)) || '-'}%
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">매출액</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {formatNumber(getLatestFinancials(company)?.revenue)}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">영업이익</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {formatNumber(getLatestFinancials(company)?.operatingProfit)}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50 bg-green-900/20">
                                        <td className="px-4 py-3 text-gray-400 font-medium">영업이익률 (%)</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white font-medium">
                                                {calculateOperatingMargin(getLatestFinancials(company)) || '-'}%
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">당기순이익</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {formatNumber(getLatestFinancials(company)?.netIncome)}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50 bg-purple-900/20">
                                        <td className="px-4 py-3 text-gray-400 font-medium">ROE (%)</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white font-medium">
                                                {calculateROE(getLatestFinancials(company)) || '-'}%
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">EPS (원)</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {formatNumber(getLatestFinancials(company)?.eps)}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-700/50">
                                        <td className="px-4 py-3 text-gray-400">BPS (원)</td>
                                        {comparisonData.map((company) => (
                                            <td key={company.stock.id} className="px-4 py-3 text-right text-white">
                                                {formatNumber(getLatestFinancials(company)?.bps)}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : selectedStocks.length > 0 ? (
                    <Card className="bg-gray-800/50 border-gray-700 p-6">
                        <p className="text-center text-gray-400 py-8">
                            재무 데이터가 없습니다. 데이터 수집 페이지에서 "재무요약"을 먼저 수집해주세요.
                        </p>
                    </Card>
                ) : null}

                {/* Info Card */}
                <Card className="bg-gray-800/50 border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">💡 사용 안내</h3>
                    <ul className="text-gray-400 text-sm space-y-2">
                        <li>• 비교할 기업을 검색하여 추가하세요 (최대 5개 권장)</li>
                        <li>• 재무 데이터가 없는 경우 관리자 페이지에서 "재무요약" 수집이 필요합니다</li>
                        <li>• 부채비율, 영업이익률, ROE 등 주요 재무지표를 자동 계산합니다</li>
                    </ul>
                </Card>
            </div>
        </DashboardLayout>
    );
}
