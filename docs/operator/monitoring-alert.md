# 모니터링 및 알림 설정 가이드 (Monitoring & Alerting Guide)

## 1. 개요
본 문서는 StockBoom 시스템의 상태를 실시간으로 감시하고 이상 징후를 조기에 발견하기 위한 모니터링 도구 설정 및 알림 정책을 설명합니다.

## 2. 모니터링 도구 구성

### 2.1 Prometheus & Grafana
- **Prometheus**: 시계열 데이터 수집 및 저장
  - `api`: NestJS API 메트릭 (요청 수, 응답 시간, 에러율)
  - `node`: Node.js 런타임 메트릭 (이벤트 루프 지연, 힙 메모리)
  - `postgres`: DB 연결 수, 쿼리 성능
  - `redis`: 메모리 사용량, 키 개수, 커맨드 처리량
- **Grafana**: 데이터 시각화 대시보드
  - **Main Dashboard**: 시스템 전반적인 건강 상태 요약
  - **API Dashboard**: 엔드포인트별 성능 분석
  - **Business Dashboard**: 매매 체결 현황, 포트폴리오 수익률 추이

### 2.2 BullMQ Dashboard
- **URL**: `http://localhost:3003`
- **기능**:
  - 큐별(수집, 분석, 매매, 알림) 작업 상태(Waiting, Active, Completed, Failed) 확인
  - 실패한 작업 재시도(Retry) 및 삭제
  - 작업 데이터(Payload) 및 에러 로그 확인

## 3. 알림 임계치 설정 (Alert Thresholds)

| 대상 | 메트릭 | 임계치 (Warning / Critical) | 설명 |
|------|--------|-----------------------------|------|
| **API** | 응답 시간 (P95) | > 500ms / > 1s | API 성능 저하 감지 |
| **API** | 에러율 (5xx) | > 1% / > 5% | 서버 내부 오류 급증 |
| **Queue** | 대기 작업 수 | > 1000 / > 5000 | 처리 지연 발생 |
| **DB** | 활성 연결 수 | > 70% / > 90% | 커넥션 풀 고갈 위험 |
| **Disk** | 사용률 | > 80% / > 90% | 디스크 공간 부족 |
| **Biz** | 매매 실패율 | > 5% / > 10% | 주문 체결 이상 |

## 4. 알림 채널 설정

### 4.1 Slack 연동
- **Webhooks**: Slack Incoming Webhook URL 생성 후 Grafana Alerting Contact Point에 등록
- **채널 분리**:
  - `#ops-alerts-critical`: P1/P2 등급 장애 (전체 알림)
  - `#ops-alerts-warning`: P3/P4 등급 (무음 또는 멘션 없음)

### 4.2 Email 알림
- SMTP 설정을 통해 주요 장애 발생 시 운영팀 메일링 리스트로 발송
- 일일/주간 시스템 리포트 발송

### 4.3 PagerDuty (선택 사항)
- 심각한 장애(P1) 발생 시 온콜 담당자에게 전화/SMS 발송 연동

## 5. 로그 모니터링 (Loki/ELK)
- **LogQL 예시**:
  - 에러 로그 검색: `{app="api"} |= "error"`
  - 특정 API 지연 검색: `{app="api"} | json | duration > 1000`
