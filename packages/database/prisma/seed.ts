import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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


    // Create stocks first (Korean major stocks)
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
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create broker accounts and portfolios for all users (including admin)
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
        const initialCash = 10000000 + index * 5000000; // 1천만원 ~ 2천만원
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

        // Create positions (different stocks for each user)
        const userStocks = stocks.slice(index, index + 3);
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

        // Create trading strategy
        const strategy = await prisma.strategy.create({
            data: {
                userId: user.id,
                portfolioId: portfolio.id,
                name: `${user.name}의 자동매매 전략`,
                description: 'RSI와 MACD 기반 매매 전략',
                type: 'INDICATOR_BASED',
                config: {
                    indicators: ['RSI', 'MACD'],
                    buyConditions: {
                        RSI: { operator: '<', value: 30 },
                        MACD: { operator: '>', value: 0 },
                    },
                    sellConditions: {
                        RSI: { operator: '>', value: 70 },
                        MACD: { operator: '<', value: 0 },
                    },
                },
                stopLossPercent: 5,
                takeProfitPercent: 10,
                maxPositionSize: 5000000,
                isActive: index === 0,
                isBacktested: true,
                backtestReturn: 15.5 + index * 3,
                winRate: 60 + index * 5,
                sharpeRatio: 1.2 + index * 0.3,
            },
        });

        // Create some trade history
        const tradeStock = userStocks[0];
        await Promise.all([
            prisma.trade.create({
                data: {
                    userId: user.id,
                    brokerAccountId: brokerAccount.id,
                    stockId: tradeStock.id,
                    strategyId: strategy.id,
                    orderType: 'MARKET',
                    orderSide: 'BUY',
                    status: 'FILLED',
                    quantity: 5,
                    filledQuantity: 5,
                    avgFillPrice: Number(tradeStock.currentPrice) * 0.98,
                    totalAmount: Number(tradeStock.currentPrice) * 0.98 * 5,
                    commission: 1500,
                    tax: 0,
                    isAutoTrade: true,
                    signalSource: 'indicator',
                    filledAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
                },
            }),
            prisma.trade.create({
                data: {
                    userId: user.id,
                    brokerAccountId: brokerAccount.id,
                    stockId: tradeStock.id,
                    strategyId: strategy.id,
                    orderType: 'LIMIT',
                    orderSide: 'SELL',
                    status: 'FILLED',
                    quantity: 3,
                    filledQuantity: 3,
                    limitPrice: Number(tradeStock.currentPrice) * 1.05,
                    avgFillPrice: Number(tradeStock.currentPrice) * 1.05,
                    totalAmount: Number(tradeStock.currentPrice) * 1.05 * 3,
                    commission: 1000,
                    tax: 750,
                    isAutoTrade: true,
                    signalSource: 'indicator',
                    filledAt: new Date(Date.now() - 86400000), // 1 day ago
                },
            }),
        ]);

        // Create alerts
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

        console.log(`✅ Created portfolio, positions, strategy, trades, and alerts for ${user.name}`);
    }

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
    console.log(`   - Total positions: ${users.length * 3}`);
    console.log(`   - Trades: ${users.length * 2}`);
    console.log(`   - Strategies: ${users.length}`);
    console.log(`   - Alerts: ${users.length * 2}`);
    console.log(`   - News articles: 2`);
    console.log(`   - AI reports: 1`);
    console.log('\n🔐 Test account credentials:');
    console.log('   Admin: admin@stockboom.com / password123');
    console.log('   Users: trader1@example.com, trader2@example.com, trader3@example.com / password123');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
