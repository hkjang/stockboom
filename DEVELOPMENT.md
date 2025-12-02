# StockBoom Development Guide

## 개발 환경 설정

### 필수 요구사항

- **Node.js**: 18.0.0 이상
- **pnpm**: 8.0.0 이상
- **Docker Desktop**: 최신 버전
- **PostgreSQL**: 14+ (Docker로 실행)
- **Redis**: 7+ (Docker로 실행)

### 권장 IDE

- **VS Code** + Extensions:
  - ESLint
  - Prettier
  - Prisma
  - TypeScript
  - Docker

## 프로젝트 구조

```
stockboom/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/          # 인증 모듈
│   │   │   ├── users/         # 사용자 관리
│   │   │   ├── market-data/   # 데이터 수집
│   │   │   ├── stocks/        # 종목 관리
│   │   │   ├── portfolios/    # 포트폴리오
│   │   │   ├── trades/        # 거래 실행
│   │   │   ├── analysis/      # 기술적 분석
│   │   │   ├── strategies/    # 매매 전략
│   │   │   ├── alerts/        # 알림 설정
│   │   │   ├── notifications/ # 알림 발송
│   │   │   └── queue/         # BullMQ 큐
│   │   └── package.json
│   ├── web/                    # Next.js Frontend
│   │   ├── src/
│   │   │   └── app/
│   │   │       ├── auth/      # 인증 페이지
│   │   │       ├── dashboard/ # 대시보드
│   │   │       └── ...
│   │   └── package.json
│   └── worker/                 # BullMQ Workers
│       ├── src/
│       │   └── workers/
│       │       ├── data-collection.worker.ts
│       │       ├── analyzer.worker.ts
│       │       ├── trader.worker.ts
│       │       └── notifier.worker.ts
│       └── package.json
├── packages/
│   ├── database/              # Prisma Schema
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── index.ts
│   └── types/                 # Shared TypeScript Types
│       └── index.ts
└── docker/                    # Docker Configurations
    ├── docker-compose.yml
    ├── docker-compose.dev.yml
    ├── Dockerfile.api
    ├── Dockerfile.web
    └── Dockerfile.worker
```

## 개발 워크플로우

### 1. 초기 설정

```bash
# 저장소 클론
git clone <repository-url>
cd stockboom

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집
```

### 2. 데이터베이스 설정

```bash
# Docker로 PostgreSQL, Redis 시작
docker compose -f docker/docker-compose.dev.yml up -d

# Prisma 클라이언트 생성
pnpm db:generate

# 데이터베이스 마이그레이션
pnpm db:push

# (선택) Prisma Studio로 데이터 확인
pnpm db:studio
```

### 3. 개발 서버 실행

```bash
# 3개 터미널 필요

# 터미널 1: API 서버
cd apps/api
pnpm dev

# 터미널 2: Worker
cd apps/worker
pnpm dev

# 터미널 3: Web 앱
cd apps/web
pnpm dev
```

## API 개발

### 새 모듈 추가

```bash
cd apps/api
nest g module <module-name>
nest g controller <module-name>
nest g service <module-name>
```

### 컨트롤러 예시

```typescript
@Controller('example')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExampleController {
  @Get()
  @ApiOperation({ summary: 'Get examples' })
  async findAll() {
    return [];
  }
}
```

### 서비스 예시

```typescript
@Injectable()
export class ExampleService {
  async findAll() {
    return prisma.example.findMany();
  }
}
```

## 데이터베이스 스키마 수정

```bash
# 1. schema.prisma 파일 수정

# 2. Prisma 클라이언트 재생성
pnpm db:generate

# 3. 개발 환경: Push
pnpm db:push

# 4. 프로덕션: Migration 생성
pnpm --filter @stockboom/database prisma migrate dev --name <migration-name>
```

## 테스트

### 단위 테스트

```bash
cd apps/api
pnpm test
```

### E2E 테스트

```bash
cd apps/api
pnpm test:e2e
```

### API 테스트 (Swagger)

http://localhost:3001/api/docs

## BullMQ 워커 개발

### 새 워커 추가

```typescript
// apps/worker/src/workers/example.worker.ts
import { Worker, Job } from 'bullmq';
import type { Redis } from 'ioredis';

export class ExampleWorker {
  private worker: Worker;

  constructor(private connection: Redis) {
    this.worker = new Worker(
      'example-queue',
      async (job: Job) => {
        return this.processJob(job);
      },
      { connection: this.connection, concurrency: 5 }
    );
  }

  async processJob(job: Job) {
    console.log(`Processing ${job.id}`);
    // 작업 처리
    return { success: true };
  }

  async start() {
    console.log('Example Worker started');
  }

  async stop() {
    await this.worker.close();
  }
}
```

## 프론트엔드 개발

### 새 페이지 추가

```bash
# apps/web/src/app/<page-name>/page.tsx 생성
```

### API 호출 예시

```typescript
const token = localStorage.getItem('token');

const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
```

## 환경 변수

### 필수 환경 변수

```bash
# 데이터베이스
DATABASE_URL="postgresql://stockboom:password@localhost:5432/stockboom"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# 한국투자증권 API
KIS_APP_KEY="your-app-key"
KIS_APP_SECRET="your-app-secret"
KIS_ACCOUNT_NUMBER="your-account"
KIS_MOCK_MODE="true"

# OpenAI (선택)
OPENAI_API_KEY="your-key"

# 이메일
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email"
SMTP_PASSWORD="your-password"
```

## 디버깅

### VS Code 디버그 설정

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/apps/api",
      "console": "integratedTerminal"
    }
  ]
}
```

### 로그 확인

```bash
# API 로그
cd apps/api
pnpm dev

# Worker 로그
cd apps/worker
pnpm dev

# Docker 로그
docker compose -f docker/docker-compose.dev.yml logs -f
```

## 코드 스타일

### 자동 포맷팅

```bash
# 전체 프로젝트
pnpm lint

# 특정 앱
cd apps/api
pnpm lint
```

### Commit 메시지 규칙

```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드/설정 변경
```

## 배포

### Docker 빌드

```bash
# 전체 스택 빌드
docker compose -f docker/docker-compose.yml build

# 실행
docker compose -f docker/docker-compose.yml up -d
```

### 프로덕션 체크리스트

- [ ] 환경 변수 설정 (.env.production)
- [ ] JWT_SECRET 변경
- [ ] 데이터베이스 마이그레이션
- [ ] API 키 암호화 설정
- [ ] CORS 설정 확인
- [ ] Rate limiting 활성화
- [ ] 모니터링 설정 (Grafana)
- [ ] 백업 설정

## 트러블슈팅

### 자주 발생하는 문제

**1. Prisma 클라이언트 오류**
```bash
pnpm db:generate
```

**2. 포트 충돌**
```bash
# .env 파일에서 포트 변경
API_PORT=3001
WEB_PORT=3000
```

**3. Docker 연결 오류**
```bash
docker compose -f docker/docker-compose.dev.yml down
docker compose -f docker/docker-compose.dev.yml up -d
```

**4. pnpm 캐시 문제**
```bash
pnpm store prune
pnpm install
```

## 유용한 명령어

```bash
# 전체 빌드
pnpm build

# 클린 빌드
pnpm clean
pnpm install
pnpm build

# 데이터베이스 리셋
pnpm --filter @stockboom/database prisma migrate reset

# Docker 완전 삭제
docker compose -f docker/docker-compose.dev.yml down -v
```

## 참고 자료

- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [BullMQ Documentation](https://docs.bullmq.io)
- [한국투자증권 API](https://apiportal.koreainvestment.com)

## 라이선스

MIT License
