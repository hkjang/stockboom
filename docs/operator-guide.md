# 운영자용 가이드 (Operator Guide)

## 목차
- [시스템 배포](#시스템-배포)
- [컨테이너 운영](#컨테이너-운영)
- [모니터링](#모니터링)
- [데이터베이스 관리](#데이터베이스-관리)
- [Redis 관리](#redis-관리)
- [백업 및 복원](#백업-및-복원)
- [장애 대응](#장애-대응)
- [운영 명령어](#운영-명령어)
- [로그 관리](#로그-관리)

---

## 시스템 배포

### Docker Compose 기반 배포

**전체 스택 배포**

```bash
# 1. 저장소 클론
git clone <repository-url>
cd stockboom

# 2. 환경 변수 설정
cp .env.example .env.production
vi .env.production  # 프로덕션 환경 변수 설정

# 3. Docker Compose로 전체 스택 실행
docker compose -f docker/docker-compose.yml up -d

# 4. 배포 확인
docker compose ps
docker compose logs -f
```

### Docker Compose 구성

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-stockboom}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/stockboom
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      KIS_APP_KEY: ${KIS_APP_KEY}
      KIS_APP_SECRET: ${KIS_APP_SECRET}
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/stockboom
      REDIS_URL: redis://redis:6379
      KIS_APP_KEY: ${KIS_APP_KEY}
      KIS_APP_SECRET: ${KIS_APP_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    ports:
      - "3000:3000"
    depends_on:
      - api
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
    ports:
      - "3004:3000"
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

### 배포 체크리스트

- [ ] 환경 변수 설정 완료 (`.env.production`)
- [ ] KIS API 키 및 시크릿 확인
- [ ] SMTP 설정 확인 (이메일 알림)
- [ ] JWT 시크릿 생성 (강력한 랜덤 문자열)
- [ ] PostgreSQL 비밀번호 설정
- [ ] Grafana 관리자 비밀번호 설정
- [ ] Docker Compose 파일 검토
- [ ] 방화벽 규칙 설정
- [ ] SSL/TLS 인증서 설정 (프로덕션)
- [ ] 백업 스토리지 준비

---

## 컨테이너 운영

### 기본 명령어

```bash
# 컨테이너 상태 확인
docker compose ps

# 전체 로그 확인
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f api
docker compose logs -f worker

# 컨테이너 재시작
docker compose restart api
docker compose restart worker

# 컨테이너 중지
docker compose stop

# 컨테이너 시작
docker compose start

# 전체 재배포 (코드 업데이트 후)
docker compose down
docker compose build
docker compose up -d
```

### 헬스 체크

```bash
# API 서버 헬스 체크
curl http://localhost:3001/health

# PostgreSQL 연결 확인
docker compose exec postgres pg_isready -U postgres

# Redis 연결 확인
docker compose exec redis redis-cli ping
```

### 리소스 사용량 확인

```bash
# 컨테이너별 리소스 사용량
docker stats

# 디스크 사용량
docker system df

# 볼륨 정보
docker volume ls
docker volume inspect stockboom_postgres_data
```

---

## 모니터링

### Prometheus를 통한 메트릭 수집

**Prometheus 설정**

```yaml
# docker/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:3001']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### Grafana 대시보드

**접속 정보**
- URL: `http://localhost:3004`
- 기본 계정: `admin` / 설정한 비밀번호

**주요 메트릭**

| 메트릭 | 설명 | 임계값 |
|--------|------|--------|
| `http_request_duration_seconds` | API 응답 시간 | P95 < 500ms |
| `bullmq_queue_size` | 큐 대기 작업 수 | < 1000 |
| `postgres_connections_active` | DB 활성 연결 | < 80% |
| `redis_connected_clients` | Redis 클라이언트 수 | < 100 |
| `process_cpu_usage_percent` | CPU 사용률 | < 80% |
| `process_memory_usage_bytes` | 메모리 사용량 | < 2GB |

### BullMQ 대시보드

```bash
# BullMQ Dashboard 접속
# URL: http://localhost:3003

# 확인 항목:
# - 대기 중인 작업 수
# - 처리 중인 작업 수
# - 완료된 작업 수
# - 실패한 작업 수
# - 재시도 중인 작업
```

### 로그 모니터링

```bash
# 실시간 로그 모니터링
docker compose logs -f --tail=100 api worker

# 에러 로그만 필터링
docker compose logs api | grep ERROR

# 특정 시간대 로그
docker compose logs --since "2025-01-01T09:00:00" --until "2025-01-01T10:00:00" api
```

### 알림 설정

**Grafana 알림 규칙**

```yaml
# API 응답 시간 초과
alert: HighAPILatency
expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
for: 5m
labels:
  severity: warning
annotations:
  summary: "API 응답 시간이 높습니다"
  description: "P95 응답 시간이 1초를 초과했습니다"

# 큐 대기 작업 급증
alert: HighQueueSize
expr: bullmq_queue_waiting_count > 1000
for: 10m
labels:
  severity: critical
annotations:
  summary: "큐 대기 작업이 급증했습니다"
  description: "{{ $value }} 개의 작업이 대기 중입니다"

# 데이터베이스 연결 부족
alert: LowDatabaseConnections
expr: postgres_connections_available < 5
for: 5m
labels:
  severity: critical
annotations:
  summary: "데이터베이스 연결이 부족합니다"
```

---

## 데이터베이스 관리

### PostgreSQL 운영

**연결**
```bash
# Docker 컨테이너를 통한 연결
docker compose exec postgres psql -U postgres -d stockboom

# 외부 클라이언트 연결
psql -h localhost -p 5432 -U postgres -d stockboom
```

**일반 관리**
```sql
-- 데이터베이스 크기 확인
SELECT pg_size_pretty(pg_database_size('stockboom'));

-- 테이블별 크기
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;

-- 활성 연결 확인
SELECT count(*) FROM pg_stat_activity;

-- 느린 쿼리 확인
SELECT 
  pid,
  now() - query_start AS duration,
  query
FROM pg_stat_activity
WHERE state = 'active'
AND now() - query_start > interval '5 seconds';

-- 연결 강제 종료 (필요시)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'stockboom' AND pid <> pg_backend_pid();
```

**인덱스 관리**
```sql
-- 인덱스 사용 통계
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- 사용하지 않는 인덱스 찾기
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey';

-- 인덱스 재구성 (VACUUM 후)
REINDEX TABLE candles;
REINDEX TABLE indicators;
```

**유지보수**
```sql
-- VACUUM (디스크 정리)
VACUUM ANALYZE;

-- 특정 테이블 VACUUM
VACUUM ANALYZE candles;
VACUUM ANALYZE trades;

-- FULL VACUUM (더 많은 공간 확보, 시간 소요)
VACUUM FULL trades;
```

### 데이터 정리 작업

```sql
-- 오래된 캔들 데이터 삭제 (1년 이상)
DELETE FROM candles 
WHERE timeframe = '1m' 
AND timestamp < NOW() - INTERVAL '1 year';

-- 오래된 알림 삭제 (3개월 이상)
DELETE FROM notifications 
WHERE is_read = true 
AND created_at < NOW() - INTERVAL '3 months';

-- 취소된 주문 정리 (6개월 이상)
DELETE FROM trades 
WHERE status = 'CANCELLED' 
AND created_at < NOW() - INTERVAL '6 months';
```

---

## Redis 관리

### Redis 운영

**연결**
```bash
# Redis CLI 접속
docker compose exec redis redis-cli

# 외부 접속
redis-cli -h localhost -p 6379
```

**모니터링**
```bash
# Redis 정보 확인
redis-cli INFO

# 메모리 사용량
redis-cli INFO memory

# 클라이언트 연결 수
redis-cli INFO clients

# 실시간 명령 모니터링
redis-cli MONITOR

# 키 개수 확인
redis-cli DBSIZE
```

**큐 관리**
```bash
# BullMQ 큐 확인
redis-cli KEYS "bull:*"

# 특정 큐의 대기 작업 수
redis-cli LLEN "bull:data-collection:wait"
redis-cli LLEN "bull:data-analysis:wait"
redis-cli LLEN "bull:trade-execution:wait"
redis-cli LLEN "bull:notification:wait"

# 특정 큐 비우기 (주의!)
redis-cli DEL "bull:data-collection:wait"
```

**데이터 정리**
```bash
# 모든 키 삭제 (개발환경만!)
redis-cli FLUSHALL

# 특정 패턴의 키 삭제
redis-cli --scan --pattern "bull:data-collection:*" | xargs redis-cli DEL

# 만료된 키 제거
redis-cli --scan --pattern "cache:*" | while read key; do
  redis-cli EXPIRE "$key" 0
done
```

### Redis 성능 최적화

**메모리 정책 설정**
```bash
# redis.conf 또는 Docker 환경 변수
maxmemory 2gb
maxmemory-policy allkeys-lru  # LRU 정책으로 자동 삭제
```

**영속성 설정**
```bash
# RDB 스냅샷 (백업)
save 900 1       # 900초 내 1개 변경시 저장
save 300 10      # 300초 내 10개 변경시 저장
save 60 10000    # 60초 내 10000개 변경시 저장

# AOF (Append Only File)
appendonly yes
appendfsync everysec  # 매 초마다 fsync
```

---

## 백업 및 복원

### PostgreSQL 백업

**자동 백업 스크립트**
```bash
#!/bin/bash
# scripts/backup-postgres.sh

BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="stockboom-postgres-1"

mkdir -p $BACKUP_DIR

# 전체 데이터베이스 백업
docker compose exec -T postgres pg_dump -U postgres stockboom | gzip > $BACKUP_DIR/stockboom_$DATE.sql.gz

# 백업 파일 보관 (30일 이상 삭제)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: stockboom_$DATE.sql.gz"
```

**백업 실행**
```bash
chmod +x scripts/backup-postgres.sh
./scripts/backup-postgres.sh

# Cron으로 자동화 (매일 새벽 2시)
crontab -e
0 2 * * * /path/to/stockboom/scripts/backup-postgres.sh >> /var/log/stockboom-backup.log 2>&1
```

**복원**
```bash
# 백업 파일 복원
gunzip < /backups/postgres/stockboom_20250101_020000.sql.gz | \
  docker compose exec -T postgres psql -U postgres stockboom

# 또는
docker compose exec -T postgres pg_restore -U postgres -d stockboom < backup.dump
```

### Redis 백업

```bash
# RDB 스냅샷 생성
docker compose exec redis redis-cli SAVE

# RDB 파일 복사
docker compose cp redis:/data/dump.rdb ./backups/redis/dump_$(date +%Y%m%d).rdb

# 복원 (Redis 중지 후)
docker compose stop redis
cp backups/redis/dump_20250101.rdb /path/to/redis_data/dump.rdb
docker compose start redis
```

---

## 장애 대응

### 장애 시나리오별 대응

#### 1. API 서버 응답 없음

**증상**
- API 요청 타임아웃
- 502/504 에러
- Prometheus에서 API 메트릭 수집 실패

**대응 절차**
```bash
# 1. 컨테이너 상태 확인
docker compose ps api

# 2. 로그 확인
docker compose logs --tail=100 api

# 3. 헬스 체크
curl http://localhost:3001/health

# 4. 재시작
docker compose restart api

# 5. 여전히 문제시 재빌드
docker compose up -d --build api
```

#### 2. 데이터 수집 실패

**증상**
- Worker 로그에 에러 메시지
- BullMQ 대시보드에 실패 작업 누적
- 종목 시세 업데이트 안됨

**대응 절차**
```bash
# 1. Worker 로그 확인
docker compose logs --tail=200 worker | grep ERROR

# 2. KIS API 토큰 확인
curl -X GET http://localhost:3001/api/market-data/kis/token-status

# 3. Redis 큐 상태 확인
redis-cli LLEN "bull:data-collection:failed"

# 4. 실패한 작업 재시도
# BullMQ Dashboard에서 수동으로 재시도

# 5. Worker 재시작
docker compose restart worker
```

#### 3. 매매 주문 실패

**증상**
- 주문 상태가 REJECTED 또는 FAILED
- Trades 테이블에 failure_reason 기록
- 알림으로 실패 메시지 수신

**대응 절차**
```sql
-- 1. 실패한 주문 확인
SELECT id, stock_id, order_side, quantity, status, failure_reason, created_at
FROM trades
WHERE status IN ('REJECTED', 'FAILED')
ORDER BY created_at DESC
LIMIT 20;

-- 2. 주문 상세 정보 확인
SELECT * FROM trades WHERE id = 'trade-id';

-- 3. 계좌 정보 확인
SELECT * FROM broker_accounts WHERE id = 'account-id';
```

```bash
# 4. KIS API 연동 테스트
curl -X POST http://localhost:3001/api/trades/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"brokerAccountId":"account-id","stockId":"stock-id"}'

# 5. 필요시 수동 재주문
# 관리자 대시보드 또는 API를 통해 재주문
```

**실패 원인별 대응**

| 실패 원인 | 대응 방법 |
|-----------|-----------|
| **토큰 만료** | KIS API 토큰 갱신 |
| **잔고 부족** | 포트폴리오 잔고 확인 및 조정 |
| **시장 마감** | 거래 시간 확인 (09:00-15:30) |
| **호가 범위 초과** | 지정가 조정 |
| **주문 한도 초과** | 일일 주문 한도 확인 |

#### 4. 데이터베이스 연결 오류

**증상**
- "Connection pool exhausted" 에러
- API/Worker에서 DB 쿼리 실패
- Grafana에서 PostgreSQL 연결 끊김

**대응 절차**
```bash
# 1. PostgreSQL 상태 확인
docker compose ps postgres
docker compose logs postgres

# 2. 연결 수 확인
docker compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# 3. 연결 풀 설정 확인 (Prisma)
# DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20"

# 4. PostgreSQL 재시작
docker compose restart postgres

# 5. API/Worker 재시작 (연결 재설정)
docker compose restart api worker
```

#### 5. Redis 연결 끊김

**증상**
- BullMQ 작업 처리 중단
- "Redis connection lost" 에러
- 큐에 작업이 쌓이지 않음

**대응 절차**
```bash
# 1. Redis 상태 확인
docker compose ps redis
docker compose exec redis redis-cli ping

# 2. Redis 메모리 확인
docker compose exec redis redis-cli INFO memory

# 3. Redis 재시작
docker compose restart redis

# 4. Worker 재시작
docker compose restart worker
```

### 긴급 연락 체계

| 우선순위 | 담당자 | 연락처 | 역할 |
|----------|--------|--------|------|
| **P0 (즉시)** | 시스템 관리자 | xxx-xxxx-xxxx | 장애 1차 대응 |
| **P1 (1시간)** | 개발팀 리더 | xxx-xxxx-xxxx | 코드 이슈 대응 |
| **P2 (4시간)** | 인프라팀 | xxx-xxxx-xxxx | 인프라 이슈 |

---

## 운영 명령어

### 일상 운영 명령어

```bash
# 서비스 상태 확인
docker compose ps

# 리소스 사용량 확인
docker stats

# 로그 확인 (최근 100줄)
docker compose logs --tail=100 -f

# 특정 서비스 재시작
docker compose restart api

# 전체 재시작
docker compose restart

# 데이터베이스 백업
./scripts/backup-postgres.sh

# 디스크 정리
docker system prune -a --volumes

# 환경 변수 재로드
docker compose up -d --force-recreate
```

### Cron 스케줄링

```bash
# /etc/cron.d/stockboom

# 매일 새벽 2시 데이터베이스 백업
0 2 * * * /path/to/stockboom/scripts/backup-postgres.sh

# 매주 일요일 새벽 3시 디스크 정리
0 3 * * 0 docker system prune -f

# 매시간 헬스 체크
0 * * * * curl -f http://localhost:3001/health || systemctl restart stockboom-api

# 매일 새벽 4시 오래된 데이터 정리
0 4 * * * psql -U postgres -d stockboom -f /path/to/cleanup.sql
```

---

## 로그 관리

### 로그 로테이션

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": "true"
  }
}
```

### 로그 분석

```bash
# 에러 로그 카운트
docker compose logs api | grep ERROR | wc -l

# 가장 많이 발생한 에러
docker compose logs api | grep ERROR | sort | uniq -c | sort -rn | head -10

# 특정 시간대 에러
docker compose logs --since "2025-01-01T14:00:00" --until "2025-01-01T15:00:00" api | grep ERROR

#로그를 파일로 저장
docker compose logs api > api_logs_$(date +%Y%m%d).log
```

---

## 성능 최적화

### PostgreSQL 최적화

```sql
-- 느린 쿼리 식별
SELECT 
  mean_exec_time,
  calls,
  query
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 인덱스 추가 (예시)
CREATE INDEX CONCURRENTLY idx_trades_created_at ON trades(created_at DESC);
```

### Redis 최적화

```bash
# 메모리 사용량이 높을 때
redis-cli --bigkeys  # 큰 키 찾기

# TTL 설정으로 자동 삭제
redis-cli EXPIRE "cache:stock:005930" 3600  # 1시간 후 삭제
```

---

**운영 관련 문의**: 운영팀에 문의하세요.
