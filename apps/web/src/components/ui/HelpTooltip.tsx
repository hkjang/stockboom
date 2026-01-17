'use client';

import React, { useState } from 'react';

interface HelpTooltipProps {
  term: string;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

// 초보자를 위한 주식/트레이딩 용어 사전
export const tradingTerms: Record<string, { title: string; description: string; example?: string }> = {
  // 기본 용어
  portfolio: {
    title: '포트폴리오',
    description: '내가 보유한 주식들의 모음입니다. 마치 장바구니에 담은 물건들처럼, 여러 종목을 한눈에 관리할 수 있어요.',
    example: '삼성전자 30%, 카카오 20%, 네이버 50%로 구성된 포트폴리오'
  },
  position: {
    title: '포지션',
    description: '현재 보유 중인 주식의 상태를 말해요. "삼성전자 100주 보유" 같은 것이 포지션이에요.',
    example: '매수 포지션 = 주식을 가지고 있는 상태'
  },
  pnl: {
    title: '손익 (PnL)',
    description: 'Profit and Loss의 약자예요. 내가 얼마나 벌었는지, 혹은 잃었는지를 보여줘요.',
    example: '+50,000원 = 5만원 수익, -30,000원 = 3만원 손실'
  },
  unrealizedPnl: {
    title: '미실현 손익',
    description: '아직 주식을 팔지 않아서 확정되지 않은 수익/손실이에요. 주가가 변하면 이 금액도 계속 바뀌어요.',
    example: '산 가격보다 현재 가격이 높으면 미실현 이익'
  },
  realizedPnl: {
    title: '실현 손익',
    description: '주식을 실제로 팔아서 확정된 수익/손실이에요. 이 금액은 더 이상 변하지 않아요.',
    example: '10,000원에 사서 15,000원에 팔면 5,000원 실현 이익'
  },

  // 주문 관련
  marketOrder: {
    title: '시장가 주문',
    description: '지금 당장 현재 가격에 사거나 팔겠다는 주문이에요. 바로 체결되지만 가격이 조금 불리할 수 있어요.',
    example: '급하게 팔아야 할 때 시장가 매도 사용'
  },
  limitOrder: {
    title: '지정가 주문',
    description: '내가 원하는 가격을 정해서 주문하는 거예요. 그 가격이 되어야만 체결돼요.',
    example: '75,000원에 사고 싶다 → 75,000원 지정가 매수'
  },
  stopLoss: {
    title: '손절가',
    description: '손실을 제한하기 위해 설정하는 가격이에요. 이 가격까지 떨어지면 자동으로 팔아서 더 큰 손실을 막아줘요.',
    example: '10% 손실이 나면 자동 매도되도록 설정'
  },
  takeProfit: {
    title: '익절가',
    description: '목표 수익에 도달하면 자동으로 팔도록 설정하는 가격이에요. 욕심 부리다 놓치는 것을 방지해요.',
    example: '20% 수익이 나면 자동 매도되도록 설정'
  },

  // 스마트 주문
  vwap: {
    title: 'VWAP (거래량 가중 평균 가격)',
    description: '큰 금액을 나눠서 조금씩 사는 방법이에요. 거래가 많을 때 더 많이 사서 좋은 가격에 살 수 있어요.',
    example: '1000주를 1시간에 걸쳐 조금씩 매수'
  },
  twap: {
    title: 'TWAP (시간 가중 평균 가격)',
    description: '일정 시간마다 똑같은 양을 사는 방법이에요. 가격 변동 영향을 줄여줘요.',
    example: '10분마다 100주씩, 총 10번에 나눠 매수'
  },
  iceberg: {
    title: '아이스버그 주문',
    description: '빙산처럼 내 주문을 숨기는 거예요. 한 번에 적은 양만 보여주고, 체결되면 다음 양을 내보내요.',
    example: '10,000주 주문인데 1,000주씩만 보여주기'
  },

  // 전략 관련
  strategy: {
    title: '전략',
    description: '주식을 사고 팔 때 따르는 규칙이에요. "어떤 조건에서 사고, 어떤 조건에서 팔 건지" 미리 정해둡니다.',
    example: 'RSI가 30 이하면 매수, 70 이상이면 매도'
  },
  gridTrading: {
    title: '그리드 매매',
    description: '가격이 오르락내리락할 때 미리 정한 가격마다 사고팔아서 수익을 내는 방법이에요.',
    example: '70,000원~80,000원 사이에 1,000원 간격으로 매수/매도 주문'
  },
  trendFollowing: {
    title: '추세추종',
    description: '가격이 오르는 추세면 따라 사고, 내리는 추세면 팔거나 기다리는 전략이에요.',
    example: '상승 추세 확인 후 매수, 하락 전환 시 매도'
  },
  meanReversion: {
    title: '평균회귀',
    description: '주가가 너무 많이 올랐거나 떨어지면 다시 평균으로 돌아온다는 생각에 기반한 전략이에요.',
    example: '갑자기 10% 떨어지면 다시 오를 것으로 보고 매수'
  },

  // 기술적 지표
  rsi: {
    title: 'RSI (상대강도지수)',
    description: '주가가 너무 많이 올랐는지(과매수), 너무 많이 떨어졌는지(과매도) 알려주는 지표예요. 0~100 사이 숫자로 표시돼요.',
    example: '70 이상 = 과매수(팔 타이밍?), 30 이하 = 과매도(살 타이밍?)'
  },
  macd: {
    title: 'MACD',
    description: '두 개의 이동평균선 차이를 보여주는 지표예요. 추세의 방향과 강도를 알 수 있어요.',
    example: 'MACD선이 시그널선을 위로 뚫으면 "골든크로스" = 상승 신호'
  },
  bollingerBands: {
    title: '볼린저 밴드',
    description: '주가 변동의 범위를 보여주는 밴드예요. 가격이 밴드 밖으로 나가면 과도한 움직임을 의미해요.',
    example: '하단 밴드 터치 = 과매도 가능성, 반등 기대'
  },
  movingAverage: {
    title: '이동평균선',
    description: '최근 며칠간의 평균 가격을 이은 선이에요. 추세를 파악하는 데 많이 사용해요.',
    example: '20일 이동평균선 = 최근 20일 평균 가격'
  },

  // 리스크 관리
  riskManagement: {
    title: '리스크 관리',
    description: '손실을 줄이고 자산을 보호하기 위한 규칙들이에요. 한 번에 너무 많이 투자하지 않는 것이 핵심이에요.',
    example: '한 종목에 전체 자산의 10% 이상 투자하지 않기'
  },
  maxDrawdown: {
    title: '최대 낙폭 (MDD)',
    description: '최고점에서 최저점까지 얼마나 떨어졌는지를 나타내요. 숫자가 작을수록 안정적인 투자예요.',
    example: 'MDD 20% = 최고점 대비 20% 손실 경험'
  },
  sharpeRatio: {
    title: '샤프 비율',
    description: '위험 대비 수익이 얼마나 좋은지를 나타내요. 높을수록 효율적인 투자예요.',
    example: '샤프비율 2.0 = 위험 대비 우수한 수익'
  },
  kellyCriterion: {
    title: '켈리 기준',
    description: '수학적으로 최적의 투자 비율을 계산해주는 공식이에요. 승률과 손익 비율을 기반으로 해요.',
    example: '승률 60%, 손익비 2:1이면 자본의 40% 투자 권장'
  },
  circuitBreaker: {
    title: '서킷 브레이커',
    description: '일정 손실이 발생하면 거래를 자동으로 중단하는 안전장치예요. 큰 손실을 막아줘요.',
    example: '일일 손실 5% 초과 시 자동매매 중단'
  },

  // 성과 지표
  winRate: {
    title: '승률',
    description: '전체 거래 중 수익을 낸 거래의 비율이에요. 높을수록 좋지만, 손익 크기도 중요해요.',
    example: '10번 거래 중 6번 수익 = 60% 승률'
  },
  profitFactor: {
    title: '손익비',
    description: '총 수익을 총 손실로 나눈 값이에요. 1보다 크면 수익, 작으면 손실인 상태예요.',
    example: '손익비 1.5 = 손실의 1.5배만큼 수익'
  },

  // 시장 시간
  preMarket: {
    title: '프리마켓',
    description: '정규 거래 시간 전에 미리 준비하는 시간이에요. 이때 오늘의 전략을 점검해요.',
    example: '한국 주식시장: 오전 8시~9시'
  },
  regularMarket: {
    title: '정규장',
    description: '주식을 실제로 사고팔 수 있는 시간이에요.',
    example: '한국 주식시장: 오전 9시~오후 3시 30분'
  },
  afterHours: {
    title: '시간외 거래',
    description: '정규 거래 시간이 끝난 후에도 거래할 수 있는 시간이에요. 물량이 적어 가격 변동이 클 수 있어요.',
    example: '한국 주식시장: 오후 3시 40분~6시'
  },

  // AI 관련
  aiRecommendation: {
    title: 'AI 추천',
    description: 'AI가 뉴스, 차트, 거래량 등을 분석해서 매수/매도/보유 중 하나를 추천해줘요.',
    example: 'AI가 "매수" 추천과 함께 목표가, 손절가 제시'
  },
  sentimentAnalysis: {
    title: '감성 분석',
    description: '뉴스나 공시 내용이 긍정적인지 부정적인지 AI가 분석하는 거예요.',
    example: '뉴스 10개 분석 결과: 긍정 7, 부정 2, 중립 1'
  },
  pricePrediction: {
    title: '가격 예측',
    description: 'AI가 과거 데이터와 현재 상황을 분석해서 앞으로의 가격 방향을 예측해요.',
    example: '1일 후 예측: 상승 가능성 70%'
  },
};

export function HelpTooltip({ term, children, position = 'top', className = '' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const termData = tradingTerms[term];

  if (!termData) {
    console.warn(`Help term not found: ${term}`);
    return <>{children}</>;
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className={`relative inline-flex items-center gap-1 ${className}`}>
      {children}
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 text-xs text-blue-400 bg-blue-900/50 rounded-full hover:bg-blue-800/70 transition-colors cursor-help"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`${termData.title} 도움말`}
      >
        ?
      </button>
      
      {isOpen && (
        <div 
          className={`absolute z-50 ${positionClasses[position]} w-72 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📚</span>
            <h4 className="font-semibold text-white">{termData.title}</h4>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed mb-2">
            {termData.description}
          </p>
          {termData.example && (
            <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-400">
              <span className="text-blue-400">예시:</span> {termData.example}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sections: Array<{
    heading: string;
    content: string;
    tips?: string[];
  }>;
}

export function HelpModal({ isOpen, onClose, title, sections }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-gray-900/90 backdrop-blur border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-400">
                <span className="flex items-center justify-center w-6 h-6 text-sm bg-blue-900/50 rounded-full">
                  {idx + 1}
                </span>
                {section.heading}
              </h3>
              <p className="text-gray-300 leading-relaxed pl-8">
                {section.content}
              </p>
              {section.tips && section.tips.length > 0 && (
                <div className="ml-8 p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2 text-green-400 text-sm font-medium">
                    💡 초보자 팁
                  </div>
                  <ul className="space-y-1">
                    {section.tips.map((tip, tipIdx) => (
                      <li key={tipIdx} className="text-sm text-gray-400 flex items-start gap-2">
                        <span className="text-green-500">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-4 bg-gray-900/90 backdrop-blur border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            이해했어요! 👍
          </button>
        </div>
      </div>
    </div>
  );
}

interface HelpButtonProps {
  onClick: () => void;
  className?: string;
}

export function HelpButton({ onClick, className = '' }: HelpButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/50 rounded-lg transition-colors ${className}`}
    >
      <span>📖</span>
      <span>도움말</span>
    </button>
  );
}

// 페이지별 도움말 콘텐츠
export const pageHelpContent = {
  dashboard: {
    title: '대시보드 사용 가이드',
    sections: [
      {
        heading: '대시보드란?',
        content: '대시보드는 내 투자 현황을 한눈에 볼 수 있는 메인 화면이에요. 보유 종목, 수익률, 최근 거래 등 중요한 정보가 모여 있어요.',
        tips: ['매일 아침 대시보드를 확인하는 습관을 들여보세요', '빨간색은 손실, 초록색은 수익을 의미해요']
      },
      {
        heading: '손익 확인하기',
        content: '미실현 손익은 아직 팔지 않은 주식의 현재 가치 변화예요. 실현 손익은 실제로 팔아서 확정된 수익/손실이에요.',
        tips: ['미실현 손익은 언제든 바뀔 수 있어요', '너무 자주 확인하면 조급해질 수 있으니 주의하세요']
      },
    ]
  },
  trading: {
    title: '자동매매 가이드',
    sections: [
      {
        heading: '자동매매란?',
        content: '미리 설정한 규칙에 따라 컴퓨터가 자동으로 주식을 사고파는 기능이에요. 감정에 휘둘리지 않고 일관된 거래를 할 수 있어요.',
        tips: ['처음에는 소액으로 테스트해보세요', '모의투자 모드에서 충분히 연습 후 실전 적용하세요']
      },
      {
        heading: '전략 선택하기',
        content: '그리드 매매, 추세추종, 평균회귀 등 다양한 전략 중 시장 상황과 투자 성향에 맞는 것을 선택하세요.',
        tips: ['하나의 전략을 충분히 이해한 후 사용하세요', '여러 전략을 동시에 쓰면 관리가 어려워요']
      },
      {
        heading: '리스크 관리',
        content: '일일 손실 한도, 종목별 최대 비중 등을 설정하여 큰 손실을 방지하세요. 서킷 브레이커는 비상 정지 장치예요.',
        tips: ['전체 자산의 2% 이상을 한 거래에 걸지 마세요', '손절 설정은 선택이 아닌 필수예요']
      },
    ]
  },
  strategy: {
    title: '전략 설정 가이드',
    sections: [
      {
        heading: '전략의 기본 구성',
        content: '모든 전략은 "언제 살까" (진입 조건)와 "언제 팔까" (청산 조건)로 이루어져요. 명확한 규칙이 있어야 일관된 거래가 가능해요.',
        tips: ['처음엔 간단한 조건 1~2개로 시작하세요', '백테스트로 과거 성과를 먼저 확인하세요']
      },
      {
        heading: '지표 활용하기',
        content: 'RSI, MACD, 이동평균선 등의 기술적 지표를 조합해서 매매 신호를 만들어요. 각 지표의 의미를 이해하고 사용하세요.',
        tips: ['RSI 30 이하는 과매도, 70 이상은 과매수 신호예요', '이동평균선 골든크로스는 상승 신호일 수 있어요']
      },
    ]
  },
  portfolio: {
    title: '포트폴리오 관리 가이드',
    sections: [
      {
        heading: '분산 투자의 중요성',
        content: '한 종목에 모든 돈을 넣으면 위험해요. 여러 종목, 여러 업종에 나눠 투자하면 리스크를 줄일 수 있어요.',
        tips: ['한 종목에 전체 자산의 20% 이상 넣지 마세요', '서로 다른 업종의 주식을 섞어보세요']
      },
      {
        heading: '리밸런싱',
        content: '시간이 지나면 종목별 비중이 달라져요. 주기적으로 원래 계획한 비율로 조정하는 것을 리밸런싱이라고 해요.',
        tips: ['분기마다 한 번씩 포트폴리오를 점검하세요', 'AI 포트폴리오 최적화 기능을 활용해보세요']
      },
    ]
  },
  smartOrder: {
    title: '스마트 주문 가이드',
    sections: [
      {
        heading: '스마트 주문이란?',
        content: '큰 금액을 한 번에 주문하면 가격에 영향을 줄 수 있어요. 스마트 주문은 이를 피하기 위해 자동으로 나눠서 주문해요.',
        tips: ['1000만원 이상 거래 시 스마트 주문을 고려하세요', '일반 투자자도 TWAP으로 평균 가격에 매수할 수 있어요']
      },
      {
        heading: 'VWAP vs TWAP',
        content: 'VWAP은 거래량이 많을 때 더 많이 사고, TWAP은 시간에 따라 균등하게 사요. 시장 상황에 따라 선택하세요.',
        tips: ['거래량이 일정하면 TWAP이 간단해요', '변동성이 크면 VWAP이 유리할 수 있어요']
      },
    ]
  },
  performance: {
    title: '성과 분석 가이드',
    sections: [
      {
        heading: '중요한 지표들',
        content: '승률만 보지 말고 손익비도 함께 보세요. 30% 승률이라도 이익이 손실보다 훨씬 크면 수익을 낼 수 있어요.',
        tips: ['승률 × 평균이익 > 패률 × 평균손실 이면 OK', '샤프 비율 1.0 이상이면 괜찮은 전략이에요']
      },
      {
        heading: '최대 낙폭 (MDD)',
        content: '최고점에서 최저점까지 얼마나 떨어졌는지 보여줘요. 이 숫자가 크면 심리적으로 버티기 힘들 수 있어요.',
        tips: ['MDD 20%를 넘으면 전략을 재검토하세요', '내가 감당할 수 있는 MDD를 미리 정해두세요']
      },
    ]
  },
  analysis: {
    title: '종목 분석 가이드',
    sections: [
      {
        heading: '기술적 분석이란?',
        content: '과거의 가격과 거래량 데이터를 분석해서 미래 가격을 예측하는 방법이에요. RSI, MACD, 볼린저밴드 같은 지표를 사용해요.',
        tips: ['하나의 지표만 보지 말고 여러 지표를 종합해서 판단하세요', '지표가 100% 정확한 것은 아니에요, 참고용으로 사용하세요']
      },
      {
        heading: 'AI 분석 활용하기',
        content: 'AI가 뉴스, 차트 패턴, 이상 징후를 분석해서 매매 추천을 해줘요. 사람이 놓칠 수 있는 패턴도 감지할 수 있어요.',
        tips: ['AI 추천도 100% 정확하지 않아요', '신뢰도(Confidence)가 높을수록 AI가 확신하는 추천이에요']
      },
      {
        heading: '뉴스 감성 분석',
        content: '뉴스 기사의 내용이 긍정적인지 부정적인지 AI가 분석해요. 많은 긍정 뉴스 = 상승 가능성, 부정 뉴스 = 하락 가능성을 의미할 수 있어요.',
        tips: ['뉴스가 주가에 즉시 반영되지 않을 수 있어요', '이미 알려진 뉴스는 가격에 반영되어 있을 수 있어요']
      },
    ]
  },
  trades: {
    title: '거래내역 가이드',
    sections: [
      {
        heading: '거래 상태 이해하기',
        content: '대기중(PENDING)은 주문이 접수되었지만 아직 체결되지 않은 상태예요. 체결완료(FILLED)는 모두 거래된 상태예요.',
        tips: ['지정가 주문은 원하는 가격에 도달할 때까지 대기 상태로 남아요', '장이 마감되면 미체결 주문은 취소될 수 있어요']
      },
      {
        heading: '승률이란?',
        content: '전체 거래 중 수익을 낸 거래의 비율이에요. 승률만 높다고 좋은 것은 아니고, 평균 수익/손실 크기도 함께 봐야 해요.',
        tips: ['승률 50%라도 평균 수익 > 평균 손실이면 수익 가능', '손절을 잘하면 승률은 낮아도 총 수익은 높을 수 있어요']
      },
      {
        heading: '거래 기록 활용법',
        content: '과거 거래를 분석하면 자주 실수하는 패턴을 발견할 수 있어요. 왜 샀는지, 왜 팔았는지 기록해두면 좋아요.',
        tips: ['감정적으로 거래한 경우를 표시해두세요', '수익 난 거래와 손실 난 거래의 차이점을 찾아보세요']
      },
    ]
  },
};

export default HelpTooltip;


