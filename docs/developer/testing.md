# 테스트 가이드 (Testing Guide)

## 1. 개요
본 문서는 StockBoom 시스템의 안정성을 보장하기 위한 테스트 전략과 절차를 설명합니다.

## 2. 테스트 피라미드
우리는 다음 세 가지 레벨의 테스트를 수행합니다:
1. **Unit Tests (단위 테스트)**: 개별 함수, 클래스, 메서드의 동작 검증
2. **Integration Tests (통합 테스트)**: 모듈 간 상호작용 및 데이터베이스/외부 API 연동 검증
3. **E2E Tests (엔드 투 엔드 테스트)**: 사용자 시나리오 기반의 전체 시스템 흐름 검증

## 3. 단위 테스트 (Unit Tests)

### 3.1 Backend (NestJS)
- **프레임워크**: Jest
- **대상**: Services, Utilities, Helpers
- **Mocking**: 외부 의존성(Repository, External API)은 Mock 객체로 대체
- **실행**: `pnpm test`

```typescript
// 예시: 지표 계산 서비스 테스트
describe('IndicatorsService', () => {
  it('should calculate RSI correctly', () => {
    const prices = [/* ... */];
    const rsi = service.calculateRSI(prices);
    expect(rsi).toBeCloseTo(expectedValue);
  });
});
```

### 3.2 Frontend (Next.js)
- **프레임워크**: Jest, React Testing Library
- **대상**: Components, Hooks, Utils
- **실행**: `pnpm test`

## 4. 통합 테스트 (Integration Tests)

### 4.1 API & DB
- **대상**: Controllers, Services, Database Queries
- **환경**: 테스트용 데이터베이스(Docker) 사용
- **실행**: `pnpm test:e2e` (NestJS 기본 설정 활용)

### 4.2 BullMQ 큐 테스트
- **목표**: 작업 추가 및 처리 로직 검증
- **방법**:
  1. 테스트용 Redis 인스턴스 사용
  2. 큐에 작업 추가 (`queue.add`)
  3. Worker가 작업을 처리하고 예상된 결과(DB 저장, 이벤트 발행 등)를 생성하는지 검증
  4. 테스트 종료 후 큐 비우기

## 5. AI 모듈 테스트

### 5.1 모델 검증
- **Backtesting**: 과거 데이터를 사용하여 모델의 예측 정확도 및 수익률 검증
- **데이터셋**: Training/Validation/Test 셋 분리
- **평가 지표**: Accuracy, Precision, Recall, Sharpe Ratio

### 5.2 시뮬레이션
- `SimulationService`를 통해 가상 환경에서 매매 시나리오 실행
- 입력: 과거 시세 데이터 스트림
- 출력: 매매 로그, 수익률 리포트

## 6. 자동 매매 시뮬레이션 테스트

### 6.1 Paper Trading (모의 투자)
- **환경**: 운영 환경과 동일하지만, 주문은 증권사 모의투자 API로 전송
- **목적**: 실제 매매 로직 및 주문 체결 프로세스 검증
- **설정**: `IS_MOCK_MODE=true`

### 6.2 시나리오 테스트
- **급등/급락 시나리오**: 변동성이 큰 상황에서 손절/익절 로직 동작 확인
- **API 장애 시나리오**: 증권사 API 타임아웃/에러 시 재시도 및 예외 처리 확인

## 7. CI/CD 파이프라인 테스트
- GitHub Actions에서 PR 생성 시 자동 실행
- **Lint Check**: `pnpm lint`
- **Build Check**: `pnpm build`
- **Unit/Integration Tests**: `pnpm test`

## 8. 테스트 데이터 관리
- **Seeding**: `prisma db seed`를 통해 테스트에 필요한 기초 데이터(사용자, 종목 등) 생성
- **Cleanup**: 테스트 실행 전후로 데이터베이스 초기화
