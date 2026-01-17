'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
    HelpCircle, 
    Book, 
    MessageCircle, 
    Mail, 
    ExternalLink,
    ChevronDown,
    ChevronRight,
    Zap,
    TrendingUp,
    Shield,
    Settings,
    BarChart3
} from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
    category: string;
}

const faqs: FAQItem[] = [
    {
        category: '시작하기',
        question: 'StockBoom은 어떻게 사용하나요?',
        answer: '1) 설정 > 증권사 연동에서 한국투자증권 API 키를 등록합니다. 2) 포트폴리오를 생성합니다. 3) 전략을 생성하거나 기본 전략을 사용합니다. 4) 자동매매를 시작합니다.',
    },
    {
        category: '시작하기',
        question: 'API 키는 어떻게 발급받나요?',
        answer: '한국투자증권 홈페이지에서 API 키를 발급받을 수 있습니다. 모의투자와 실전투자용 키가 별도로 있으니 처음에는 모의투자용 키로 테스트하세요.',
    },
    {
        category: '자동매매',
        question: '자동매매는 안전한가요?',
        answer: '모든 자동매매에는 손절/익절 설정이 필수입니다. 서킷 브레이커 기능이 있어 급격한 손실 시 자동으로 거래를 중단합니다. 반드시 모의투자로 충분히 테스트 후 실전 투자를 진행하세요.',
    },
    {
        category: '자동매매',
        question: '전략은 어떻게 만드나요?',
        answer: '전략관리 메뉴에서 새 전략을 생성할 수 있습니다. 그리드 매매, 추세추종, 평균회귀, 돌파 매매 등 다양한 전략 템플릿을 제공합니다.',
    },
    {
        category: '분석',
        question: 'AI 분석은 어떻게 작동하나요?',
        answer: 'AI 분석은 기술적 지표, 뉴스 감성, 패턴 인식을 종합하여 매매 신호를 생성합니다. 신뢰도가 70% 이상인 경우에만 자동매매에 반영됩니다.',
    },
    {
        category: '보안',
        question: 'API 키는 안전하게 보관되나요?',
        answer: '모든 API 키와 비밀키는 AES-256 암호화되어 저장됩니다. 서버에서만 복호화되며 절대 클라이언트에 노출되지 않습니다.',
    },
];

const guides = [
    {
        title: '시작 가이드',
        description: '처음 사용자를 위한 상세 가이드',
        icon: Book,
        color: 'text-blue-400',
    },
    {
        title: '자동매매 전략',
        description: '다양한 자동매매 전략 소개',
        icon: Zap,
        color: 'text-purple-400',
    },
    {
        title: '기술적 분석',
        description: 'RSI, MACD 등 지표 활용법',
        icon: BarChart3,
        color: 'text-green-400',
    },
    {
        title: '리스크 관리',
        description: '손절, 익절, 포지션 관리',
        icon: Shield,
        color: 'text-red-400',
    },
];

export default function HelpPage() {
    const [openFAQ, setOpenFAQ] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = [...new Set(faqs.map(f => f.category))];
    const filteredFAQs = selectedCategory 
        ? faqs.filter(f => f.category === selectedCategory)
        : faqs;

    return (
        <DashboardLayout>
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <HelpCircle className="text-blue-400" size={32} />
                        도움말 센터
                    </h2>
                    <p className="text-blue-200">StockBoom 사용에 필요한 모든 정보</p>
                </div>

                {/* Quick Guides */}
                <div className="mb-12">
                    <h3 className="text-xl font-semibold text-white mb-4">📚 빠른 가이드</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {guides.map((guide) => (
                            <button
                                key={guide.title}
                                className="bg-white/10 backdrop-blur-lg rounded-xl p-5 border border-white/20 
                                           hover:bg-white/15 transition text-left group"
                            >
                                <guide.icon size={28} className={`${guide.color} mb-3 group-hover:scale-110 transition`} />
                                <h4 className="text-white font-medium mb-1">{guide.title}</h4>
                                <p className="text-sm text-blue-200">{guide.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mb-12">
                    <h3 className="text-xl font-semibold text-white mb-4">❓ 자주 묻는 질문</h3>
                    
                    {/* Category Tabs */}
                    <div className="flex gap-2 mb-6 flex-wrap">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-4 py-2 rounded-lg transition ${
                                !selectedCategory 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-white/10 text-blue-200 hover:bg-white/20'
                            }`}
                        >
                            전체
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-lg transition ${
                                    selectedCategory === cat 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* FAQ Items */}
                    <div className="space-y-3">
                        {filteredFAQs.map((faq, index) => (
                            <div
                                key={index}
                                className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden"
                            >
                                <button
                                    onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                                    className="w-full flex items-center justify-between p-4 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                                            {faq.category}
                                        </span>
                                        <span className="text-white font-medium">{faq.question}</span>
                                    </div>
                                    {openFAQ === index ? (
                                        <ChevronDown size={20} className="text-blue-400" />
                                    ) : (
                                        <ChevronRight size={20} className="text-blue-400" />
                                    )}
                                </button>
                                {openFAQ === index && (
                                    <div className="px-4 pb-4 text-blue-200 border-t border-white/10 pt-3">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contact Section */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <MessageCircle size={20} className="text-green-400" />
                            문의하기
                        </h3>
                        <p className="text-blue-200 mb-4 text-sm">
                            도움이 더 필요하시면 언제든지 문의해주세요.
                        </p>
                        <div className="space-y-3">
                            <a 
                                href="mailto:support@stockboom.io"
                                className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition"
                            >
                                <Mail size={16} className="text-blue-400" />
                                <span className="text-white">support@stockboom.io</span>
                            </a>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <ExternalLink size={20} className="text-purple-400" />
                            유용한 링크
                        </h3>
                        <div className="space-y-3">
                            <a 
                                href="https://apiportal.koreainvestment.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition"
                            >
                                <span className="text-blue-200">한국투자증권 API 포탈</span>
                                <ExternalLink size={14} className="text-blue-400" />
                            </a>
                            <a 
                                href="https://github.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition"
                            >
                                <span className="text-blue-200">GitHub 저장소</span>
                                <ExternalLink size={14} className="text-blue-400" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
