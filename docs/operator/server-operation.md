# 서버 운영 가이드 (Server Operation Guide)

## 1. 개요
본 문서는 StockBoom 시스템의 안정적인 운영을 위한 서버 관리, 데이터베이스 유지보수, 로그 분석 절차를 설명합니다.

## 2. 서버 상태 점검 (Health Check)

### 2.1 시스템 리소스 모니터링
- **CPU**: 80% 이상 지속 시 알림 및 원인 분석 (프로세스별 점유율 확인)
- **Memory**: 85% 이상 사용 시 스왑 사용량 확인 및 메모리 누수 점검
- **Disk**: 90% 이상 사용 시 오래된 로그/백업 파일 정리

### 2.2 서비스 상태 확인
- **API Server**: `curl http://localhost:3001/health` 응답 확인 (200 OK)
- **Worker**: BullMQ 큐 처리 상태 및 에러 로그 확인
- **Database**: PostgreSQL 연결 가능 여부 및 커넥션 풀 상태 확인
- **Redis**: PING 응답 확인 및 메모리 사용량 점검

## 3. 데이터베이스 운영 (PostgreSQL)

### 3.1 정기 점검
- **Vacuum**: 자동 Vacuum 설정 확인 및 필요 시 수동 실행 (`VACUUM ANALYZE`)
- **인덱스**: 사용되지 않는 인덱스 식별 및 제거, 인덱스 재구성 (`REINDEX`)
- **Lock**: 장기 실행 트랜잭션 및 Deadlock 모니터링

### 3.2 백업 및 복원
- **백업 정책**:
  - Full Backup: 매일 새벽 1회 (보관 주기: 30일)
  - WAL Archiving: 실시간 (Point-in-Time Recovery 용)
- **복원 절차**:
  1. 서비스 중단 (API/Worker)
  2. 기존 DB 이름 변경 또는 삭제
  3. `pg_restore` 명령어로 백업 파일 복원
  4. 서비스 재시작 및 데이터 무결성 검증

## 4. Redis 운영

### 4.1 메모리 관리
- **Maxmemory 정책**: `allkeys-lru` 설정 권장 (메모리 부족 시 오래된 키 삭제)
- **Fragmentation**: `INFO memory` 명령어로 파편화 비율 확인 (1.5 이상 시 재시작 고려)

### 4.2 데이터 지속성 (Persistence)
- **RDB**: 정기적인 스냅샷 저장 (백업용)
- **AOF**: 매 초마다 쓰기 작업 기록 (데이터 유실 최소화)

## 5. 로그 관리 및 분석

### 5.1 로그 수집
- **Docker Logs**: `json-file` 드라이버 사용, 로테이션 설정 (max-size: 10m, max-file: 3)
- **중앙화 (권장)**: ELK Stack (Elasticsearch, Logstash, Kibana) 또는 Loki/Grafana 연동

### 5.2 로그 분석 포인트
- **Error/Fatal**: 즉시 조치 필요한 심각한 오류
- **Warn**: 잠재적 문제 (예: API 지연, 재시도 발생)
- **Access Log**: 비정상적인 트래픽 패턴(DDoS 시도 등) 감지

## 6. 정기 유지보수 체크리스트
- [ ] OS 및 패키지 보안 업데이트
- [ ] SSL 인증서 만료일 확인 (갱신 30일 전 알림)
- [ ] 데이터베이스 백업 파일 무결성 검증 (복원 테스트)
- [ ] 디스크 여유 공간 확보 (로그, 임시 파일 정리)
