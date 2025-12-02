# API Reference

StockBoom API 전체 엔드포인트 문서입니다.

**Base URL**: `http://localhost:3001/api`

**Authentication**: Bearer Token (JWT)

## 목차

- [인증 (Authentication)](#인증-authentication)
- [사용자 (Users)](#사용자-users)
- [종목 (Stocks)](#종목-stocks)
- [포트폴리오 (Portfolios)](#포트폴리오-portfolios)
- [거래 (Trades)](#거래-trades)
- [분석 (Analysis)](#분석-analysis)
- [전략 (Strategies)](#전략-strategies)
- [알림 (Alerts)](#알림-alerts)
- [알림 발송 (Notifications)](#알림-발송-notifications)

---

## 인증 (Authentication)

### 회원가입

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동"
}

Response: 201 Created
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "홍길동"
  }
}
```

### 로그인

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: 200 OK
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "twoFactorEnabled": false
  }
}
```

### 프로필 조회

```http
GET /auth/profile
Authorization: Bearer <token>

Response: 200 OK
{
  "userId": "user-id",
  "email": "user@example.com"
}
```

### 2FA 설정

```http
POST /auth/2fa/setup
Authorization: Bearer <token>

Response: 200 OK
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

### 2FA 인증

```http
POST /auth/2fa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "123456"
}

Response: 200 OK
{
  "success": true
}
```

---

## 사용자 (Users)

### 내 정보 조회

```http
GET /users/me
Authorization: Bearer <token>

Response: 200 OK
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "홍길동",
  "emailVerified": false,
  "twoFactorEnabled": false,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

## 종목 (Stocks)

### 종목 목록

```http
GET /stocks?market=KOSPI&page=1&limit=20
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "stock-id",
    "symbol": "005930",
    "name": "삼성전자",
    "market": "KOSPI",
    "currentPrice": 70000,
    "changePercent": 1.5
  }
]
```

### 종목 검색

```http
GET /stocks/search?q=삼성
Authorization: Bearer <token>

Response: 200 OK
{
  "database": [...],
  "external": [...]
}
```

### 실시간 시세

```http
GET /stocks/005930/quote
Authorization: Bearer <token>

Response: 200 OK
{
  "symbol": "005930",
  "name": "삼성전자",
  "currentPrice": 70000,
  "changePrice": 1000,
  "changeRate": 1.45,
  "volume": 15000000,
  "high": 71000,
  "low": 69000,
  "timestamp": "2025-01-01T09:00:00Z"
}
```

### 시장 지수

```http
GET /stocks/market-indices
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "symbol": "^KS11",
    "name": "KOSPI",
    "price": 2500.00,
    "change": 10.50,
    "changePercent": 0.42
  }
]
```

---

## 포트폴리오 (Portfolios)

### 포트폴리오 목록

```http
GET /portfolios
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "portfolio-id",
    "name": "메인 포트폴리오",
    "cashBalance": 5000000,
    "totalValue": 15000000,
    "totalReturn": 3000000,
    "totalReturnPct": 25.0
  }
]
```

### 포트폴리오 생성

```http
POST /portfolios
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "메인 포트폴리오",
  "description": "장기 투자용",
  "brokerAccountId": "account-id",
  "cashBalance": 10000000
}

Response: 201 Created
{
  "id": "portfolio-id",
  "name": "메인 포트폴리오",
  ...
}
```

### 평가금액 계산

```http
POST /portfolios/:id/valuation
Authorization: Bearer <token>

Response: 200 OK
{
  "totalValue": 15000000,
  "positions": [...]
}
```

### 포지션 추가

```http
POST /portfolios/:id/positions
Authorization: Bearer <token>
Content-Type: application/json

{
  "stockId": "stock-id",
  "quantity": 10,
  "avgPrice": 50000
}

Response: 201 Created
{
  "id": "position-id",
  "quantity": 10,
  "avgPrice": 50000,
  "unrealizedPL": 100000
}
```

---

## 거래 (Trades)

### 거래 내역

```http
GET /trades?page=1&limit=50&status=FILLED
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "trade-id",
    "orderSide": "BUY",
    "quantity": 10,
    "avgFillPrice": 50000,
    "status": "FILLED",
    "createdAt": "2025-01-01T09:00:00Z"
  }
]
```

### 주문 생성

```http
POST /trades
Authorization: Bearer <token>
Content-Type: application/json

{
  "brokerAccountId": "account-id",
  "stockId": "stock-id",
  "orderType": "LIMIT",
  "orderSide": "BUY",
  "quantity": 10,
  "limitPrice": 50000
}

Response: 201 Created
{
  "id": "trade-id",
  "status": "PENDING",
  ...
}
```

### 거래 통계

```http
GET /trades/statistics?startDate=2025-01-01&endDate=2025-12-31
Authorization: Bearer <token>

Response: 200 OK
{
  "totalTrades": 100,
  "buyTrades": 50,
  "sellTrades": 50,
  "totalBuyAmount": 50000000,
  "totalSellAmount": 55000000,
  "netAmount": 5000000
}
```

---

## 분석 (Analysis)

### 종목 분석

```http
POST /analysis/stocks/:id/analyze?timeframe=1d
Authorization: Bearer <token>

Response: 200 OK
{
  "stock": {
    "symbol": "005930",
    "name": "삼성전자"
  },
  "signal": {
    "signal": "BUY",
    "strength": 75
  },
  "indicators": {
    "RSI": { "value": 45, "signal": "BUY" },
    "MACD": { "signal": "BUY" }
  }
}
```

### 추천 종목

```http
GET /analysis/recommendations?minStrength=70&signal=BUY
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "stock": {
      "symbol": "005930",
      "name": "삼성전자"
    },
    "signal": "BUY",
    "strength": 80
  }
]
```

---

## 전략 (Strategies)

### 전략 목록

```http
GET /strategies
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "strategy-id",
    "name": "RSI 전략",
    "type": "INDICATOR_BASED",
    "isActive": true
  }
]
```

### 전략 생성

```http
POST /strategies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "RSI 과매도 전략",
  "type": "INDICATOR_BASED",
  "config": {
    "indicator": "RSI",
    "oversold": 30,
    "overbought": 70
  },
  "stopLossPercent": 5,
  "takeProfitPercent": 10
}

Response: 201 Created
{
  "id": "strategy-id",
  ...
}
```

### 백테스팅

```http
POST /strategies/:id/backtest
Authorization: Bearer <token>
Content-Type: application/json

{
  "stockId": "stock-id",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 10000000
}

Response: 200 OK
{
  "initialCapital": 10000000,
  "finalCapital": 12000000,
  "totalReturn": 2000000,
  "returnPct": 20.0,
  "winRate": 65.5,
  "trades": 50
}
```

---

## 알림 (Alerts)

### 알림 목록

```http
GET /alerts
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "alert-id",
    "type": "PRICE_CHANGE",
    "name": "삼성전자 5% 변동",
    "isActive": true
  }
]
```

### 알림 생성

```http
POST /alerts
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "PRICE_CHANGE",
  "name": "삼성전자 5% 상승",
  "conditions": {
    "symbol": "005930",
    "changePercent": 5,
    "direction": "UP"
  },
  "webPush": true,
  "email": false
}

Response: 201 Created
{
  "id": "alert-id",
  ...
}
```

---

## 알림 발송 (Notifications)

### 알림 목록

```http
GET /notifications?page=1&limit=50&isRead=false
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "notification-id",
    "title": "가격 변동 알림",
    "message": "삼성전자가 5% 상승했습니다",
    "isRead": false,
    "createdAt": "2025-01-01T09:00:00Z"
  }
]
```

### 읽지 않은 알림 수

```http
GET /notifications/unread-count
Authorization: Bearer <token>

Response: 200 OK
{
  "count": 5
}
```

### 알림 읽음 처리

```http
PUT /notifications/:id/read
Authorization: Bearer <token>

Response: 200 OK
{
  "id": "notification-id",
  "isRead": true
}
```

### 모든 알림 읽음

```http
PUT /notifications/read-all
Authorization: Bearer <token>

Response: 200 OK
{
  "marked": 10
}
```

---

## 에러 응답

모든 에러는 다음 형식으로 반환됩니다:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

### HTTP 상태 코드

- `200 OK`: 성공
- `201 Created`: 리소스 생성 성공
- `400 Bad Request`: 잘못된 요청
- `401 Unauthorized`: 인증 실패
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 리소스 없음
- `500 Internal Server Error`: 서버 오류

---

**Swagger UI**: http://localhost:3001/api/docs

더 자세한 API 문서는 Swagger UI에서 확인할 수 있습니다.
