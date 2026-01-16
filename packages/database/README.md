# @stockboom/database 패키지

Prisma ORM을 사용한 데이터베이스 클라이언트 패키지입니다.

## 파일 구조

```
packages/database/
├── index.ts       # TypeScript 타입 정의 (IDE 지원용)
├── index.js       # CommonJS 런타임 build (필수!)
├── package.json
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

## ⚠️ 중요: index.js가 필요한 이유

NestJS가 `@stockboom/database`를 import할 때 CommonJS `require()`를 사용합니다.  
TypeScript 파일(index.ts)은 직접 실행되지 않으므로, **반드시 index.js가 있어야 합니다**.

### 문제 증상
```
TypeError: Cannot read properties of undefined (reading 'user')
```
→ `prisma.user`가 undefined일 때 발생

### 해결책
`index.js`가 존재하고 `package.json`의 `main`이 `./index.js`를 가리키는지 확인

## package.json 설정

```json
{
  "main": "./index.js",   // ← 런타임 엔트리 (CommonJS)
  "types": "./index.ts"   // ← 타입 정의 (TypeScript)
}
```

## 자주 사용하는 명령어

```bash
# Prisma 클라이언트 생성 (스키마 변경 후 필수)
pnpm db:generate

# 데이터베이스 스키마 적용
pnpm db:push

# 시드 데이터 삽입
$env:DATABASE_URL="postgresql://stockboom:stockboom_password@localhost:5432/stockboom?schema=public"
pnpm db:seed

# Prisma Studio (DB GUI)
pnpm db:studio
```

## 체크리스트

스키마 변경 후:
1. [ ] `pnpm db:generate` 실행
2. [ ] `pnpm db:push` 또는 `pnpm db:migrate` 실행
3. [ ] dev 서버 재시작

패키지 문제 발생 시:
1. [ ] `packages/database/index.js` 파일 존재 확인
2. [ ] `package.json`의 `main` 필드가 `./index.js`인지 확인
3. [ ] 모든 node 프로세스 종료 후 `pnpm db:generate` 재실행
