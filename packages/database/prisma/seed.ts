import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================
// Trading Strategy Templates
// ============================================

const strategyTemplates = [
    // === INDICATOR_BASED Strategies ===
    {
        name: 'RSI 역추세 전략',
        description: 'RSI 과매도/과매수 구간에서 역추세 매매. RSI 30 이하에서 매수, 70 이상에서 매도.',
        type: 'INDICATOR_BASED',
        config: {
            indicators: ['RSI'],
            timeframe: '1d',
            buyConditions: {
                RSI: { operator: '<', value: 30 }
            },
            sellConditions: {
                RSI: { operator: '>', value: 70 }
            },
            confirmations: 1
        },
        stopLossPercent: 5,
        takeProfitPercent: 15,
        maxPositionSize: 5000000,
        isBacktested: true,
        backtestReturn: 18.5,
        winRate: 62,
        sharpeRatio: 1.35
    },
    {
        name: 'MACD 크로스오버 전략',
        description: 'MACD 시그널 라인 크로스오버 기반 추세추종 전략. 골든크로스 매수, 데드크로스 매도.',
        type: 'INDICATOR_BASED',
        config: {
            indicators: ['MACD'],
            timeframe: '1d',
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            buyConditions: {
                MACD: { crossover: 'signal', direction: 'up' }
            },
            sellConditions: {
                MACD: { crossover: 'signal', direction: 'down' }
            }
        },
        stopLossPercent: 7,
        takeProfitPercent: 20,
        maxPositionSize: 8000000,
        isBacktested: true,
        backtestReturn: 22.3,
        winRate: 55,
        sharpeRatio: 1.52
    },
    {
        name: '볼린저밴드 스퀴즈 전략',
        description: '볼린저밴드 수축 후 확장 시 돌파 방향으로 진입. 변동성 돌파 전략.',
        type: 'INDICATOR_BASED',
        config: {
            indicators: ['BOLLINGER_BANDS'],
            timeframe: '4h',
            period: 20,
            stdDev: 2,
            buyConditions: {
                price: { crossover: 'upper_band', direction: 'up' },
                squeeze: { released: true, direction: 'up' }
            },
            sellConditions: {
                price: { crossover: 'lower_band', direction: 'down' },
                squeeze: { released: true, direction: 'down' }
            }
        },
        stopLossPercent: 4,
        takeProfitPercent: 12,
        maxPositionSize: 6000000,
        isBacktested: true,
        backtestReturn: 28.7,
        winRate: 48,
        sharpeRatio: 1.78
    },
    {
        name: '이동평균 트리플 크로스',
        description: '5일, 20일, 60일 이동평균선 정배열/역배열 기반 중장기 추세추종.',
        type: 'INDICATOR_BASED',
        config: {
            indicators: ['SMA', 'EMA'],
            timeframe: '1d',
            periods: [5, 20, 60],
            buyConditions: {
                alignment: 'bullish', // 5 > 20 > 60
                confirmation: { days: 3 }
            },
            sellConditions: {
                alignment: 'bearish', // 5 < 20 < 60
                confirmation: { days: 2 }
            }
        },
        stopLossPercent: 8,
        takeProfitPercent: 25,
        maxPositionSize: 10000000,
        isBacktested: true,
        backtestReturn: 35.2,
        winRate: 52,
        sharpeRatio: 1.41
    },
    {
        name: '스토캐스틱 오실레이터 전략',
        description: '스토캐스틱 %K와 %D 크로스오버를 활용한 단기 반전 매매.',
        type: 'INDICATOR_BASED',
        config: {
            indicators: ['STOCHASTIC'],
            timeframe: '1h',
            kPeriod: 14,
            dPeriod: 3,
            slowing: 3,
            buyConditions: {
                K: { operator: '<', value: 20 },
                KD_cross: { direction: 'up' }
            },
            sellConditions: {
                K: { operator: '>', value: 80 },
                KD_cross: { direction: 'down' }
            }
        },
        stopLossPercent: 3,
        takeProfitPercent: 8,
        maxPositionSize: 3000000,
        isBacktested: true,
        backtestReturn: 14.8,
        winRate: 58,
        sharpeRatio: 1.22
    },
    {
        name: 'ATR 변동성 돌파 전략',
        description: '전일 고점 + ATR 기반 돌파 매수. 래리 윌리엄스 변동성 돌파 응용.',
        type: 'INDICATOR_BASED',
        config: {
            indicators: ['ATR'],
            timeframe: '1d',
            atrPeriod: 14,
            breakoutMultiplier: 0.5,
            buyConditions: {
                price: { operator: '>', value: 'prev_high + ATR * 0.5' }
            },
            sellConditions: {
                time: 'market_close',
                or: {
                    stopLoss: true,
                    takeProfit: true
                }
            }
        },
        stopLossPercent: 2,
        takeProfitPercent: 5,
        maxPositionSize: 5000000,
        isBacktested: true,
        backtestReturn: 45.3,
        winRate: 45,
        sharpeRatio: 2.15
    },
    {
        name: 'ADX 추세강도 전략',
        description: 'ADX 25 이상 강한 추세에서 +DI/-DI 방향으로 진입.',
        type: 'INDICATOR_BASED',
        config: {
            indicators: ['ADX', 'DI'],
            timeframe: '1d',
            adxPeriod: 14,
            buyConditions: {
                ADX: { operator: '>', value: 25 },
                plusDI: { operator: '>', value: 'minusDI' }
            },
            sellConditions: {
                ADX: { operator: '>', value: 25 },
                minusDI: { operator: '>', value: 'plusDI' }
            },
            exitConditions: {
                ADX: { operator: '<', value: 20 }
            }
        },
        stopLossPercent: 6,
        takeProfitPercent: 18,
        maxPositionSize: 7000000,
        isBacktested: true,
        backtestReturn: 24.6,
        winRate: 51,
        sharpeRatio: 1.45
    },
    {
        name: 'OBV 거래량 확인 전략',
        description: 'OBV 추세와 가격 추세 일치 시 진입. 다이버전스 발생 시 청산.',
        type: 'INDICATOR_BASED',
        config: {
            indicators: ['OBV', 'SMA'],
            timeframe: '1d',
            priceSma: 20,
            obvSma: 20,
            buyConditions: {
                price: { trend: 'up' },
                OBV: { trend: 'up' },
                confirmation: { bothUp: true }
            },
            sellConditions: {
                divergence: { type: 'bearish' },
                or: { price: { trend: 'down' } }
            }
        },
        stopLossPercent: 5,
        takeProfitPercent: 15,
        maxPositionSize: 6000000,
        isBacktested: true,
        backtestReturn: 19.2,
        winRate: 54,
        sharpeRatio: 1.32
    },

    // === AI_BASED Strategies ===
    {
        name: 'AI 뉴스 감성 분석',
        description: 'GPT-4 기반 뉴스 감성 분석으로 매매 신호 생성. 긍정 뉴스 급증 시 매수.',
        type: 'AI_BASED',
        config: {
            model: 'gpt-4',
            analysisType: 'news_sentiment',
            minConfidence: 0.75,
            sources: ['naver_news', 'daum_news', 'reuters_kr'],
            buyConditions: {
                sentiment: { operator: '>', value: 0.6 },
                confidence: { operator: '>', value: 0.75 },
                newsCount: { operator: '>=', value: 5 }
            },
            sellConditions: {
                sentiment: { operator: '<', value: -0.3 },
                or: { holdingDays: { operator: '>', value: 5 } }
            }
        },
        stopLossPercent: 7,
        takeProfitPercent: 20,
        maxPositionSize: 10000000,
        isBacktested: true,
        backtestReturn: 32.5,
        winRate: 58,
        sharpeRatio: 1.68
    },
    {
        name: 'AI 패턴 인식 전략',
        description: 'CNN 기반 차트 패턴 인식. 헤드앤숄더, 삼각수렴 등 패턴 감지 후 매매.',
        type: 'AI_BASED',
        config: {
            model: 'pattern_cnn_v2',
            analysisType: 'chart_pattern',
            patterns: ['head_shoulders', 'triangle', 'double_top', 'double_bottom', 'wedge'],
            minConfidence: 0.8,
            buyConditions: {
                pattern: ['double_bottom', 'ascending_triangle', 'inverse_head_shoulders'],
                confidence: { operator: '>', value: 0.8 }
            },
            sellConditions: {
                pattern: ['double_top', 'descending_triangle', 'head_shoulders'],
                confidence: { operator: '>', value: 0.8 }
            }
        },
        stopLossPercent: 6,
        takeProfitPercent: 18,
        maxPositionSize: 8000000,
        isBacktested: true,
        backtestReturn: 28.9,
        winRate: 52,
        sharpeRatio: 1.55
    },
    {
        name: 'AI 재무제표 분석',
        description: 'BERT 모델로 재무제표 텍스트 분석. 실적 발표 전후 매매 신호 생성.',
        type: 'AI_BASED',
        config: {
            model: 'finbert-ko',
            analysisType: 'financial_statement',
            metrics: ['revenue_growth', 'operating_margin', 'eps_surprise'],
            buyConditions: {
                epsSurprise: { operator: '>', value: 0.05 },
                revenueGrowth: { operator: '>', value: 0.1 },
                sentiment: { operator: '>', value: 0.5 }
            },
            sellConditions: {
                epsSurprise: { operator: '<', value: -0.05 },
                or: { holdingDays: { operator: '>', value: 20 } }
            },
            timing: {
                beforeEarnings: { days: 5, action: 'prepare' },
                afterEarnings: { days: 1, action: 'execute' }
            }
        },
        stopLossPercent: 10,
        takeProfitPercent: 30,
        maxPositionSize: 15000000,
        isBacktested: true,
        backtestReturn: 42.1,
        winRate: 61,
        sharpeRatio: 1.92
    },
    {
        name: 'AI 시장 심리 분석',
        description: '소셜미디어, 커뮤니티 분석으로 시장 심리 파악. 공포/탐욕 지수 기반 역투자.',
        type: 'AI_BASED',
        config: {
            model: 'sentiment_lstm',
            analysisType: 'social_sentiment',
            sources: ['twitter', 'reddit', 'naver_cafe', 'stock_community'],
            fearGreedIndex: true,
            buyConditions: {
                fearGreed: { operator: '<', value: 25, label: 'extreme_fear' },
                mentionTrend: { direction: 'increasing' }
            },
            sellConditions: {
                fearGreed: { operator: '>', value: 75, label: 'extreme_greed' },
                or: { profitTarget: { operator: '>', value: 0.15 } }
            }
        },
        stopLossPercent: 8,
        takeProfitPercent: 25,
        maxPositionSize: 12000000,
        isBacktested: true,
        backtestReturn: 38.7,
        winRate: 55,
        sharpeRatio: 1.75
    },

    // === HYBRID Strategies ===
    {
        name: '하이브리드 RSI + AI 전략',
        description: 'RSI 기술적 신호와 AI 뉴스 감성을 결합. 두 신호 일치 시 고확률 진입.',
        type: 'HYBRID',
        config: {
            technicalIndicators: ['RSI', 'MACD'],
            aiModels: ['news_sentiment'],
            fusionMethod: 'weighted_average',
            weights: { technical: 0.4, ai: 0.6 },
            buyConditions: {
                RSI: { operator: '<', value: 35 },
                MACD: { histogram: 'increasing' },
                aiSentiment: { operator: '>', value: 0.5 },
                combined: { score: { operator: '>', value: 0.7 } }
            },
            sellConditions: {
                RSI: { operator: '>', value: 65 },
                or: { aiSentiment: { operator: '<', value: 0 } }
            }
        },
        stopLossPercent: 5,
        takeProfitPercent: 15,
        maxPositionSize: 8000000,
        isBacktested: true,
        backtestReturn: 35.8,
        winRate: 64,
        sharpeRatio: 1.88
    },
    {
        name: '멀티타임프레임 전략',
        description: '여러 시간대 분석 결합. 일봉 추세 + 시봉 진입 타이밍 + AI 필터링.',
        type: 'HYBRID',
        config: {
            timeframes: ['1d', '4h', '1h'],
            technicalIndicators: {
                '1d': ['SMA_50', 'SMA_200'],
                '4h': ['RSI', 'MACD'],
                '1h': ['STOCHASTIC']
            },
            aiFilter: 'news_sentiment',
            buyConditions: {
                '1d': { trend: 'bullish', sma50: { operator: '>', value: 'sma200' } },
                '4h': { RSI: { operator: '<', value: 40 }, MACD: { histogram: 'positive' } },
                '1h': { stochastic: { K: { operator: '<', value: 20 } } },
                ai: { sentiment: { operator: '>', value: 0.3 } }
            },
            sellConditions: {
                '1d': { trend: 'bearish' },
                or: { takeProfit: true, stopLoss: true }
            }
        },
        stopLossPercent: 4,
        takeProfitPercent: 12,
        maxPositionSize: 7000000,
        isBacktested: true,
        backtestReturn: 31.2,
        winRate: 59,
        sharpeRatio: 1.72
    },
    {
        name: '스마트 베타 전략',
        description: '밸류, 모멘텀, 퀄리티 팩터 결합 + AI 최적화. 팩터 로테이션 자동화.',
        type: 'HYBRID',
        config: {
            factors: ['value', 'momentum', 'quality', 'size', 'volatility'],
            factorWeights: { value: 0.25, momentum: 0.30, quality: 0.25, size: 0.10, volatility: 0.10 },
            aiOptimizer: 'factor_rotation_model',
            rebalancePeriod: 'monthly',
            screening: {
                value: { PER: { operator: '<', value: 15 }, PBR: { operator: '<', value: 1.5 } },
                momentum: { return_6m: { operator: '>', value: 0.1 } },
                quality: { ROE: { operator: '>', value: 0.15 }, debtRatio: { operator: '<', value: 0.5 } }
            },
            buyConditions: {
                compositeScore: { operator: '>', value: 0.7 },
                aiApproval: true
            },
            sellConditions: {
                compositeScore: { operator: '<', value: 0.4 },
                or: { holdingMonths: { operator: '>', value: 6 } }
            }
        },
        stopLossPercent: 10,
        takeProfitPercent: 30,
        maxPositionSize: 20000000,
        isBacktested: true,
        backtestReturn: 48.5,
        winRate: 58,
        sharpeRatio: 2.05
    },
    {
        name: '그리드 트레이딩 전략',
        description: '가격 구간별 그리드 설정 후 자동 분할 매수/매도. 횡보장에서 수익 극대화.',
        type: 'HYBRID',
        config: {
            gridType: 'arithmetic',
            gridLevels: 10,
            gridSpacing: 0.02, // 2% per grid
            orderSize: 'equal',
            priceRange: {
                upper: { type: 'percent', value: 0.15 }, // +15% from current
                lower: { type: 'percent', value: -0.15 } // -15% from current
            },
            aiAdjustment: {
                enabled: true,
                model: 'volatility_predictor',
                adjustGridSpacing: true
            },
            riskManagement: {
                maxGrids: 10,
                totalInvestment: 10000000,
                stopLossPrice: { type: 'percent', value: -0.20 }
            }
        },
        stopLossPercent: 20,
        takeProfitPercent: 0, // Grid takes profit automatically
        maxPositionSize: 10000000,
        isBacktested: true,
        backtestReturn: 25.3,
        winRate: 72,
        sharpeRatio: 1.45
    },
    {
        name: 'DCA (Dollar Cost Averaging) 스마트 전략',
        description: '정기 적립 + AI 최적 매수 타이밍. 하락장에서 적극 매수, 상승장에서 보수적 매수.',
        type: 'HYBRID',
        config: {
            baseInterval: 'weekly',
            baseAmount: 500000,
            aiTiming: {
                enabled: true,
                model: 'market_regime_detector',
                adjustments: {
                    bear_market: { multiplier: 1.5, frequency: 'daily' },
                    neutral: { multiplier: 1.0, frequency: 'weekly' },
                    bull_market: { multiplier: 0.7, frequency: 'bi-weekly' }
                }
            },
            technicalFilter: {
                enabled: true,
                indicators: ['RSI', 'VIX'],
                buyBonus: { RSI: { operator: '<', value: 30 }, bonus: 0.5 }
            },
            sellConditions: {
                targetReturn: { operator: '>', value: 0.5 }, // 50% profit
                or: { holdingYears: { operator: '>', value: 3 } }
            }
        },
        stopLossPercent: 0, // DCA doesn't use stop loss
        takeProfitPercent: 50,
        maxPositionSize: 50000000,
        isBacktested: true,
        backtestReturn: 85.2,
        winRate: 78,
        sharpeRatio: 1.65
    },
    {
        name: '손절/익절 최적화 전략',
        description: 'ATR 기반 동적 손절/익절 + AI 청산 타이밍. 시장 변동성에 따라 자동 조정.',
        type: 'HYBRID',
        config: {
            entryIndicators: ['RSI', 'MACD', 'BOLLINGER_BANDS'],
            dynamicExits: {
                stopLoss: {
                    base: 'ATR',
                    multiplier: 2,
                    trailing: { enabled: true, atrMultiplier: 1.5 }
                },
                takeProfit: {
                    base: 'ATR',
                    multiplier: 3,
                    partial: [
                        { at: 0.5, sell: 0.3 }, // Sell 30% at 50% of target
                        { at: 1.0, sell: 0.5 }, // Sell 50% at target
                        { at: 1.5, sell: 0.2 }  // Sell remaining at 150% of target
                    ]
                }
            },
            aiExitOptimizer: {
                enabled: true,
                model: 'exit_timing_model',
                features: ['momentum', 'volume', 'sentiment']
            }
        },
        stopLossPercent: 0, // Dynamic ATR-based
        takeProfitPercent: 0, // Dynamic ATR-based
        maxPositionSize: 8000000,
        isBacktested: true,
        backtestReturn: 41.7,
        winRate: 56,
        sharpeRatio: 1.95
    }
];

