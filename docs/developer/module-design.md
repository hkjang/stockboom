# 모듈별 상세 설계 가이드 (Module Design Guide)

## 1. 개요
본 문서는 StockBoom 시스템의 핵심 모듈인 수집, 분석, 매매, 알림 모듈의 상세 구조와 책임, 그리고 데이터 흐름을 정의합니다.

## 2. 데이터 수집 모듈 (Data Collection Module)

### 2.1 책임 및 역할
- 외부 API(한국투자증권, Yahoo Finance)로부터 주식 시세 데이터 수집
- 실시간 및 주기적(Cron) 데이터 수집 스케줄링
- 수집된 데이터의 정규화 및 데이터베이스 저장
- API 호출 제한(Rate Limiting) 관리 및 토큰 갱신

### 2.2 구조
- **Scheduler**: `DataCollectionScheduler` (Cron 기반 스케줄링)
- **Queue**: `data-collection` (BullMQ)
- **Processor**: `DataCollectionProcessor` (큐 작업 처리)
- **Services**:
  - `KisApiService`: 한국투자증권 API 통신
  - `YahooFinanceService`: Yahoo Finance API 통신
  - `MarketDataService`: 데이터 통합 및 저장

### 2.3 데이터 흐름
1. **스케줄러**가 수집 대상 종목 조회 및 작업 생성
2. **BullMQ** 큐에 `collect-stock-data` 작업 추가
3. **Processor**가 작업 수신
4. **Service**를 통해 외부 API 호출 (토큰 만료 시 자동 갱신)
5. 데이터 정규화 후 `Candle` 테이블 저장
6. 수집 완료 이벤트 발행 (분석 모듈 트리거)

### 2.4 에러 처리
- API 호출 실패 시 BullMQ의 재시도(Retry) 메커니즘 사용 (Exponential Backoff)
- 연속 실패 시 Dead Letter Queue(DLQ)로 이동 및 관리자 알림

---

## 3. 분석 모듈 (Analysis Module)

### 3.1 책임 및 역할
- 수집된 시세 데이터를 기반으로 기술적 지표 계산
- AI 모델을 활용한 패턴 인식 및 위험도 분석
- 매매 신호 생성 및 전략 평가

### 3.2 구조
- **Queue**: `data-analysis`
- **Processor**: `DataAnalysisProcessor`
- **Services**:
  - `IndicatorsService`: 기술적 지표(RSI, MACD 등) 계산
  - `PatternDetectionService`: 차트 패턴 인식
  - `AiService`: AI 모델 추론 및 리포트 생성

### 3.3 주요 프로세스
1. **수집 완료** 이벤트 수신 시 분석 작업 큐에 추가
2. **Processor**가 종목별 최근 캔들 데이터 로드
3. **IndicatorsService**가 지표 계산 및 `Indicator` 테이블 저장
4. **AiService**가 뉴스 및 패턴 분석 수행 후 `AIReport` 생성
5. 분석 결과에 따라 `SIGNAL_GENERATED` 이벤트 발행

---

## 4. 매매 모듈 (Trading Module)

### 4.1 책임 및 역할
- 매매 신호 및 사용자 전략에 따른 주문 생성
- 증권사 API를 통한 주문 전송 및 체결 확인
- 포트폴리오 잔고 및 포지션 업데이트
- 주문 상태 추적 및 관리

### 4.2 구조
- **Queue**: `trade-execution`
- **Processor**: `TradeExecutionProcessor`
- **Services**:
  - `TradesService`: 주문 생성 및 DB 관리
  - `TradeTransactionService`: 트랜잭션 보장 및 롤백
  - `KisApiService`: 주문 실행

### 4.3 주문 실행 흐름
1. **전략** 또는 **사용자**가 주문 요청
2. **TradesService**가 주문 유효성 검증(잔고, 장 운영 시간 등)
3. `Trade` 레코드 생성(PENDING) 및 큐에 작업 추가
4. **Processor**가 작업 수신 후 증권사 API로 주문 전송
5. 주문 성공 시 상태 업데이트(SUBMITTED) 및 주문 번호 저장
6. 체결 확인(Polling 또는 Webhook) 후 포지션 업데이트(FILLED)

---

## 5. 알림 모듈 (Notification Module)

### 5.1 책임 및 역할
- 시스템 내 주요 이벤트(가격 변동, 체결, 에러 등) 감지
- 사용자별 알림 설정에 따른 필터링
- 다양한 채널(Web Push, Email)로 메시지 발송

### 5.2 구조
- **Queue**: `notification`
- **Processor**: `NotificationProcessor`
- **Services**:
  - `NotificationsService`: 알림 생성 및 관리
  - `PushSubscriptionService`: Web Push 구독 관리
  - `MailService`: 이메일 발송 (Nodemailer)

### 5.3 알림 처리
1. 각 모듈에서 이벤트 발생 시 `notification` 큐에 작업 추가
2. **Processor**가 작업 수신 및 사용자 설정 조회
3. 발송 채널 결정 (Web Push, Email 등)
4. 채널별 서비스 호출하여 메시지 발송
5. 발송 결과 및 읽음 상태 DB 저장

---

## 6. 데이터 구조 및 스키마

### 6.1 Prisma Schema 주요 포인트
- **User**: 인증 및 설정 정보
- **Stock & Candle**: 시세 데이터 (Time-series 성격)
- **Trade & Portfolio**: 트랜잭션 무결성이 중요한 금융 데이터
- **Strategy & Alert**: JSON 타입을 활용한 유연한 설정 저장

### 6.2 Redis 키 설계
- `bull:*`: BullMQ 큐 데이터
- `cache:stock:{symbol}`: 실시간 시세 캐시 (TTL 1분)
- `auth:refresh:{userId}`: 리프레시 토큰
- `lock:{resource}`: 분산 락 (중복 실행 방지)
