'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { FinancialCharts } from '@/components/charts/FinancialCharts';

interface Stock {
    id: string;
    symbol: string;
    name: string;
    market: string;
    corpCode?: string;
    corpName?: string;
    ceoName?: string;
    address?: string;
    homePage?: string;
    indutyCode?: string;
    estDate?: string;
    currentPrice?: number;
    marketCap?: number;
}

interface Executive {
    id: string;
    name: string;
    position: string;
    isBoardMember: boolean;
    isAuditCommittee: boolean;
    gender?: string;
    experience?: string;
}

interface MajorShareholder {
    id: string;
    shareholderName: string;
    relation?: string;
    sharesOwned: string;
    shareRatio: number;
    isLargeHolder: boolean;
}

interface Dividend {
    id: string;
    fiscalYear: string;
    dividendType: string;
    cashDividend?: number;
    dividendYield?: number;
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

interface Employee {
    id: string;
    bizYear: string;
    maleCount: number;
    femaleCount: number;
    totalCount: number;
    avgSalary?: number;
}

type TabType = 'overview' | 'financials' | 'executives' | 'shareholders' | 'dividends';

export default function StockDetailPage() {
    const params = useParams();
    const symbol = params.symbol as string;

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [stock, setStock] = useState<Stock | null>(null);
    const [executives, setExecutives] = useState<Executive[]>([]);
    const [shareholders, setShareholders] = useState<MajorShareholder[]>([]);
    const [dividends, setDividends] = useState<Dividend[]>([]);
    const [financials, setFinancials] = useState<FinancialSummary[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [collecting, setCollecting] = useState(false);
    const [dataStatus, setDataStatus] = useState<{ dataStatus: any; counts: any } | null>(null);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    useEffect(() => {
        const fetchStockData = async () => {
            setLoading(true);
            try {
                // Fetch stock info
                const stockRes = await fetch(`/api/stocks/${symbol}`, {
                    headers: getAuthHeader(),
                });
                if (stockRes.ok) {
                    const data = await stockRes.json();
                    setStock(data);

                    // Fetch related data if we have stockId
                    if (data?.id) {
                        const stockId = data.id;
                        
                        // Fetch executives
                        const execRes = await fetch(`/api/admin/stocks/${stockId}/executives`, {
                            headers: getAuthHeader(),
                        });
                        if (execRes.ok) setExecutives(await execRes.json());

                        // Fetch shareholders
                        const shRes = await fetch(`/api/admin/stocks/${stockId}/major-shareholders`, {
                            headers: getAuthHeader(),
                        });
                        if (shRes.ok) setShareholders(await shRes.json());

                        // Fetch dividends
                        const divRes = await fetch(`/api/admin/stocks/${stockId}/dividends`, {
                            headers: getAuthHeader(),
                        });
                        if (divRes.ok) setDividends(await divRes.json());

                        // Fetch financials
                        const finRes = await fetch(`/api/admin/stocks/${stockId}/financials`, {
                            headers: getAuthHeader(),
                        });
                        if (finRes.ok) setFinancials(await finRes.json());

                        // Fetch employees
                        const empRes = await fetch(`/api/admin/stocks/${stockId}/employees`, {
                            headers: getAuthHeader(),
                        });
                        if (empRes.ok) setEmployees(await empRes.json());
                    }
                }
            } catch (error) {
                console.error('Failed to fetch stock data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (symbol) {
            fetchStockData();
        }
    }, [symbol]);

    const tabs: { key: TabType; label: string; icon: string }[] = [
        { key: 'overview', label: '기업개황', icon: '🏢' },
        { key: 'financials', label: '재무정보', icon: '📊' },
        { key: 'executives', label: '임원/이사', icon: '👔' },
        { key: 'shareholders', label: '주주현황', icon: '📈' },
        { key: 'dividends', label: '배당정보', icon: '💰' },
    ];

    const formatNumber = (num?: number | null) => {
        if (num === null || num === undefined) return '-';
        return new Intl.NumberFormat('ko-KR').format(num);
    };

    const formatCurrency = (num?: number | null) => {
        if (num === null || num === undefined) return '-';
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="container mx-auto px-6 py-8">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 bg-gray-800 rounded w-1/3"></div>
                        <div className="h-64 bg-gray-800 rounded"></div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!stock) {
        return (
            <DashboardLayout>
                <div className="container mx-auto px-6 py-8 text-center py-20">
                    <h1 className="text-2xl font-bold text-white mb-4">기업 정보를 찾을 수 없습니다</h1>
                    <p className="text-gray-400">종목코드: {symbol}</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            {stock.corpName || stock.name}
                            <span className="text-lg text-blue-300">({stock.symbol})</span>
                        </h1>
                        <p className="text-blue-200 mt-1">
                            {stock.market} · {stock.ceoName && `대표이사: ${stock.ceoName}`}
                        </p>
                    </div>
                    {stock.currentPrice && (
                        <div className="text-right">
                            <div className="text-3xl font-bold text-white">
                                {formatCurrency(stock.currentPrice)}
                            </div>
                            <div className="text-gray-400">현재가</div>
                        </div>
                    )}
                    <button
                        onClick={async () => {
                            if (!stock?.id) return;
                            setCollecting(true);
                            try {
                                const bizYear = (new Date().getFullYear() - 1).toString();
                                const res = await fetch(`/api/admin/stocks/${stock.id}/collect-all`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        ...getAuthHeader(),
                                    },
                                    body: JSON.stringify({ bizYear }),
                                });
                                if (res.ok) {
                                    const result = await res.json();
                                    alert(`데이터 수집 완료: ${result.totalCollected}건`);
                                    window.location.reload();
                                } else {
                                    alert('데이터 수집 실패');
                                }
                            } catch (error) {
                                console.error('Collection failed:', error);
                                alert('데이터 수집 중 오류가 발생했습니다');
                            } finally {
                                setCollecting(false);
                            }
                        }}
                        disabled={collecting}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {collecting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                수집 중...
                            </>
                        ) : (
                            <>📥 데이터 수집</>
                        )}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-gray-700 pb-2 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="bg-gray-800/50 border-gray-700 p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">기업 정보</h3>
                                <dl className="space-y-3">
                                    <div className="flex justify-between">
                                        <dt className="text-gray-400">법인명</dt>
                                        <dd className="text-white">{stock.corpName || '-'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-400">대표이사</dt>
                                        <dd className="text-white">{stock.ceoName || '-'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-400">업종코드</dt>
                                        <dd className="text-white">{stock.indutyCode || '-'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-400">설립일</dt>
                                        <dd className="text-white">{stock.estDate || '-'}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-400">홈페이지</dt>
                                        <dd className="text-blue-400">
                                            {stock.homePage ? (
                                                <a href={stock.homePage} target="_blank" rel="noopener noreferrer">
                                                    {stock.homePage}
                                                </a>
                                            ) : '-'}
                                        </dd>
                                    </div>
                                </dl>
                            </Card>

                            {employees.length > 0 && (
                                <Card className="bg-gray-800/50 border-gray-700 p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">직원 현황</h3>
                                    <dl className="space-y-3">
                                        <div className="flex justify-between">
                                            <dt className="text-gray-400">총 직원수</dt>
                                            <dd className="text-white">{formatNumber(employees[0]?.totalCount)}명</dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-gray-400">남성</dt>
                                            <dd className="text-white">{formatNumber(employees[0]?.maleCount)}명</dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-gray-400">여성</dt>
                                            <dd className="text-white">{formatNumber(employees[0]?.femaleCount)}명</dd>
                                        </div>
                                    </dl>
                                </Card>
                            )}
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6">
                            <Card className="bg-gray-800/50 border-gray-700 p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">📊 재무 차트</h3>
                                <FinancialCharts data={financials} />
                            </Card>
                            
                            <Card className="bg-gray-800/50 border-gray-700 p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">📝 재무 요약 테이블</h3>
                                {financials.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-700">
                                                    <th className="px-4 py-2 text-left text-gray-400">결산기</th>
                                                    <th className="px-4 py-2 text-right text-gray-400">자산총계</th>
                                                    <th className="px-4 py-2 text-right text-gray-400">부채총계</th>
                                                    <th className="px-4 py-2 text-right text-gray-400">매출액</th>
                                                    <th className="px-4 py-2 text-right text-gray-400">영업이익</th>
                                                    <th className="px-4 py-2 text-right text-gray-400">당기순이익</th>
                                                    <th className="px-4 py-2 text-right text-gray-400">EPS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {financials.map((fin) => (
                                                    <tr key={fin.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                                        <td className="px-4 py-3 text-white">{fin.bizYear} {fin.quarter}</td>
                                                        <td className="px-4 py-3 text-right text-white">{formatNumber(fin.totalAssets)}</td>
                                                        <td className="px-4 py-3 text-right text-white">{formatNumber(fin.totalLiabilities)}</td>
                                                        <td className="px-4 py-3 text-right text-white">{formatNumber(fin.revenue)}</td>
                                                        <td className="px-4 py-3 text-right text-white">{formatNumber(fin.operatingProfit)}</td>
                                                        <td className="px-4 py-3 text-right text-white">{formatNumber(fin.netIncome)}</td>
                                                        <td className="px-4 py-3 text-right text-white">{formatNumber(fin.eps)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-gray-400">재무 데이터가 없습니다. 데이터 수집에서 "재무요약"을 수집해주세요.</p>
                                )}
                            </Card>
                        </div>
                    )}

                    {activeTab === 'executives' && (
                        <Card className="bg-gray-800/50 border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">임원 현황</h3>
                            {executives.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-700">
                                                <th className="px-4 py-2 text-left text-gray-400">성명</th>
                                                <th className="px-4 py-2 text-left text-gray-400">직위</th>
                                                <th className="px-4 py-2 text-center text-gray-400">등기임원</th>
                                                <th className="px-4 py-2 text-center text-gray-400">감사위원</th>
                                                <th className="px-4 py-2 text-left text-gray-400">경력</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {executives.map((exec) => (
                                                <tr key={exec.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                                    <td className="px-4 py-3 text-white font-medium">{exec.name}</td>
                                                    <td className="px-4 py-3 text-white">{exec.position}</td>
                                                    <td className="px-4 py-3 text-center">{exec.isBoardMember ? '✅' : '-'}</td>
                                                    <td className="px-4 py-3 text-center">{exec.isAuditCommittee ? '✅' : '-'}</td>
                                                    <td className="px-4 py-3 text-gray-300 text-xs max-w-xs truncate">{exec.experience || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-400">임원 데이터가 없습니다. 데이터 수집에서 "임원 현황"을 수집해주세요.</p>
                            )}
                        </Card>
                    )}

                    {activeTab === 'shareholders' && (
                        <Card className="bg-gray-800/50 border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">주주 현황</h3>
                            {shareholders.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-700">
                                                <th className="px-4 py-2 text-left text-gray-400">주주명</th>
                                                <th className="px-4 py-2 text-left text-gray-400">관계</th>
                                                <th className="px-4 py-2 text-right text-gray-400">보유주식</th>
                                                <th className="px-4 py-2 text-right text-gray-400">지분율</th>
                                                <th className="px-4 py-2 text-center text-gray-400">대량보유</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shareholders.map((sh) => (
                                                <tr key={sh.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                                    <td className="px-4 py-3 text-white font-medium">{sh.shareholderName}</td>
                                                    <td className="px-4 py-3 text-white">{sh.relation || '-'}</td>
                                                    <td className="px-4 py-3 text-right text-white">{formatNumber(Number(sh.sharesOwned))}</td>
                                                    <td className="px-4 py-3 text-right text-white">{sh.shareRatio?.toFixed(2)}%</td>
                                                    <td className="px-4 py-3 text-center">{sh.isLargeHolder ? '✅' : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-400">주주 데이터가 없습니다. 데이터 수집에서 "최대주주 현황" 또는 "대량보유 상황"을 수집해주세요.</p>
                            )}
                        </Card>
                    )}

                    {activeTab === 'dividends' && (
                        <Card className="bg-gray-800/50 border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">배당 정보</h3>
                            {dividends.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-700">
                                                <th className="px-4 py-2 text-left text-gray-400">결산년도</th>
                                                <th className="px-4 py-2 text-left text-gray-400">배당종류</th>
                                                <th className="px-4 py-2 text-right text-gray-400">현금배당(원)</th>
                                                <th className="px-4 py-2 text-right text-gray-400">배당수익률(%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dividends.map((div) => (
                                                <tr key={div.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                                    <td className="px-4 py-3 text-white font-medium">{div.fiscalYear}</td>
                                                    <td className="px-4 py-3 text-white">{div.dividendType}</td>
                                                    <td className="px-4 py-3 text-right text-white">{formatNumber(div.cashDividend)}</td>
                                                    <td className="px-4 py-3 text-right text-white">{div.dividendYield?.toFixed(2) || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-400">배당 데이터가 없습니다. 데이터 수집에서 "배당 정보"를 수집해주세요.</p>
                            )}
                        </Card>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
