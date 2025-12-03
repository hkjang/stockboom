# StockBoom 종목 데이터 소스 가이드

## 개요

StockBoom은 다중 데이터 소스를 활용하여 종목 정보를 수집하고 관리합니다. 이 문서는 종목 데이터가 어디서 오는지, 어떻게 수집되고 저장되는지를 설명합니다.

## 데이터 소스

### 1. 한국투자증권 API (KIS API)

**용도**: 한국 주식 시장 데이터 (KOSPI, KOSDAQ)

**담당 서비스**: [`apps/api/src/market-data/kis-api.service.ts`](file:///c:/Users/USER/projects/stockboom/apps/api/src/market-data/kis-api.service.ts)

**주요 기능**:
- 실시간 호가 조회
- 캔들 데이터 수집 (분봉, 일봉 등)
- 포트폴리오 데이터 조회
- 주문 실행 (매수/매도)

**인증 방식**:
- App Key & App Secret (환경 변수로 관리)
- OAuth 2.0 토큰 기반 인증
- 토큰 자동 갱신 지원

**데이터 형식**:
```typescript
{
  symbol: '005930',      // 종목 코드 (6자리)
  name: '삼성전자',
  currentPrice: 71000,
  open: 70500,
  high: 71500,
  low: 70000,
  volume: 15000000
}
```

### 2. Yahoo Finance API

**용도**: 
- 국제 주식 데이터
- KIS API 장애 시 백업 소스
- 종목 검색

**담당 서비스**: [`apps/api/src/market-data/yahoo-finance.service.ts`](file:///c:/Users/USER/projects/stockboom/apps/api/src/market-data/yahoo-finance.service.ts)

**주요 기능**:
- 글로벌 주식 시세 조회
- 역사적 캔들 데이터
- 시장 지수 정보 (S&P 500, NASDAQ 등)
- 종목 검색

**한국 종목 심볼 변환**:
```typescript
// KOSPI: 종목코드 + .KS
'005930' → '005930.KS' (삼성전자)

// KOSDAQ: 종목코드 + .KQ
'035720' → '035720.KQ' (카카오)
```

### 3. 통합 데이터 서비스

**담당 서비스**: [`apps/api/src/market-data/market-data.service.ts`](file:///c:/Users/USER/projects/stockboom/apps/api/src/market-data/market-data.service.ts)

**역할**: 여러 데이터 소스를 통합하여 최적의 소스 자동 선택

**우선순위 로직**:
```mermaid
graph TD
    A[종목 조회 요청] --> B{시장 구분}
    B -->|KOSPI/KOSDAQ| C[KIS API 시도]
    C -->|성공| D[KIS 데이터 반환]
    C -->|실패| E[Yahoo Finance 시도]
    B -->|기타| E
    E -->|성공| F[Yahoo 데이터 반환]
    E -->|실패| G[에러 반환]
```

## 데이터 수집 프로세스

### 자동 수집 스케줄러

**담당 파일**: [`apps/api/src/schedulers/data-collection.scheduler.ts`](file:///c:/Users/USER/projects/stockboom/apps/api/src/schedulers/data-collection.scheduler.ts)

**수집 주기**:
| 시간대 | 주기 | Cron 표현식 |
|--------|------|-------------|
| 1분봉 | 매 1분 | `*/1 * * * *` |
| 5분봉 | 매 5분 | `*/5 * * * *` |
| 15분봉 | 매 15분 | `*/15 * * * *` |
| 1시간봉 | 매 1시간 | `0 * * * *` |
| 일봉 | 평일 오후 6시 (장 마감 후) | `0 18 * * 1-5` |
| 주봉 | 매주 월요일 오후 6시 | `0 18 * * 1` |

**수집 워크플로우**:
1. 스케줄러가 트리거됨
2. 활성화된 거래 가능 종목 조회 (`isActive=true`, `isTradable=true`)
3. 각 종목에 대해 BullMQ 작업 큐에 추가
4. 워커가 비동기로 데이터 수집 처리
5. Prisma를 통해 DB에 저장 (upsert)

## 데이터 저장 구조

### Stock 테이블

**경로**: [`packages/database/prisma/schema.prisma`](file:///c:/Users/USER/projects/stockboom/packages/database/prisma/schema.prisma)

```prisma
model Stock {
  id              String   @id @default(uuid())
  symbol          String   @unique  // 종목 코드
  name            String            // 종목명
  market          String            // KOSPI, KOSDAQ, NYSE 등
  sector          String?           // 섹터
  currentPrice    Float
  openPrice       Float?
  highPrice       Float?
  lowPrice        Float?
  volume          BigInt?
  marketCap       BigInt?
  isTradable      Boolean  @default(true)
  isActive        Boolean  @default(true)
  lastPriceUpdate DateTime?
}
```

### Candle 테이블 (캔들 데이터)

```prisma
model Candle {
  id         String   @id @default(uuid())
  stockId    String
  timeframe  String   // 1m, 5m, 15m, 1h, 1d, 1w
  timestamp  DateTime
  open       Float
  high       Float
  low        Float
  close      Float
  volume     BigInt
  
  @@unique([stockId, timeframe, timestamp])
}
```

## API 엔드포인트

### 종목 조회

```http
GET /api/stocks
Authorization: Bearer {token}

Query Parameters:
- search: 검색어 (종목명 또는 코드)
- skip: 페이지네이션 오프셋
- take: 반환 개수
```

**응답 예시**:
```json
{
  "database": [
    {
      "id": "uuid",
      "symbol": "005930",
      "name": "삼성전자",
      "currentPrice": 71000,
      "market": "KOSPI"
    }
  ],
  "external": [
    // Yahoo Finance 검색 결과  
  ]
}
```

### 실시간 시세 조회

```http
GET /api/stocks/:symbol/quote
Authorization: Bearer {token}
```

## 초기 데이터 세팅

### Seed 데이터

**파일**: [`packages/database/prisma/seed.ts`](file:///c:/Users/USER/projects/stockboom/packages/database/prisma/seed.ts)

**기본 제공 종목** (5개):
1. **005930** - 삼성전자 (KOSPI)
2. **000660** - SK하이닉스 (KOSPI)
3. **373220** - LG에너지솔루션 (KOSPI)
4. **035420** - NAVER (KOSPI)
5. **035720** - 카카오 (KOSPI)

**시드 실행 명령어**:
```bash
pnpm --filter database db:seed
```

## 새로운 종목 추가 방법

### 1. 수동 추가 (Admin API)

```http
POST /api/stocks
Authorization: Bearer {token}
Content-Type: application/json

{
  "symbol": "005380",
  "name": "현대차",
  "market": "KOSPI",
  "sector": "운수장비",
  "isTradable": true
}
```

### 2. 자동 추가 (검색 시)

프론트엔드에서 종목 검색 시:
1. 데이터베이스에서 먼저 검색
2. 없으면 Yahoo Finance에서 검색
3. 사용자가 선택하면 자동으로 DB에 추가

### 3. 대량 추가 (스크립트)

```typescript
// scripts/import-stocks.ts
const stocks = [
  { symbol: '005380', name: '현대차', market: 'KOSPI' },
  // ... 더 많은 종목
];

for (const stock of stocks) {
  await prisma.stock.create({ data: stock });
}
```

## 환경 변수 설정

### .env 파일

```bash
# 한국투자증권 API
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
KIS_BASE_URL=https://openapivts.koreainvestment.com:29443

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/stockboom
```

## 트러블슈팅

### 종목 데이터가 업데이트되지 않을 때

1. **BullMQ 큐 상태 확인**:
   - Admin 페이지 → 시스템 모니터링 → 큐 상태
   - `data-collection` 큐의 실패 작업 확인

2. **API 키 확인**:
   - KIS API 키가 유효한지 확인
   - 토큰 갱신 로그 확인

3. **로그 확인**:
   ```bash
   # API 서버 로그
   # MarketDataService, DataCollectionScheduler 로그 확인
   ```

### 특정 종목만 조회 안 될 때

1. **데이터베이스에 종목 존재 여부 확인**:
   ```sql
   SELECT * FROM "Stock" WHERE symbol = '005930';
   ```

2. **isActive, isTradable 플래그 확인**:
   ```sql
   UPDATE "Stock" 
   SET "isActive" = true, "isTradable" = true  
   WHERE symbol = '005930';
   ```

## 참고 문서

- [한국투자증권 Open API 가이드](https://apiportal.koreainvestment.com/)
- [Yahoo Finance API](https://www.yahoofinanceapi.com/)
- [BullMQ 문서](https://docs.bullmq.io/)
- [Prisma 문서](https://www.prisma.io/docs)

## 라이선스 & 주의사항

> [!WARNING]
> - 한국투자증권 API 사용 시 호출 한도를 준수해야 합니다 (초당 20건)
> - Yahoo Finance는 비공식 API이므로 상용 서비스에서는 공식 데이터 제공자 사용 권장
> - 실시간 시세 데이터 사용 시 관련 법규 및 이용 약관을 확인하세요
