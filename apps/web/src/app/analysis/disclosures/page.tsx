'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';

interface Disclosure {
    corp_code: string;
    corp_name: string;
    stock_code?: string;
    corp_cls?: string;
    report_nm: string;
    rcept_no: string;
    flr_nm?: string;
    rcept_dt: string;
    rm?: string;
}

interface SearchParams {
    corpName: string;
    bgn_de: string;
    end_de: string;
    pblntf_ty?: string;
}

interface AIAnalysis {
    summary: string;
    overallSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    averageImpactScore: number;
    keyTrends?: string[];
    investmentImplication?: string;
    watchPoints?: string[];
}

export default function DisclosureSearchPage() {
    const [searchParams, setSearchParams] = useState<SearchParams>({
        corpName: '',
        bgn_de: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, ''),
        end_de: new Date().toISOString().split('T')[0].replace(/-/g, ''),
    });
    const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchedCorpCode, setSearchedCorpCode] = useState('');
    const [totalCount, setTotalCount] = useState(0);
    
    // AI Analysis states
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    const getAuthHeader = (): Record<string, string> => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const handleSearch = async () => {
        if (!searchParams.corpName.trim()) {
            alert('기업명을 입력해주세요');
            return;
        }

        setLoading(true);
        setAiAnalysis(null);
        try {
            // First, find corp_code from stock search
            const stockRes = await fetch(`/api/admin/stocks?search=${searchParams.corpName}&take=1`, {
                headers: getAuthHeader(),
            });

            if (!stockRes.ok) {
                throw new Error('기업 검색 실패');
            }

            const stockData = await stockRes.json();
            const stocks = stockData.stocks || stockData;
            
            if (!stocks || stocks.length === 0) {
                alert('검색된 기업이 없습니다. 먼저 기업코드를 동기화해주세요.');
                setLoading(false);
                return;
            }

            const corpCode = stocks[0].corpCode;
            if (!corpCode) {
                alert('해당 기업의 corpCode가 없습니다.');
                setLoading(false);
                return;
            }

            setSearchedCorpCode(corpCode);

            // Search disclosures using backend API
            const res = await fetch('/api/admin/data-collection/opendart/disclosures', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({
                    corpCode,
                    bgnDe: searchParams.bgn_de,
                    endDe: searchParams.end_de,
                    pblntfTy: searchParams.pblntf_ty || '',
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setDisclosures(data.list || []);
                setTotalCount(data.total_count || data.list?.length || 0);
            } else {
                throw new Error('공시 검색 실패');
            }
        } catch (error: any) {
            console.error('Search failed:', error);
            alert(error.message || '검색 중 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleAIAnalysis = async () => {
        if (disclosures.length === 0) {
            alert('분석할 공시가 없습니다. 먼저 검색을 수행해주세요.');
            return;
        }

        setAiLoading(true);
        try {
            const analysisData = disclosures.slice(0, 10).map(d => ({
                corpName: d.corp_name,
                reportTitle: d.report_nm,
                reportType: d.rm || '',
                rcptDt: d.rcept_dt,
            }));

            const res = await fetch('/api/ai/disclosures/analyze-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify(analysisData),
            });

            if (res.ok) {
                const data = await res.json();
                setAiAnalysis({
                    summary: data.summary,
                    overallSentiment: data.overallSentiment,
                    averageImpactScore: data.averageImpactScore,
                    keyTrends: data.analyses?.[0]?.keyTrends || [],
                    investmentImplication: data.analyses?.[0]?.investmentImplication || '',
                    watchPoints: data.analyses?.[0]?.watchPoints || [],
                });
            } else {
                const error = await res.json();
                throw new Error(error.message || 'AI 분석 실패');
            }
        } catch (error: any) {
            console.error('AI analysis failed:', error);
            alert(error.message || 'AI 분석 중 오류가 발생했습니다. OpenAI API가 설정되어 있는지 확인해주세요.');
        } finally {
            setAiLoading(false);
        }
    };

    const openDisclosure = (rceptNo: string) => {
        window.open(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`, '_blank');
    };

    const formatDate = (dateStr: string) => {
        if (dateStr.length === 8) {
            return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }
        return dateStr;
    };

    const disclosureTypes = [
        { value: '', label: '전체' },
        { value: 'A', label: '정기공시' },
        { value: 'B', label: '주요사항보고' },
        { value: 'C', label: '발행공시' },
        { value: 'D', label: '지분공시' },
        { value: 'E', label: '기타공시' },
        { value: 'F', label: '외부감사관련' },
        { value: 'G', label: '펀드공시' },
        { value: 'H', label: '자산유동화' },
        { value: 'I', label: '거래소공시' },
        { value: 'J', label: '공정위공시' },
    ];

    const getReportBadgeColor = (reportNm: string) => {
        if (reportNm.includes('사업보고서')) return 'bg-blue-600/30 text-blue-300 border-blue-500/50';
        if (reportNm.includes('반기보고서')) return 'bg-green-600/30 text-green-300 border-green-500/50';
        if (reportNm.includes('분기보고서')) return 'bg-yellow-600/30 text-yellow-300 border-yellow-500/50';
        if (reportNm.includes('주요사항')) return 'bg-red-600/30 text-red-300 border-red-500/50';
        if (reportNm.includes('지분')) return 'bg-purple-600/30 text-purple-300 border-purple-500/50';
        return 'bg-gray-600/30 text-gray-300 border-gray-500/50';
    };

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'POSITIVE': return 'text-green-400';
            case 'NEGATIVE': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getSentimentBadge = (sentiment: string) => {
        switch (sentiment) {
            case 'POSITIVE': return 'bg-green-600/30 text-green-300 border-green-500/50';
            case 'NEGATIVE': return 'bg-red-600/30 text-red-300 border-red-500/50';
            default: return 'bg-gray-600/30 text-gray-300 border-gray-500/50';
        }
    };

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">📋 공시 검색 & AI 분석</h1>
                    <p className="text-blue-200 mt-1">OpenDART 전자공시시스템에서 기업 공시를 검색하고 AI로 분석합니다</p>
                </div>

                {/* Search Form */}
                <Card className="bg-gray-800/50 border-gray-700 p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">기업명</label>
                            <input
                                type="text"
                                value={searchParams.corpName}
                                onChange={(e) => setSearchParams(prev => ({ ...prev, corpName: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="예: 삼성전자"
                                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">시작일</label>
                            <input
                                type="date"
                                value={searchParams.bgn_de.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
                                onChange={(e) => setSearchParams(prev => ({ ...prev, bgn_de: e.target.value.replace(/-/g, '') }))}
                                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">종료일</label>
                            <input
                                type="date"
                                value={searchParams.end_de.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
                                onChange={(e) => setSearchParams(prev => ({ ...prev, end_de: e.target.value.replace(/-/g, '') }))}
                                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">공시유형</label>
                            <select
                                value={searchParams.pblntf_ty || ''}
                                onChange={(e) => setSearchParams(prev => ({ ...prev, pblntf_ty: e.target.value }))}
                                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            >
                                {disclosureTypes.map((type) => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? '검색 중...' : '🔍 검색'}
                        </button>
                        {disclosures.length > 0 && (
                            <button
                                onClick={handleAIAnalysis}
                                disabled={aiLoading}
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {aiLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        분석 중...
                                    </>
                                ) : (
                                    <>🤖 AI 분석</>
                                )}
                            </button>
                        )}
                    </div>
                </Card>

                {/* AI Analysis Result */}
                {aiAnalysis && (
                    <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/50 p-6 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-2xl">🤖</span>
                            <h3 className="text-lg font-semibold text-white">AI 공시 분석 결과</h3>
                            <span className={`px-3 py-1 rounded-full border text-sm ${getSentimentBadge(aiAnalysis.overallSentiment)}`}>
                                {aiAnalysis.overallSentiment === 'POSITIVE' ? '긍정적' : 
                                 aiAnalysis.overallSentiment === 'NEGATIVE' ? '부정적' : '중립적'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-sm font-medium text-gray-400 mb-2">📊 종합 분석</h4>
                                <p className="text-white leading-relaxed">{aiAnalysis.summary}</p>
                                
                                <div className="mt-4 flex items-center gap-4">
                                    <div>
                                        <span className="text-sm text-gray-400">영향도 점수</span>
                                        <span className={`ml-2 text-xl font-bold ${
                                            aiAnalysis.averageImpactScore > 0 ? 'text-green-400' :
                                            aiAnalysis.averageImpactScore < 0 ? 'text-red-400' : 'text-gray-400'
                                        }`}>
                                            {aiAnalysis.averageImpactScore > 0 ? '+' : ''}{aiAnalysis.averageImpactScore}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                {aiAnalysis.keyTrends && aiAnalysis.keyTrends.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="text-sm font-medium text-gray-400 mb-2">📈 주요 트렌드</h4>
                                        <ul className="space-y-1">
                                            {aiAnalysis.keyTrends.map((trend, i) => (
                                                <li key={i} className="text-blue-300 text-sm">• {trend}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {aiAnalysis.watchPoints && aiAnalysis.watchPoints.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-2">⚠️ 주목할 점</h4>
                                        <ul className="space-y-1">
                                            {aiAnalysis.watchPoints.map((point, i) => (
                                                <li key={i} className="text-yellow-300 text-sm">• {point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {aiAnalysis.investmentImplication && (
                            <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-400 mb-2">💡 투자 시사점</h4>
                                <p className="text-white">{aiAnalysis.investmentImplication}</p>
                            </div>
                        )}
                    </Card>
                )}

                {/* Results */}
                {disclosures.length > 0 ? (
                    <Card className="bg-gray-800/50 border-gray-700 p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-white">
                                검색 결과 <span className="text-blue-400">({totalCount}건)</span>
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="px-4 py-3 text-left text-gray-400">공시일</th>
                                        <th className="px-4 py-3 text-left text-gray-400">보고서명</th>
                                        <th className="px-4 py-3 text-left text-gray-400">제출인</th>
                                        <th className="px-4 py-3 text-center text-gray-400">비고</th>
                                        <th className="px-4 py-3 text-center text-gray-400">보기</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {disclosures.map((disc) => (
                                        <tr key={disc.rcept_no} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                            <td className="px-4 py-3 text-white whitespace-nowrap">
                                                {formatDate(disc.rcept_dt)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2 py-1 rounded border text-xs ${getReportBadgeColor(disc.report_nm)}`}>
                                                    {disc.report_nm}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-300">{disc.flr_nm || '-'}</td>
                                            <td className="px-4 py-3 text-center text-gray-400 text-xs">{disc.rm || '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => openDisclosure(disc.rcept_no)}
                                                    className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded text-xs"
                                                >
                                                    열기 →
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : !loading && searchedCorpCode && (
                    <Card className="bg-gray-800/50 border-gray-700 p-6 mb-6">
                        <p className="text-center text-gray-400 py-8">
                            검색 결과가 없습니다. 기간을 조정하거나 다른 기업명을 입력해보세요.
                        </p>
                    </Card>
                )}

                {/* Info Card */}
                <Card className="bg-gray-800/50 border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">💡 사용 안내</h3>
                    <ul className="text-gray-400 text-sm space-y-2">
                        <li>• 기업명으로 검색하면 해당 기업의 공시 목록을 조회합니다</li>
                        <li>• 🤖 <strong className="text-purple-300">AI 분석</strong> 버튼을 클릭하면 최근 공시를 GPT-4로 분석합니다</li>
                        <li>• "열기" 버튼을 클릭하면 DART 전자공시시스템에서 상세 내용을 확인할 수 있습니다</li>
                        <li>• 정기공시(A): 사업보고서, 반기/분기보고서</li>
                        <li>• 주요사항보고(B): 중요한 경영사항 변경</li>
                        <li>• 지분공시(D): 임원/주요주주 소유보고, 대량보유 상황보고</li>
                    </ul>
                </Card>
            </div>
        </DashboardLayout>
    );
}
