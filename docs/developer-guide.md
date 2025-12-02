# 개발자용 가이드 (Developer Guide)

## 목차
- [시스템 개요](#시스템-개요)
- [아키텍처](#아키텍처)
- [데이터베이스 설계](#데이터베이스-설계)
- [API 명세](#api-명세)
- [BullMQ 큐 구조](#bullmq-큐-구조)
- [AI 분석 모듈](#ai-분석-모듈)
- [개발 환경 설정](#개발-환경-설정)
- [코드 예시](#코드-예시)

---

## 시스템 개요

**StockBoom**은 주식 자동 수집·분석·매매·관리 시스템으로, 다음 기능을 제공합니다:

- 사용자별 주식 데이터 수집
- 포트폴리오 관리
- 기술적 지표 기반 분석
- AI 기반 매매 전략
- 실시간 알림 시스템

### 기술 스택

| 계층 | 기술 |
|------|------|
| **프론트엔드** | Next.js 14 (App Router), TypeScript, TailwindCSS, next-intl |
| **백엔드** | NestJS, Prisma ORM, Passport JWT |
| **큐/작업** | BullMQ, @nestjs/bull |
| **데이터베이스** | PostgreSQL 14+ |
| **캐시/메시지** | Redis 7+ |
| **컨테이너** | Docker, Docker Compose |
| **분석** | technicalindicators, custom AI modules |
| **알림** | Nodemailer, Web Push API |

---

## 아키텍처

### 시스템 구조도

```mermaid
graph TB
    subgraph "Frontend Layer"
        WEB[Next.js Web App<br/>Port 3000]
    end
    
    subgraph "Backend Layer"
        API[NestJS API Server<br/>Port 3001]
        WORKER[BullMQ Workers<br/>Port 3002]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Port 5432)]
        REDIS[(Redis<br/>Port 6379)]
    end
    
    subgraph "External Services"
        KIS[한국투자증권 API]
        YAHOO[Yahoo Finance API]
        SMTP[Email SMTP]
    end
    
    WEB -->|HTTP/REST| API
    API -->|Prisma| PG
    API -->|BullMQ| REDIS
    WORKER -->|BullMQ| REDIS
    WORKER -->|Prisma| PG
    API -->|OAuth| KIS
    API -->|REST| YAHOO
    WORKER -->|Send Email| SMTP
    
    style WEB fill:#4F46E5
    style API fill:#10B981
    style WORKER fill:#F59E0B
    style PG fill:#3B82F6
    style REDIS fill:#EF4444
```

### 모듈 구조

```mermaid
graph LR
    subgraph "NestJS Modules"
        AUTH[Auth Module]
        USER[Users Module]
        STOCK[Stocks Module]
        PORT[Portfolios Module]
        TRADE[Trades Module]
        ANALYSIS[Analysis Module]
        STRATEGY[Strategies Module]
        ALERT[Alerts Module]
        NOTIF[Notifications Module]
        MARKET[Market Data Module]
        AI[AI Module]
        QUEUE[Queue Module]
    end
    
    AUTH --> USER
    PORT --> USER
    TRADE --> PORT
    TRADE --> STOCK
    ANALYSIS --> STOCK
    STRATEGY --> USER
    ALERT --> USER
    NOTIF --> ALERT
    MARKET --> STOCK
    AI --> STOCK
    QUEUE --> REDIS[(Redis)]
```

### 데이터 흐름

```mermaid
sequenceDiagram
    participant User
    participant Web
    participant API
    participant Queue
    participant Worker
    participant DB
    participant External
    
    User->>Web: 로그인
    Web->>API: POST /auth/login
    API->>DB: 사용자 조회
    DB-->>API: 사용자 정보
    API-->>Web: JWT Token
    
    User->>Web: 종목 추가
    Web->>API: POST /portfolios/:id/positions
    API->>Queue: 데이터 수집 작업 추가
    API-->>Web: 201 Created
    
    Queue->>Worker: 작업 처리
    Worker->>External: 시세 조회
    External-->>Worker: OHLCV 데이터
    Worker->>DB: 캔들 데이터 저장
    
    Worker->>Queue: 분석 작업 추가
    Queue->>Worker: 분석 처리
    Worker->>DB: 지표 계산 및 저장
    Worker->>DB: 신호 생성
```

---

## 데이터베이스 설계

### ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    User ||--o{ BrokerAccount : has
    User ||--o{ Portfolio : owns
    User ||--o{ Strategy : creates
    User ||--o{ Alert : sets
    User ||--o{ Notification : receives
    User ||--o{ Trade : executes
    User ||--o{ PushSubscription : has
    
    BrokerAccount ||--o{ Portfolio : manages
    BrokerAccount ||--o{ Trade : executes
    
    Stock ||--o{ Position : contains
    Stock ||--o{ Candle : has
    Stock ||--o{ Indicator : has
    Stock ||--o{ News : relates
    Stock ||--o{ AIReport : analyzes
    Stock ||--o{ Trade : traded
    
    Portfolio ||--o{ Position : holds
    Portfolio ||--o{ Strategy : applies
    
    Strategy ||--o{ Trade : generates
    
    Alert ||--o{ Notification : triggers
    
    News ||--o{ AIReport : sources
```

### 주요 테이블 스키마

#### Users 테이블
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
```

#### Stocks 테이블
```sql
CREATE TABLE stocks (
    id TEXT PRIMARY KEY,
    symbol TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    market TEXT NOT NULL,
    sector TEXT,
    current_price DECIMAL(15,2),
    open_price DECIMAL(15,2),
    high_price DECIMAL(15,2),
    low_price DECIMAL(15,2),
    volume BIGINT,
    market_cap BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    is_tradable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_price_update TIMESTAMP
);

CREATE INDEX idx_stocks_symbol ON stocks(symbol);
CREATE INDEX idx_stocks_market ON stocks(market);
CREATE INDEX idx_stocks_is_active ON stocks(is_active, is_tradable);
```

#### Candles 테이블 (OHLCV)
```sql
CREATE TABLE candles (
    id TEXT PRIMARY KEY,
    stock_id TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    timeframe TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    open DECIMAL(15,2) NOT NULL,
    high DECIMAL(15,2) NOT NULL,
    low DECIMAL(15,2) NOT NULL,
    close DECIMAL(15,2) NOT NULL,
    volume BIGINT NOT NULL,
    amount DECIMAL(20,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(stock_id, timeframe, timestamp)
);

CREATE INDEX idx_candles_stock_timeframe ON candles(stock_id, timeframe, timestamp DESC);
```

#### Trades 테이블
```sql
CREATE TABLE trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker_account_id TEXT NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
    stock_id TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    strategy_id TEXT REFERENCES strategies(id) ON DELETE SET NULL,
    order_type TEXT NOT NULL,
    order_side TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    quantity INT NOT NULL,
    filled_quantity INT DEFAULT 0,
    limit_price DECIMAL(15,2),
    stop_price DECIMAL(15,2),
    avg_fill_price DECIMAL(15,2),
    total_amount DECIMAL(20,2),
    commission DECIMAL(20,2),
    tax DECIMAL(20,2),
    broker_order_id TEXT,
    broker_trade_id TEXT,
    is_auto_trade BOOLEAN DEFAULT FALSE,
    signal_source TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP,
    filled_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    failure_reason TEXT,
    retry_count INT DEFAULT 0
);

CREATE INDEX idx_trades_user ON trades(user_id, created_at DESC);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_stock ON trades(stock_id);
```

### 인덱스 최적화 전략

| 테이블 | 인덱스 | 목적 |
|--------|--------|------|
| `candles` | `(stock_id, timeframe, timestamp DESC)` | 차트 데이터 조회 최적화 |
| `indicators` | `(stock_id, type, timeframe, timestamp DESC)` | 지표 데이터 조회 최적화 |
| `trades` | `(user_id, created_at DESC)` | 사용자별 거래 이력 조회 |
| `trades` | `(status)` | 주문 상태별 필터링 |
| `notifications` | `(user_id, created_at DESC)` | 알림 목록 조회 |
| `notifications` | `(is_read)` | 미읽음 알림 조회 |

---

## API 명세

### 인증 시스템

#### JWT 인증 흐름

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    
    Client->>API: POST /auth/login
    API->>DB: 사용자 조회
    DB-->>API: 사용자 정보
    API->>API: 비밀번호 검증 (bcrypt)
    API->>API: JWT 생성
    API-->>Client: { access_token, user }
    
    Client->>API: GET /portfolios (Bearer Token)
    API->>API: JWT 검증
    API->>DB: 포트폴리오 조회
    DB-->>API: 포트폴리오 목록
    API-->>Client: 200 OK
```

#### 주요 엔드포인트

**1. 회원가입**
```typescript
// POST /api/auth/register
interface RegisterDto {
  email: string;       // 이메일 (unique)
  password: string;    // 최소 6자
  name?: string;       // 이름
  phone?: string;      // 전화번호
}

// Response
interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}
```

**2. 로그인**
```typescript
// POST /api/auth/login
interface LoginDto {
  email: string;
  password: string;
}

// Response: AuthResponse
```

**3. 2FA 설정**
```typescript
// POST /api/auth/2fa/setup
// Headers: Authorization: Bearer <token>

// Response
interface TwoFactorSetupResponse {
  secret: string;      // TOTP secret
  qrCode: string;      // QR code (base64)
}
```

### 종목 API

```typescript
// GET /api/stocks?market=KOSPI&page=1&limit=20
interface GetStocksQuery {
  market?: 'KOSPI' | 'KOSDAQ' | 'KONEX';
  page?: number;
  limit?: number;
}

// GET /api/stocks/:symbol/quote
interface StockQuote {
  symbol: string;
  name: string;
  currentPrice: number;
  changePrice: number;
  changeRate: number;
  volume: number;
  high: number;
  low: number;
  timestamp: string;
}
```

### 포트폴리오 API

```typescript
// POST /api/portfolios
interface CreatePortfolioDto {
  name: string;
  description?: string;
  brokerAccountId: string;
  cashBalance: number;
}

// POST /api/portfolios/:id/positions
interface CreatePositionDto {
  stockId: string;
  quantity: number;
  avgPrice: number;
}

// POST /api/portfolios/:id/valuation
// 실시간 평가금액 계산
interface ValuationResponse {
  totalValue: number;
  positions: Array<{
    stockId: string;
    symbol: string;
    name: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPct: number;
  }>;
}
```

### 거래 API

```typescript
// POST /api/trades
interface CreateTradeDto {
  brokerAccountId: string;
  stockId: string;
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  orderSide: 'BUY' | 'SELL';
  quantity: number;
  limitPrice?: number;   // LIMIT 주문시 필수
  stopPrice?: number;    // STOP_LOSS 주문시 필수
}

// Response
interface Trade {
  id: string;
  status: 'PENDING' | 'SUBMITTED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  orderType: string;
  orderSide: string;
  quantity: number;
  filledQuantity: number;
  avgFillPrice: number | null;
  createdAt: string;
  submittedAt: string | null;
  filledAt: string | null;
}
```

### 분석 API

```typescript
// POST /api/analysis/stocks/:id/analyze?timeframe=1d
interface AnalysisResponse {
  stock: {
    symbol: string;
    name: string;
  };
  signal: {
    signal: 'BUY' | 'SELL' | 'HOLD' | 'STRONG_BUY' | 'STRONG_SELL';
    strength: number; // 0-100
  };
  indicators: {
    SMA?: { value: number; signal: string };
    EMA?: { value: number; signal: string };
    RSI?: { value: number; signal: string };
    MACD?: { macd: number; signal: number; histogram: number; };
    STOCH?: { k: number; d: number; signal: string };
    BB?: { upper: number; middle: number; lower: number; };
  };
}
```

---

## BullMQ 큐 구조

### 큐 작업 흐름

```mermaid
graph LR
    subgraph "Producer (API)"
        API[NestJS API]
    end
    
    subgraph "Queue (Redis)"
        COLLECT_Q[data-collection Queue]
        ANALYZE_Q[data-analysis Queue]
        TRADE_Q[trade-execution Queue]
        NOTIFY_Q[notification Queue]
    end
    
    subgraph "Consumer (Worker)"
        COLLECT_W[Collection Worker]
        ANALYZE_W[Analysis Worker]
        TRADE_W[Trade Worker]
        NOTIFY_W[Notification Worker]
    end
    
    API -->|Add Job| COLLECT_Q
    API -->|Add Job| TRADE_Q
    
    COLLECT_Q -->|Process| COLLECT_W
    COLLECT_W -->|Complete| ANALYZE_Q
    
    ANALYZE_Q -->|Process| ANALYZE_W
    ANALYZE_W -->|Signal| TRADE_Q
    ANALYZE_W -->|Alert| NOTIFY_Q
    
    TRADE_Q -->|Process| TRADE_W
    TRADE_W -->|Complete| NOTIFY_Q
    
    NOTIFY_Q -->|Process| NOTIFY_W
```

### 큐 정의

**1. data-collection 큐**
```typescript
// apps/worker/src/queues/data-collection.processor.ts
interface CollectStockDataJob {
  stockId: string;
  symbol: string;
  timeframes: string[];  // ['1d', '1h', '5m']
  source: 'kis' | 'yahoo' | 'both';
}

@Processor('data-collection')
export class DataCollectionProcessor {
  @Process('collect-stock-data')
  async handleCollectStockData(job: Job<CollectStockDataJob>) {
    const { stockId, symbol, timeframes, source } = job.data;
    
    for (const timeframe of timeframes) {
      // 1. Fetch data from external API
      const candles = await this.fetchCandles(symbol, timeframe, source);
      
      // 2. Save to database
      await this.saveCandles(stockId, candles, timeframe);
      
      // 3. Update progress
      await job.updateProgress(50);
    }
    
    // 4. Trigger analysis
    await this.analysisQueue.add('analyze-indicators', {
      stockId,
      timeframes,
    });
    
    return { success: true, candlesCount: candles.length };
  }
}
```

**2. data-analysis 큐**
```typescript
interface AnalyzeIndicatorsJob {
  stockId: string;
  timeframes: string[];
}

@Processor('data-analysis')
export class DataAnalysisProcessor {
  @Process('analyze-indicators')
  async handleAnalyzeIndicators(job: Job<AnalyzeIndicatorsJob>) {
    const { stockId, timeframes } = job.data;
    
    for (const timeframe of timeframes) {
      // 1. Get candles
      const candles = await this.getCandles(stockId, timeframe, 200);
      
      // 2. Calculate indicators
      const indicators = await this.calculateIndicators(candles);
      
      // 3. Generate signals
      const signal = this.generateSignal(indicators);
      
      // 4. Save indicators
      await this.saveIndicators(stockId, timeframe, indicators, signal);
      
      // 5. Check alerts
      await this.checkAlerts(stockId, signal);
    }
    
    return { success: true };
  }
}
```

**3. trade-execution 큐**
```typescript
interface ExecuteTradeJob {
  tradeId: string;
  userId: string;
  brokerAccountId: string;
  stockSymbol: string;
  orderType: string;
  orderSide: string;
  quantity: number;
  limitPrice?: number;
}

@Processor('trade-execution')
export class TradeExecutionProcessor {
  @Process('execute-trade')
  async handleExecuteTrade(job: Job<ExecuteTradeJob>) {
    const { tradeId, brokerAccountId, stockSymbol, ...orderData } = job.data;
    
    try {
      // 1. Get broker credentials
      const account = await this.getBrokerAccount(brokerAccountId);
      
      // 2. Execute order via KIS API
      const result = await this.kisApiService.placeOrder(account, {
        symbol: stockSymbol,
        ...orderData,
      });
      
      // 3. Update trade status
      await this.updateTrade(tradeId, {
        status: 'SUBMITTED',
        brokerOrderId: result.orderId,
        submittedAt: new Date(),
      });
      
      // 4. Send notification
      await this.notificationQueue.add('send-notification', {
        userId: job.data.userId,
        type: 'TRADE_EXECUTION',
        title: '주문 체결',
        message: `${stockSymbol} ${orderData.orderSide} 주문이 체결되었습니다.`,
      });
      
      return { success: true, orderId: result.orderId };
    } catch (error) {
      // Retry logic
      await this.handleTradeFailure(tradeId, error);
      throw error;
    }
  }
}
```

### 재시도 정책

```typescript
// apps/api/src/queue/queue.module.ts
BullModule.registerQueue({
  name: 'trade-execution',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});
```

---

## AI 분석 모듈

### AI 모듈 구조

```mermaid
graph TB
    INPUT[Input Data]
    
    subgraph "AI Analysis Pipeline"
        PREPROCESS[Data Preprocessing]
        PATTERN[Pattern Detection]
        SENTIMENT[Sentiment Analysis]
        RISK[Risk Scoring]
        RECOMMEND[Recommendation Engine]
    end
    
    OUTPUT[AI Report]
    
    INPUT --> PREPROCESS
    PREPROCESS --> PATTERN
    PREPROCESS --> SENTIMENT
    PREPROCESS --> RISK
    
    PATTERN --> RECOMMEND
    SENTIMENT --> RECOMMEND
    RISK --> RECOMMEND
    
    RECOMMEND --> OUTPUT
```

### Pattern Detection Service

```typescript
// apps/api/src/ai/pattern-detection.service.ts
@Injectable()
export class PatternDetectionService {
  async detectPatterns(candles: Candle[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    
    // 1. Head and Shoulders
    const headAndShoulders = this.detectHeadAndShoulders(candles);
    if (headAndShoulders) patterns.push(headAndShoulders);
    
    // 2. Double Top/Bottom
    const doublePattern = this.detectDoublePattern(candles);
    if (doublePattern) patterns.push(doublePattern);
    
    // 3. Triangle Pattern
    const triangle = this.detectTriangle(candles);
    if (triangle) patterns.push(triangle);
    
    return patterns;
  }
  
  private detectHeadAndShoulders(candles: Candle[]): Pattern | null {
    // Simple pattern detection logic
    const peaks = this.findPeaks(candles);
    
    if (peaks.length >= 3) {
      const [left, head, right] = peaks.slice(-3);
      
      if (head.high > left.high && head.high > right.high &&
          Math.abs(left.high - right.high) / left.high < 0.02) {
        return {
          type: 'HEAD_AND_SHOULDERS',
          confidence: 0.75,
          signal: 'BEARISH',
          description: 'Head and Shoulders pattern detected',
        };
      }
    }
    
    return null;
  }
}
```

### AI Report Schema

```typescript
interface AIReportResult {
  analysisType:'NEWS_SUMMARY' | 'RISK_SCORE' | 'PATTERN_DETECTION' | 'PORTFOLIO_OPT';
  model: string;
  results: {
    patterns?: Pattern[];
    sentiment?: {
      score: number;
      label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    };
    riskScore?: number;
    recommendations?: Recommendation[];
  };
  riskScore: number;
  confidence: number;
  summary: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
}
```

---

## 개발 환경 설정

### 로컬 개발 환경

**1. 필수 도구 설치**
```bash
# Node.js 18+ 설치
node --version  # v18.0.0+

# pnpm 설치
npm install -g pnpm

# Docker Desktop 설치 (Windows/Mac)
docker --version
docker-compose --version
```

**2. 프로젝트 클론 및 설치**
```bash
# 프로젝트 클론
git clone <repository-url>
cd stockboom

# 의존성 설치
pnpm install
```

**3. 환경 변수 설정**
```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 수정
DATABASE_URL="postgresql://postgres:password@localhost:5432/stockboom"
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRATION="7d"

# 한국투자증권 API
KIS_APP_KEY="your-kis-app-key"
KIS_APP_SECRET="your-kis-app-secret"
KIS_BASE_URL="https://openapi.koreainvestment.com:9443"
KIS_ACCOUNT_NUMBER="your-account-number"

# Email (Nodemailer)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Frontend URL
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
```

**4. 데이터베이스 설정**
```bash
# Docker Compose로 PostgreSQL, Redis 시작
docker compose -f docker/docker-compose.dev.yml up -d

# Prisma 마이그레이션
cd packages/database
pnpm db:generate
pnpm db:push

# 시드 데이터 (선택사항)
pnpm db:seed
```

**5. 개발 서버 실행**
```bash
# Terminal 1 - API Server
cd apps/api
pnpm dev
# Running on http://localhost:3001

# Terminal 2 - Worker
cd apps/worker
pnpm dev

# Terminal 3 - Web Frontend
cd apps/web
pnpm dev
# Running on http://localhost:3000
```

### Docker Compose 개발 환경

```yaml
# docker/docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: stockboom
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  bullmq-dashboard:
    image: stee1cat/bull-board:latest
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    ports:
      - "3003:3000"
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
```

---

## 코드 예시

### 신규 종목 수집 → 분석 → 매매 전체 흐름

```typescript
// 예시: 삼성전자 추가 및 자동 매매

// 1. 종목 검색 및 추가
const searchResult = await fetch('/api/stocks/search?q=삼성전자');
const { database, external } = await searchResult.json();
const samsung = external[0]; // { symbol: '005930', name: '삼성전자' }

// 2. DB에 종목 추가
const createStockResponse = await fetch('/api/stocks', {
  method: 'POST',
  body: JSON.stringify({
    symbol: samsung.symbol,
    name: samsung.name,
    market: 'KOSPI',
  }),
});
const stock = await createStockResponse.json();

// 3. 데이터 수집 작업 추가 (BullMQ)
await dataCollectionQueue.add('collect-stock-data', {
  stockId: stock.id,
  symbol: stock.symbol,
  timeframes: ['1d', '1h', '5m'],
  source: 'both',
});

// 4. 분석 완료 후 자동으로 지표 계산됨 (Worker)

// 5. 전략 생성
const strategy = await fetch('/api/strategies', {
  method: 'POST',
  body: JSON.stringify({
    name: 'RSI 과매도 전략',
    type: 'INDICATOR_BASED',
    config: {
      indicator: 'RSI',
      oversold: 30,
      overbought: 70,
      timeframe: '1d',
    },
    stopLossPercent: 5,
    takeProfitPercent: 10,
  }),
});

// 6. 전략 평가 (현재 매수/매도 신호 확인)
const evaluation = await fetch(`/api/strategies/${strategy.id}/evaluate/${stock.id}`);
const { signal, strength, reason } = await evaluation.json();

// 7. 자동 매매 실행
if (signal === 'BUY' && strength >= 70) {
  const trade = await fetch('/api/trades', {
    method: 'POST',
    body: JSON.stringify({
      brokerAccountId: 'account-id',
      stockId: stock.id,
      orderType: 'LIMIT',
      orderSide: 'BUY',
      quantity: 10,
      limitPrice: 70000,
    }),
  });
}
```

### NestJS 컨트롤러 예시

```typescript
// apps/api/src/portfolios/portfolios.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PortfoliosService } from './portfolios.service';

@Controller('portfolios')
@UseGuards(JwtAuthGuard)
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.portfoliosService.findAllByUser(user.userId);
  }

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() createDto: CreatePortfolioDto,
  ) {
    return this.portfoliosService.create({
      ...createDto,
      userId: user.userId,
    });
  }

  @Post(':id/valuation')
  async calculateValuation(@Param('id') id: string) {
    return this.portfoliosService.calculateValuation(id);
  }
}
```

### Next.js App Router 페이지 예시

```typescript
// apps/web/src/app/[locale]/dashboard/portfolios/page.tsx
import { getTranslations } from 'next-intl/server';
import { PortfolioList } from '@/components/PortfolioList';

export default async function PortfoliosPage({ 
  params: { locale } 
}: { 
  params: { locale: string } 
}) {
  const t = await getTranslations('portfolios');
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <PortfolioList />
    </div>
  );
}
```

```typescript
// apps/web/src/components/PortfolioList.tsx
'use client';

import { useEffect, useState } from 'react';
import { fetchPortfolios } from '@/lib/api';

export function PortfolioList() {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function load() {
      const data = await fetchPortfolios();
      setPortfolios(data);
      setLoading(false);
    }
    load();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="grid gap-4">
      {portfolios.map(portfolio => (
        <PortfolioCard key={portfolio.id} portfolio={portfolio} />
      ))}
    </div>
  );
}
```

---

## 배포 가이드

### Docker Compose 프로덕션 배포

```bash
# 프로덕션 빌드
pnpm build

# Docker Compose로 전체 스택 실행
docker compose -f docker/docker-compose.yml up -d

# 로그 확인
docker compose logs -f api worker web
```

### 환경별 설정 관리

| 환경 | 파일 | 용도 |
|------|------|------|
| **Development** | `.env.development` | 로컬 개발 |
| **Staging** | `.env.staging` | 스테이징 서버 |
| **Production** | `.env.production` | 프로덕션 배포 |

---

## 테스트

### Unit Test
```bash
# API 테스트
cd apps/api
pnpm test

# Coverage
pnpm test:cov
```

### E2E Test
```bash
cd apps/api
pnpm test:e2e
```

---

## 문제 해결

### 일반적인 문제

**1. Prisma Client 생성 오류**
```bash
cd packages/database
pnpm db:generate
```

**2. Redis 연결 실패**
```bash
# Redis 실행 확인
docker ps | grep redis

# Redis 재시작
docker compose -f docker/docker-compose.dev.yml restart redis
```

**3. KIS API 토큰 만료**
```bash
# 토큰 자동 갱신 로직이 있지만, 수동으로 갱신:
curl -X POST http://localhost:3001/api/market-data/kis/refresh-token
```

---

**개발 관련 문의**: 개발팀에 문의하세요.
