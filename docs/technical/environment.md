# 운영 환경 가이드 (Environment Guide)

## 1. 개요
본 문서는 StockBoom 시스템의 개발, 테스트, 운영 환경의 구성 차이와 환경 변수 관리, 컨테이너 설정 방법을 설명합니다.

## 2. 환경별 구성 차이

### 2.1 개발 환경 (Development)
- **목적**: 로컬 기능 개발 및 디버깅
- **인프라**: Docker Compose (Localhost)
- **데이터베이스**: 로컬 PostgreSQL/Redis 컨테이너 (데이터 영구 보존 보장 안 함)
- **외부 API**: 모의투자 API 또는 Mock Server 사용
- **로깅**: Debug 레벨, 콘솔 출력

### 2.2 테스트/스테이징 환경 (Staging)
- **목적**: 통합 테스트 및 배포 전 최종 검증
- **인프라**: 클라우드 단일 인스턴스 또는 소규모 클러스터
- **데이터베이스**: 별도 테스트 DB (운영 데이터 일부 마스킹하여 사용 가능)
- **외부 API**: 모의투자 API 사용
- **로깅**: Info 레벨, 파일 저장

### 2.3 운영 환경 (Production)
- **목적**: 실제 서비스 제공
- **인프라**: 고가용성(HA) 구성, 로드 밸런싱 적용
- **데이터베이스**: Managed DB (AWS RDS 등) 또는 이중화 구성, 정기 백업 필수
- **외부 API**: 실전투자 API 사용
- **로깅**: Error/Warn 레벨 위주, 중앙화된 로그 시스템(ELK 등) 전송

## 3. 환경 변수 관리

### 3.1 `.env` 파일 구조
프로젝트 루트의 `.env` 파일은 환경별로 다르게 설정해야 합니다.

| 변수명 | 설명 | Dev 예시 | Prod 예시 |
|--------|------|----------|-----------|
| `NODE_ENV` | 실행 환경 | `development` | `production` |
| `DATABASE_URL` | DB 접속 정보 | `postgresql://user:pass@localhost:5432/db` | `postgresql://user:pass@db-host:5432/db?ssl=true` |
| `KIS_APP_KEY` | 증권사 API 키 | (모의투자 키) | (실전투자 키) |
| `LOG_LEVEL` | 로그 레벨 | `debug` | `error` |

### 3.2 보안 주의사항
- `.env` 파일은 **절대 Git 저장소에 커밋하지 않습니다.** (`.gitignore` 포함 확인)
- 운영 환경의 민감 정보(API Key, DB Password)는 CI/CD 파이프라인의 Secrets 또는 서버의 환경 변수로 주입합니다.

## 4. Docker Compose 설정

### 4.1 파일 분리 전략
- `docker-compose.yml`: 공통 기본 설정
- `docker-compose.dev.yml`: 개발 환경 전용 설정 (볼륨 마운트, 포트 바인딩 등)
- `docker-compose.prod.yml`: 운영 환경 전용 설정 (Restart Policy, 리소스 제한 등)

### 4.2 실행 예시
```bash
# 개발 환경 실행
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 운영 환경 실행
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 5. 컨테이너 로그 관리

### 5.1 로그 드라이버
운영 환경에서는 디스크 용량 관리를 위해 로그 로테이션을 설정해야 합니다.

```yaml
# docker-compose.prod.yml 예시
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 5.2 로그 중앙화 (권장)
다수의 컨테이너 로그를 효율적으로 관리하기 위해 Fluentd 등을 사용하여 로그를 수집하고 Elasticsearch나 Loki로 전송하는 구성을 권장합니다.
