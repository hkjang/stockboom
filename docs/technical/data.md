# 데이터 가이드 (Data Guide)

## 1. 개요
본 문서는 StockBoom 시스템에서 다루는 주요 데이터의 형식, 저장 구조, 수명 주기(TTL) 및 관리 정책을 설명합니다.

## 2. 시세 데이터 (Market Data)

### 2.1 캔들 데이터 (Candles)
- **저장소**: PostgreSQL (`candles` 테이블)
- **형식**: OHLCV (Open, High, Low, Close, Volume) + Amount
- **Timeframe**: 1분, 5분, 15분, 30분, 1시간, 1일, 1주, 1월
- **파티셔닝**: `timestamp` 기준 월별 파티셔닝 (대용량 데이터 조회 성능 최적화)
- **보관 주기**:
  - 1분/5분 봉: 1년
  - 15분/30분/1시간 봉: 3년
  - 일/주/월 봉: 영구 보관

### 2.2 실시간 시세 (Real-time Quote)
- **저장소**: Redis (`cache:stock:{symbol}`)
- **형식**: JSON 문자열 (현재가, 등락률, 거래량 등)
- **TTL**: 1분 (장 운영 시간 중 지속 갱신)

## 3. 트랜잭션 데이터 (Transaction Data)

### 3.1 거래 이력 (Trades)
- **저장소**: PostgreSQL (`trades` 테이블)
- **중요성**: 금융 거래 기록으로 무결성이 최우선
- **보관 주기**: 영구 보관 (법적 요구사항 준수)
- **백업**: 실시간 WAL 아카이빙 및 일일 Full Backup

### 3.2 포트폴리오 스냅샷
- **저장소**: PostgreSQL (`portfolio_snapshots` - *추후 구현 예정*)
- **목적**: 일자별 자산 변동 추이 분석
- **주기**: 매일 장 마감 후 1회 생성

## 4. 분석 데이터 (Analysis Data)

### 4.1 기술적 지표 (Indicators)
- **저장소**: PostgreSQL (`indicators` 테이블)
- **형식**: JSONB (지표 타입별 상이한 구조 수용)
- **보관 주기**: 캔들 데이터와 동일 (재계산 가능하므로 백업 우선순위 낮음)

### 4.2 AI 리포트 (AI Reports)
- **저장소**: PostgreSQL (`ai_reports` 테이블)
- **형식**: JSONB (분석 결과, 추천 사유 등)
- **보관 주기**: 1년 (최신 트렌드 반영 중요)

## 5. 데이터 표준화

### 5.1 금액 처리
- **DB**: `DECIMAL(20, 2)` 타입 사용 (부동소수점 오차 방지)
- **Code**: `Big.js` 또는 `Decimal.js` 라이브러리 사용하여 연산

### 5.2 시간 처리
- **DB**: `TIMESTAMP WITH TIME ZONE` (UTC 기준 저장)
- **Client**: 사용자 로컬 시간대(KST 등)로 변환하여 표시
- **Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`) 준수
