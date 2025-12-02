# StockBoom 설치 체크리스트

프로젝트를 실행하기 전에 다음 항목들을 확인하세요.

## ☑️ 필수 소프트웨어

- [ ] **Node.js 18+** 설치됨
  ```powershell
  node --version
  # v18.0.0 이상이어야 함
  ```

- [ ] **pnpm** 설치됨
  ```powershell
  # 설치
  npm install -g pnpm
  
  # 확인
  pnpm --version
  # 8.0.0 이상이어야 함
  ```

- [ ] **Docker Desktop** 설치 및 실행 중
  ```powershell
  docker --version
  docker compose version
  ```

## ☑️ 프로젝트 설정

- [ ] **의존성 설치**
  ```powershell
  cd C:\Users\USER\projects\stockboom
  pnpm install
  ```

- [ ] **.env 파일 생성 및 설정**
  ```powershell
  Copy-Item .env.example .env
  # .env 파일을 열어 다음 항목 필수 수정:
  # - JWT_SECRET
  # - ENCRYPTION_KEY
  ```

- [ ] **Docker 컨테이너 시작**
  ```powershell
  docker compose -f docker/docker-compose.dev.yml up -d
  
  # 확인
  docker ps
  # postgres, redis, bullmq-board 실행중이어야 함
  ```

- [ ] **데이터베이스 초기화**
  ```powershell
  pnpm db:generate
  pnpm db:push
  ```

## ☑️ 서버 실행

**3개의 터미널 필요**

- [ ] **터미널 1: API 서버**
  ```powershell
  cd apps/api
  pnpm dev
  # http://localhost:3001 에서 실행되어야 함
  ```

- [ ] **터미널 2: Worker**
  ```powershell
  cd apps/worker
  pnpm dev
  # 4개 워커가 시작되어야 함
  ```

- [ ] **터미널 3: Web**
  ```powershell
  cd apps/web
  pnpm dev
  # http://localhost:3000 에서 실행되어야 함
  ```

## ☑️ 동작 확인

- [ ] **웹 앱 접속**: http://localhost:3000
  - 랜딩 페이지가 보임

- [ ] **API 문서 접속**: http://localhost:3001/api/docs
  - Swagger UI가 보임

- [ ] **BullMQ 대시보드**: http://localhost:3003
  - 큐 모니터링 페이지가 보임

- [ ] **회원가입 테스트**
  - http://localhost:3000/auth/register
  - 계정 생성 후 로그인

- [ ] **대시보드 접속**
  - http://localhost:3000/dashboard
  - 로그인 후 대시보드가 보임

## ☑️ API 테스트

- [ ] **Swagger에서 테스트**
  1. `/api/auth/login` - 로그인
  2. "Authorize" 클릭 - 토큰 입력
  3. `/api/stocks/search?q=test` - 검색 테스트

## 🐛 문제 발생 시

### pnpm이 인식되지 않음
```powershell
npm install -g pnpm
# PowerShell 재시작
```

### Docker 오류
```powershell
# Docker Desktop이 실행 중인지 확인
# 컨테이너 재시작
docker compose -f docker/docker-compose.dev.yml down
docker compose -f docker/docker-compose.dev.yml up -d
```

### 포트 충돌
```powershell
# 사용 중인 포트 확인
netstat -ano | findstr "3000"
netstat -ano | findstr "3001"

# .env에서 포트 변경
```

### Prisma 오류
```powershell
pnpm db:generate
```

## ✅ 모든 항목 완료!

프로젝트가 정상적으로 실행되고 있습니다!

다음 문서를 참고하세요:
- **README.md**: 프로젝트 개요
- **QUICKSTART.md**: 빠른 시작 가이드
- **DEVELOPMENT.md**: 개발 가이드
- **API.md**: API 레퍼런스
