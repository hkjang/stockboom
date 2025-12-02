# 코드 작성 표준 및 스타일 가이드 (Coding Standards & Style Guide)

## 1. 개요
본 문서는 StockBoom 프로젝트의 코드 일관성과 품질 유지를 위한 개발 표준을 정의합니다. 모든 기여자는 본 가이드를 준수해야 합니다.

## 2. 일반 원칙
- **언어**: TypeScript (Strict Mode)
- **포맷팅**: Prettier (설정 파일 `.prettierrc` 준수)
- **린팅**: ESLint (설정 파일 `.eslintrc.js` 준수)
- **주석**: 복잡한 로직에는 반드시 주석 작성 (JSDoc 권장)

## 3. 네이밍 컨벤션 (Naming Conventions)

### 3.1 일반
- **변수/함수**: `camelCase` (예: `getUser`, `stockPrice`)
- **클래스/인터페이스/타입**: `PascalCase` (예: `UserService`, `StockData`)
- **상수**: `UPPER_SNAKE_CASE` (예: `MAX_RETRY_COUNT`)
- **파일**: `kebab-case` (예: `user.service.ts`, `stock-chart.tsx`)

### 3.2 NestJS
- **Module**: `*.module.ts`
- **Controller**: `*.controller.ts`
- **Service**: `*.service.ts`
- **DTO**: `*.dto.ts` (예: `create-user.dto.ts`)
- **Entity**: `*.entity.ts`

### 3.3 Next.js (React)
- **Component**: `PascalCase` 파일명 (예: `StockChart.tsx`)
- **Hook**: `use` 접두사 + `camelCase` (예: `useStockData.ts`)
- **Page**: `page.tsx`, `layout.tsx` (App Router 규칙 준수)

## 4. 프로젝트 구조 (Project Structure)

### 4.1 Monorepo (Turborepo)
```
stockboom/
├── apps/
│   ├── api/          # NestJS Backend
│   ├── web/          # Next.js Frontend
│   └── worker/       # BullMQ Worker
├── packages/
│   ├── database/     # Prisma Schema & Client
│   ├── types/        # Shared Types
│   └── utils/        # Shared Utilities
└── docs/             # Documentation
```

### 4.2 Backend (NestJS)
모듈 기반 구조를 따릅니다.
```
src/
├── modules/
│   ├── users/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   └── ...
├── common/           # Guards, Interceptors, Filters
└── config/           # Configuration
```

## 5. 코드 작성 규칙

### 5.1 TypeScript
- `any` 타입 사용 지양 (불가피한 경우 주석으로 이유 명시)
- 인터페이스(`interface`)를 사용하여 객체 형태 정의
- 유틸리티 타입(`Partial`, `Pick`, `Omit` 등) 적극 활용

### 5.2 NestJS
- **의존성 주입**: 생성자 주입 방식 사용
- **환경 변수**: `@nestjs/config`를 통해 접근 (직접 `process.env` 사용 지양)
- **유효성 검사**: `class-validator` 및 `class-transformer` 사용

### 5.3 Next.js
- **Server Components**: 가능한 경우 서버 컴포넌트 활용 (데이터 페칭 등)
- **Client Components**: 상호작용이 필요한 경우에만 `'use client'` 사용
- **TailwindCSS**: 유틸리티 클래스 사용, 복잡한 스타일은 `@layer components`로 분리

### 5.4 Prisma Schema
- 모델명: `PascalCase` (단수형)
- 필드명: `camelCase`
- 테이블 매핑: `@@map("table_name_snake_case")` 사용
- 관계 필드: 명확한 관계 정의 (`@relation`)

## 6. 에러 처리 및 로깅

### 6.1 에러 처리
- **Backend**: `HttpException`을 상속받은 예외 클래스 사용
- **Global Filter**: `AllExceptionsFilter`를 통해 일관된 에러 응답 포맷 유지
- **Frontend**: `ErrorBoundary` 및 `try-catch` 블록 활용, 사용자 친화적 메시지 표시

### 6.2 로깅
- `Logger` 서비스 사용 (`console.log` 지양)
- 로그 레벨 준수:
  - `log`: 일반적인 정보
  - `error`: 에러 발생 (스택 트레이스 포함)
  - `warn`: 경고 (예상치 못한 상황, 비치명적)
  - `debug`: 디버깅용 상세 정보 (개발 환경)

## 7. Git 워크플로우
- **브랜치 전략**: Feature Branch Workflow
  - `main`: 배포 가능한 안정 상태
  - `feature/기능명`: 새로운 기능 개발
  - `fix/버그명`: 버그 수정
- **커밋 메시지**: Conventional Commits 준수
  - `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`

---
본 가이드는 프로젝트 진행 상황에 따라 업데이트될 수 있습니다.
