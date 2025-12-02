# StockBoom 빠른 시작 가이드

## 1단계: 필수 소프트웨어 설치

### Windows에서 설치

```powershell
# 1. Node.js 18+ 설치
# https://nodejs.org 에서 다운로드

# 2. pnpm 설치
npm install -g pnpm

# 3. Docker Desktop 설치
# https://www.docker.com/products/docker-desktop 에서 다운로드
# 설치 후 Docker Desktop 실행
```

## 2단계: 프로젝트 설정

```powershell
# 프로젝트 디렉토리로 이동
cd C:\Users\USER\projects\stockboom

# 의존성 설치 (약 5분 소요)
pnpm install
```

## 3단계: 환경 변수 설정

```powershell
# .env 파일 생성
Copy-Item .env.example .env

# 메모장으로 .env 파일 열기
notepad .env
```

**.env 파일 필수 수정 항목:**

```bash
# JWT 시크릿 (랜덤 문자열로 변경)
JWT_SECRET="your-secret-key-change-this-to-random-string"

# 암호화 키 (32자)
ENCRYPTION_KEY="change-this-to-32-character-key!!"

# 한국투자증권 API (있는 경우)
KIS_APP_KEY="your-app-key"
KIS_APP_SECRET="your-app-secret"
KIS_ACCOUNT_NUMBER="your-account-number"
KIS_MOCK_MODE="true"

# 이메일 설정 (Gmail 예시)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
```

**참고:** Gmail 앱 비밀번호는 [여기](https://myaccount.google.com/apppasswords)에서 생성

## 4단계: 데이터베이스 시작

```powershell
# Docker로 PostgreSQL과 Redis 시작
docker compose -f docker/docker-compose.dev.yml up -d

# 컨테이너 실행 확인
docker ps

# 다음이 보여야 함:
# - stockboom-postgres
# - stockboom-redis
# - stockboom-bullmq-board
```

## 5단계: 데이터베이스 초기화

```powershell
# Prisma 클라이언트 생성
pnpm db:generate

# 데이터베이스 스키마 푸시
pnpm db:push

# (선택) Prisma Studio로 데이터 확인
pnpm db:studio
# 브라우저에서 http://localhost:5555 열림
```

## 6단계: 서버 실행

**3개의 PowerShell 터미널 필요:**

**터미널 1 - API 서버:**
```powershell
cd C:\Users\USER\projects\stockboom\apps\api
pnpm dev

# 다음 메시지가 보이면 성공:
# 🚀 API server is running on: http://localhost:3001
# 📚 API documentation: http://localhost:3001/api/docs
```

**터미널 2 - Worker:**
```powershell
cd C:\Users\USER\projects\stockboom\apps\worker
pnpm dev

# 다음 메시지들이 보이면 성공:
# 🔄 Data Collection Worker started
# 🔄 Analyzer Worker started
# 🔄 Trader Worker started
# 🔄 Notifier Worker started
```

**터미널 3 - Web 앱:**
```powershell
cd C:\Users\USER\projects\stockboom\apps\web
pnpm dev

# 다음 메시지가 보이면 성공:
# ▲ Next.js 14.x.x
# - Local: http://localhost:3000
```

## 7단계: 접속 및 테스트

### 웹 브라우저로 접속

1. **웹 앱**: http://localhost:3000
   - 랜딩 페이지가 보임
   - "회원가입" 클릭하여 계정 생성

2. **API 문서**: http://localhost:3001/api/docs
   - Swagger UI에서 모든 API 테스트 가능

3. **BullMQ 대시보드**: http://localhost:3003
   - 큐 상태 모니터링

### 첫 번째 사용자 생성 (API로)

```powershell
# PowerShell에서 실행
$body = @{
    email = "test@example.com"
    password = "test123456"
    name = "테스트 사용자"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## 8단계: 기능 테스트

### 1. 로그인
웹: http://localhost:3000/auth/login
- 이메일: test@example.com
- 비밀번호: test123456

### 2. 대시보드 확인
http://localhost:3000/dashboard

### 3. API 테스트
Swagger UI에서:
1. `/api/auth/login` - 로그인하여 토큰 받기
2. "Authorize" 버튼 클릭 - 토큰 입력
3. `/api/stocks/search?q=삼성` - 종목 검색 테스트

## 문제 해결

### "pnpm: 명령을 찾을 수 없습니다"
```powershell
npm install -g pnpm
```

### Docker 컨테이너가 시작되지 않음
```powershell
# Docker Desktop이 실행 중인지 확인
# 모든 컨테이너 중지 후 재시작
docker compose -f docker/docker-compose.dev.yml down
docker compose -f docker/docker-compose.dev.yml up -d
```

### 포트가 이미 사용 중
```powershell
# .env 파일에서 포트 변경
# API_PORT=3001 → API_PORT=3011
# WEB_PORT=3000 → WEB_PORT=3010
```

### Prisma 오류
```powershell
# Prisma 클라이언트 재생성
pnpm db:generate
```

## 개발 팁

### 로그 확인
- API 로그: 터미널 1에서 실시간 확인
- Worker 로그: 터미널 2에서 실시간 확인
- Docker 로그: `docker compose -f docker/docker-compose.dev.yml logs -f`

### 데이터베이스 확인
```powershell
# Prisma Studio 실행
pnpm db:studio

# 또는 PostgreSQL 직접 접속
docker exec -it stockboom-postgres psql -U stockboom
```

### 코드 변경 시
- API와 Worker는 자동으로 재시작됨 (hot reload)
- Web도 자동으로 새로고침됨 (Fast Refresh)

## 다음 단계

1. **종목 데이터 수집**
   - Swagger UI에서 `/api/stocks/search` 사용

2. **포트폴리오 생성**
   - 대시보드에서 "새 포트폴리오" 클릭

3. **전략 테스트**
   - `/api/strategies` 엔드포인트 사용

4. **알림 설정**
   - `/api/alerts` 엔드포인트 사용

## 종료 방법

```powershell
# 각 터미널에서 Ctrl+C

# Docker 컨테이너 중지
docker compose -f docker/docker-compose.dev.yml down

# (선택) 볼륨까지 삭제
docker compose -f docker/docker-compose.dev.yml down -v
```

## 도움말

- **README.md**: 프로젝트 개요
- **DEVELOPMENT.md**: 상세 개발 가이드
- **API.md**: API 레퍼런스
- **Swagger UI**: http://localhost:3001/api/docs

---

**문제가 있나요?**
1. 모든 단계를 순서대로 따라했는지 확인
2. Docker Desktop이 실행 중인지 확인
3. 포트 충돌이 없는지 확인 (3000, 3001, 5432, 6379)
4. .env 파일이 올바르게 설정되었는지 확인
