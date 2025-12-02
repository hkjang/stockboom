export default function HomePage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-6xl font-bold text-white mb-4">
                        📈 StockBoom
                    </h1>
                    <p className="text-2xl text-blue-200 mb-8">
                        AI 기반 주식 자동 매매 시스템
                    </p>
                    <div className="flex gap-4 justify-center">
                        <a
                            href="/auth/login"
                            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                            로그인
                        </a>
                        <a
                            href="/auth/register"
                            className="px-8 py-3 bg-white text-blue-900 rounded-lg font-semibold hover:bg-blue-50 transition"
                        >
                            회원가입
                        </a>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mb-12">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-4xl mb-4">🔄</div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            실시간 데이터 수집
                        </h3>
                        <p className="text-blue-200">
                            한국투자증권 API와 Yahoo Finance를 통한 이중 소스 데이터 수집
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-4xl mb-4">🤖</div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            AI 분석
                        </h3>
                        <p className="text-blue-200">
                            기술적 지표와 AI를 통한 종합 분석 및 매매 신호 생성
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <div className="text-4xl mb-4">💰</div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            자동 매매
                        </h3>
                        <p className="text-blue-200">
                            전략 기반 자동 주문 실행 및 포트폴리오 관리
                        </p>
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
                    <h2 className="text-3xl font-bold text-white mb-6">주요 기능</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <span className="text-green-400 text-xl">✓</span>
                            <div>
                                <h4 className="text-white font-semibold">실시간 시세</h4>
                                <p className="text-sm text-blue-200">이중 소스로 안정적인 시세 제공</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-green-400 text-xl">✓</span>
                            <div>
                                <h4 className="text-white font-semibold">기술적 지표</h4>
                                <p className="text-sm text-blue-200">SMA, RSI, MACD, Stochastic</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-green-400 text-xl">✓</span>
                            <div>
                                <h4 className="text-white font-semibold">포트폴리오 관리</h4>
                                <p className="text-sm text-blue-200">실시간 평가금액 및 수익률 추적</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-green-400 text-xl">✓</span>
                            <div>
                                <h4 className="text-white font-semibold">자동 매매 전략</h4>
                                <p className="text-sm text-blue-200">조건부 자동 주문 및 손익 관리</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