async function main() {
    console.log('🌱 Starting database seed...');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await prisma.notification.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.aIReport.deleteMany();
    await prisma.news.deleteMany();
    await prisma.indicator.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.position.deleteMany();
    await prisma.portfolio.deleteMany();
    await prisma.candle.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.brokerAccount.deleteMany();
    await prisma.pushSubscription.deleteMany();
    await prisma.systemSettings.deleteMany();
    await prisma.user.deleteMany();

    // Create System Settings
    console.log('⚙️  Creating system settings...');
    const defaultSettings = [
        // API Keys
        { key: 'OPENDART_API_KEY', value: '', description: 'OpenDART API 키 (https://opendart.fss.or.kr/)', category: 'api', isSecret: true },
        { key: 'KIS_APP_KEY', value: '', description: '한국투자증권 App Key', category: 'api', isSecret: true },
        { key: 'KIS_APP_SECRET', value: '', description: '한국투자증권 App Secret', category: 'api', isSecret: true },
        { key: 'KIS_ACCOUNT_NUMBER', value: '', description: '한국투자증권 계좌번호', category: 'api', isSecret: true },
        { key: 'KIS_MOCK_MODE', value: 'true', description: '한국투자증권 모의투자 모드 사용', category: 'api', isSecret: false },
        { key: 'OPENAI_API_KEY', value: '', description: 'OpenAI API 키 (AI 분석용)', category: 'api', isSecret: true },
        { key: 'YAHOO_API_KEY', value: '', description: 'Yahoo Finance API 키 (선택)', category: 'api', isSecret: true },
        
        // Trading Settings
        { key: 'AUTO_TRADE_ENABLED', value: 'false', description: '자동매매 활성화', category: 'trading', isSecret: false },
        { key: 'MAX_DAILY_TRADES', value: '100', description: '일일 최대 거래 수', category: 'trading', isSecret: false },
        { key: 'DEFAULT_STOP_LOSS_PERCENT', value: '5', description: '기본 손절 비율 (%)', category: 'trading', isSecret: false },
        { key: 'DEFAULT_TAKE_PROFIT_PERCENT', value: '10', description: '기본 익절 비율 (%)', category: 'trading', isSecret: false },
        { key: 'MAX_POSITION_PERCENT', value: '20', description: '최대 포지션 비율 (%)', category: 'trading', isSecret: false },
        
        // Notification Settings
        { key: 'NOTIFICATION_ENABLED', value: 'true', description: '알림 활성화', category: 'notification', isSecret: false },
        { key: 'EMAIL_NOTIFICATION_ENABLED', value: 'false', description: '이메일 알림 활성화', category: 'notification', isSecret: false },
        { key: 'PUSH_NOTIFICATION_ENABLED', value: 'true', description: '푸시 알림 활성화', category: 'notification', isSecret: false },
        { key: 'SMTP_HOST', value: 'smtp.gmail.com', description: 'SMTP 서버 주소', category: 'notification', isSecret: false },
        { key: 'SMTP_PORT', value: '587', description: 'SMTP 포트', category: 'notification', isSecret: false },
        { key: 'SMTP_USER', value: '', description: 'SMTP 사용자 이메일', category: 'notification', isSecret: false },
        { key: 'SMTP_PASSWORD', value: '', description: 'SMTP 비밀번호', category: 'notification', isSecret: true },
        { key: 'VAPID_PUBLIC_KEY', value: '', description: 'VAPID 공개 키 (웹 푸시용)', category: 'notification', isSecret: false },
        { key: 'VAPID_PRIVATE_KEY', value: '', description: 'VAPID 비밀 키 (웹 푸시용)', category: 'notification', isSecret: true },
        
        // Data Collection Settings
        { key: 'DATA_COLLECTION_ENABLED', value: 'true', description: '데이터 수집 활성화', category: 'data', isSecret: false },
        { key: 'CANDLE_COLLECTION_INTERVAL', value: '1', description: '캔들 데이터 수집 간격 (분)', category: 'data', isSecret: false },
        { key: 'PRICE_UPDATE_INTERVAL', value: '5', description: '가격 업데이트 간격 (분)', category: 'data', isSecret: false },
        { key: 'NEWS_COLLECTION_ENABLED', value: 'true', description: '뉴스 수집 활성화', category: 'data', isSecret: false },
        
        // General Settings
        { key: 'MAINTENANCE_MODE', value: 'false', description: '유지보수 모드', category: 'general', isSecret: false },
        { key: 'DEBUG_MODE', value: 'false', description: '디버그 모드', category: 'general', isSecret: false },
        { key: 'LOG_LEVEL', value: 'info', description: '로그 레벨 (debug, info, warn, error)', category: 'general', isSecret: false },
        { key: 'SESSION_TIMEOUT', value: '7', description: '세션 만료 시간 (일)', category: 'general', isSecret: false },
        
        // Security Settings
        { key: 'MAX_LOGIN_ATTEMPTS', value: '5', description: '최대 로그인 시도 횟수', category: 'security', isSecret: false },
        { key: 'LOCKOUT_DURATION', value: '30', description: '계정 잠금 시간 (분)', category: 'security', isSecret: false },
        { key: 'REQUIRE_2FA', value: 'false', description: '2단계 인증 필수', category: 'security', isSecret: false },
    ];

    await prisma.systemSettings.createMany({
        data: defaultSettings,
    });
    console.log(`✅ Created ${defaultSettings.length} system settings`);


    // Create stocks first (Korean major stocks) - Extended list
    console.log('📈 Creating stocks...');
    const stocks = await Promise.all([
        prisma.stock.create({
            data: {
                symbol: '005930',
                name: '삼성전자',
                market: 'KOSPI',
                sector: '전기전자',
                currentPrice: 71000,
                openPrice: 70500,
                highPrice: 71500,
                lowPrice: 70000,
                volume: 15000000,
                marketCap: 4230000000000,
                isTradable: true,
            },
        }),
        prisma.stock.create({
            data: {
                symbol: '000660',
                name: 'SK하이닉스',
                market: 'KOSPI',
                sector: '반도체',
                currentPrice: 145000,
                openPrice: 143000,
                highPrice: 146000,
                lowPrice: 142500,
                volume: 8000000,
                marketCap: 1050000000000,
                isTradable: true,
            },
        }),
        prisma.stock.create({
            data: {
                symbol: '373220',
                name: 'LG에너지솔루션',
                market: 'KOSPI',
                sector: '전기전자',
                currentPrice: 420000,
                openPrice: 415000,
                highPrice: 425000,
                lowPrice: 413000,
                volume: 500000,
                marketCap: 980000000000,
                isTradable: true,
            },
        }),
        prisma.stock.create({
            data: {
                symbol: '035420',
                name: 'NAVER',
                market: 'KOSPI',
                sector: '서비스업',
                currentPrice: 235000,
                openPrice: 232000,
                highPrice: 237000,
                lowPrice: 231000,
                volume: 1200000,
                marketCap: 385000000000,
                isTradable: true,
            },
        }),
        prisma.stock.create({
            data: {
                symbol: '035720',
                name: '카카오',
                market: 'KOSPI',
                sector: '서비스업',
                currentPrice: 55000,
                openPrice: 54200,
                highPrice: 55800,
                lowPrice: 53900,
                volume: 3500000,
                marketCap: 245000000000,
                isTradable: true,
            },
        }),
        prisma.stock.create({
            data: {
                symbol: '005380',
                name: '현대차',
                market: 'KOSPI',
                sector: '운송장비',
                currentPrice: 245000,
                openPrice: 242000,
                highPrice: 248000,
                lowPrice: 240000,
                volume: 2500000,
                marketCap: 520000000000,
                isTradable: true,
            },
        }),
        prisma.stock.create({
            data: {
                symbol: '051910',
                name: 'LG화학',
                market: 'KOSPI',
                sector: '화학',
                currentPrice: 385000,
                openPrice: 380000,
                highPrice: 390000,
                lowPrice: 378000,
                volume: 450000,
                marketCap: 270000000000,
                isTradable: true,
            },
        }),
        prisma.stock.create({
            data: {
                symbol: '006400',
                name: '삼성SDI',
                market: 'KOSPI',
                sector: '전기전자',
                currentPrice: 405000,
                openPrice: 400000,
                highPrice: 410000,
                lowPrice: 398000,
                volume: 380000,
                marketCap: 280000000000,
                isTradable: true,
            },
        }),
    ]);

    console.log(`✅ Created ${stocks.length} stocks`);

    // Create test users
    console.log('👥 Creating users...');
    const passwordHash = await bcrypt.hash('password123', 10);

    const users = await Promise.all([
        // Admin user
        prisma.user.create({
            data: {
                email: 'admin@stockboom.com',
                passwordHash,
                name: '관리자',
                phone: '010-0000-0000',
                emailVerified: true,
                isActive: true,
            },
        }),
        // Regular users
        prisma.user.create({
            data: {
                email: 'trader1@example.com',
                passwordHash,
                name: '김투자',
                phone: '010-1234-5678',
                emailVerified: true,
                isActive: true,
            },
        }),
        prisma.user.create({
            data: {
                email: 'trader2@example.com',
                passwordHash,
                name: '이매매',
                phone: '010-2345-6789',
                emailVerified: true,
                isActive: true,
            },
        }),
        prisma.user.create({
            data: {
                email: 'trader3@example.com',
                passwordHash,
                name: '박자동',
                phone: '010-3456-7890',
                emailVerified: true,
                isActive: true,
            },
        }),
        prisma.user.create({
            data: {
                email: 'quant@example.com',
                passwordHash,
                name: '최퀀트',
                phone: '010-4567-8901',
                emailVerified: true,
                isActive: true,
            },
        }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create broker accounts and portfolios for all users (including admin)
    const portfolioMap: { [key: string]: any } = {};
    
    for (const [index, user] of users.entries()) {
        console.log(`\n💼 Setting up data for ${user.name}...`);

        // Create broker account
        const brokerAccount = await prisma.brokerAccount.create({
            data: {
                userId: user.id,
                broker: 'kis',
                accountNumber: `1234567${index + 1}01`,
                accountName: `${user.name}의 계좌`,
                appKey: 'mock_app_key_' + user.id,
                appSecret: 'mock_app_secret_' + user.id,
                isMockMode: true,
            },
        });

        // Create portfolio
        const initialCash = 10000000 + index * 5000000; // 1천만원 ~ 3천만원
        const portfolio = await prisma.portfolio.create({
            data: {
                userId: user.id,
                brokerAccountId: brokerAccount.id,
                name: `${user.name}의 포트폴리오`,
                description: '자동매매 포트폴리오',
                cashBalance: initialCash,
                totalValue: initialCash,
                totalReturn: 0,
                totalReturnPct: 0,
                autoTrade: index === 0, // First user has auto-trade enabled
            },
        });
        
        portfolioMap[user.id] = { portfolio, brokerAccount };

        // Create positions (different stocks for each user)
        const userStocks = stocks.slice(index % stocks.length, (index % stocks.length) + 3);
        for (const stock of userStocks) {
            const quantity = 10 + index * 5;
            const avgPrice = Number(stock.currentPrice) * 0.95; // Bought at 5% discount
            const totalCost = avgPrice * quantity;
            const marketValue = Number(stock.currentPrice) * quantity;
            const unrealizedPL = marketValue - totalCost;
            const unrealizedPLPct = (unrealizedPL / totalCost) * 100;

            await prisma.position.create({
                data: {
                    portfolioId: portfolio.id,
                    stockId: stock.id,
                    quantity,
                    avgPrice,
                    currentPrice: Number(stock.currentPrice),
                    totalCost,
                    marketValue,
                    unrealizedPL,
                    unrealizedPLPct,
                },
            });
        }

        // Create alerts
        const tradeStock = userStocks[0];
        if (tradeStock) {
            await Promise.all([
                prisma.alert.create({
                    data: {
                        userId: user.id,
                        type: 'PRICE_CHANGE',
                        name: `${tradeStock.name} 가격 알림`,
                        description: `${tradeStock.name}이 목표가에 도달했습니다`,
                        conditions: {
                            stockId: tradeStock.id,
                            condition: 'above',
                            targetPrice: Number(tradeStock.currentPrice) * 1.1,
                        },
                        webPush: true,
                        email: true,
                        isActive: true,
                    },
                }),
                prisma.alert.create({
                    data: {
                        userId: user.id,
                        type: 'INDICATOR_SIGNAL',
                        name: 'RSI 과매도 알림',
                        description: 'RSI가 30 이하로 떨어졌습니다',
                        conditions: {
                            indicator: 'RSI',
                            condition: 'below',
                            value: 30,
                        },
                        webPush: true,
                        email: false,
                        isActive: true,
                    },
                }),
            ]);
        }

        console.log(`✅ Created portfolio, positions, and alerts for ${user.name}`);
    }

    // Create diverse strategies from templates
    console.log('\n⚡ Creating trading strategies...');
    let strategyCount = 0;
    
    for (const [index, template] of strategyTemplates.entries()) {
        // Assign to different users
        const userIndex = index % users.length;
        const user = users[userIndex];
        const { portfolio } = portfolioMap[user.id];
        
        // Randomize some values for variety
        const isActive = index < 5 || Math.random() > 0.5; // First 5 are always active
        const backtestReturn = template.backtestReturn + (Math.random() - 0.5) * 10;
        const winRate = Math.min(85, Math.max(40, template.winRate + (Math.random() - 0.5) * 10));
        const sharpeRatio = template.sharpeRatio + (Math.random() - 0.5) * 0.5;
        
        const strategy = await prisma.strategy.create({
            data: {
                userId: user.id,
                portfolioId: portfolio.id,
                name: template.name,
                description: template.description,
                type: template.type as any,
                config: template.config,
                stopLossPercent: template.stopLossPercent,
                takeProfitPercent: template.takeProfitPercent,
                maxPositionSize: template.maxPositionSize,
                isActive,
                isBacktested: template.isBacktested,
                backtestReturn,
                winRate,
                sharpeRatio,
            },
        });

        // Create some trade history for active strategies
        if (isActive && index < 10) {
            const tradeStock = stocks[index % stocks.length];
            const { brokerAccount } = portfolioMap[user.id];
            
            // Create multiple trades for this strategy
            const numTrades = 2 + Math.floor(Math.random() * 5);
            for (let t = 0; t < numTrades; t++) {
                const isBuy = t % 2 === 0;
                const daysAgo = 1 + t * 2;
                const priceMultiplier = isBuy ? 0.98 : 1.03;
                
                await prisma.trade.create({
                    data: {
                        userId: user.id,
                        brokerAccountId: brokerAccount.id,
                        stockId: tradeStock.id,
                        strategyId: strategy.id,
                        orderType: isBuy ? 'MARKET' : 'LIMIT',
                        orderSide: isBuy ? 'BUY' : 'SELL',
                        status: 'FILLED',
                        quantity: 3 + Math.floor(Math.random() * 7),
                        filledQuantity: 3 + Math.floor(Math.random() * 7),
                        limitPrice: isBuy ? undefined : Number(tradeStock.currentPrice) * 1.05,
                        avgFillPrice: Number(tradeStock.currentPrice) * priceMultiplier,
                        totalAmount: Number(tradeStock.currentPrice) * priceMultiplier * (3 + Math.floor(Math.random() * 7)),
                        commission: 1000 + Math.floor(Math.random() * 2000),
                        tax: isBuy ? 0 : 500 + Math.floor(Math.random() * 1000),
                        isAutoTrade: true,
                        signalSource: template.type === 'AI_BASED' ? 'ai' : 'indicator',
                        filledAt: new Date(Date.now() - 86400000 * daysAgo),
                    },
                });
            }
        }

        strategyCount++;
    }
    
    console.log(`✅ Created ${strategyCount} trading strategies with trade history`);

    // Create some news articles
    console.log('\n📰 Creating news articles...');
    const samsungStock = stocks[0];
    await Promise.all([
        prisma.news.create({
            data: {
                stockId: samsungStock.id,
                title: '삼성전자, 신규 반도체 공장 건설 발표',
                content: '삼성전자가 평택에 20조원 규모의 신규 반도체 공장 건설을 발표했습니다. 이는 글로벌 반도체 수요 증가에 대응하기 위한 전략적 투자입니다.',
                source: '조선일보',
                url: 'https://example.com/news/1',
                author: '김기자',
                sentiment: 'POSITIVE',
                sentimentScore: 75,
                publishedAt: new Date(Date.now() - 3600000 * 5), // 5 hours ago
            },
        }),
        prisma.news.create({
            data: {
                stockId: stocks[1].id,
                title: 'SK하이닉스, HBM3 양산 본격화',
                content: 'SK하이닉스가 차세대 고대역폭 메모리 HBM3의 양산을 본격화한다고 밝혔습니다.',
                source: '한국경제',
                url: 'https://example.com/news/2',
                author: '이기자',
                sentiment: 'POSITIVE',
                sentimentScore: 80,
                publishedAt: new Date(Date.now() - 3600000 * 10), // 10 hours ago
            },
        }),
        prisma.news.create({
            data: {
                stockId: stocks[2].id,
                title: 'LG에너지솔루션, 북미 배터리 공장 가동 시작',
                content: 'LG에너지솔루션이 GM과 합작한 북미 배터리 공장이 본격 가동을 시작했습니다.',
                source: '매일경제',
                url: 'https://example.com/news/3',
                author: '박기자',
                sentiment: 'POSITIVE',
                sentimentScore: 72,
                publishedAt: new Date(Date.now() - 3600000 * 24), // 1 day ago
            },
        }),
    ]);

    // Create AI reports
    console.log('🤖 Creating AI analysis reports...');
    await prisma.aIReport.create({
        data: {
            stockId: samsungStock.id,
            analysisType: 'NEWS_SUMMARY',
            model: 'gpt-4',
            version: '1.0',
            results: {
                sentiment: 'POSITIVE',
                sentimentScore: 75,
                riskScore: 35,
                summary: '삼성전자의 신규 반도체 공장 건설 발표는 긍정적인 신호입니다.',
                recommendation: 'BUY',
                confidence: 80,
            },
            riskScore: 35,
            confidence: 80,
            summary: '삼성전자의 신규 투자는 장기적으로 긍정적인 영향을 미칠 것으로 예상됩니다.',
            recommendation: 'BUY',
            processingTime: 1250,
        },
    });

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - System Settings: ${defaultSettings.length}`);
    console.log(`   - Users: ${users.length} (1 admin + ${users.length - 1} regular)`);
    console.log(`   - Stocks: ${stocks.length}`);
    console.log(`   - Portfolios: ${users.length}`);
    console.log(`   - Total positions: ~${users.length * 3}`);
    console.log(`   - Strategies: ${strategyCount}`);
    console.log(`   - Alerts: ${users.length * 2}`);
    console.log(`   - News articles: 3`);
    console.log(`   - AI reports: 1`);
    console.log('\n📋 Strategy Types:');
    console.log(`   - INDICATOR_BASED: ${strategyTemplates.filter(s => s.type === 'INDICATOR_BASED').length}`);
    console.log(`   - AI_BASED: ${strategyTemplates.filter(s => s.type === 'AI_BASED').length}`);
    console.log(`   - HYBRID: ${strategyTemplates.filter(s => s.type === 'HYBRID').length}`);
    console.log('\n🔐 Test account credentials:');
    console.log('   Admin: admin@stockboom.com / password123');
    console.log('   Users: trader1@example.com, trader2@example.com, trader3@example.com, quant@example.com / password123');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
