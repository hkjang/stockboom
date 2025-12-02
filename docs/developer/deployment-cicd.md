# 배포 및 CI/CD 가이드 (Deployment & CI/CD Guide)

## 1. 개요
본 문서는 StockBoom 시스템의 배포 절차와 CI/CD 파이프라인 구성을 설명합니다.

## 2. 배포 아키텍처
- **컨테이너화**: 모든 서비스(API, Web, Worker)는 Docker 이미지로 빌드됩니다.
- **오케스트레이션**: Docker Compose를 사용하여 멀티 컨테이너 애플리케이션을 관리합니다.
- **리버스 프록시**: Nginx(선택 사항)를 앞단에 두어 SSL 처리 및 로드 밸런싱을 수행할 수 있습니다.

## 3. Docker Compose 배포 절차

### 3.1 사전 준비
- Docker 및 Docker Compose 설치
- 도메인 및 SSL 인증서 준비 (프로덕션 환경)
- 환경 변수 파일(`.env.production`) 설정

### 3.2 배포 단계
1. **코드 최신화**: `git pull origin main`
2. **환경 변수 확인**: `.env.production` 파일 검토
3. **빌드 및 실행**:
   ```bash
   docker compose -f docker/docker-compose.yml build
   docker compose -f docker/docker-compose.yml up -d
   ```
4. **상태 확인**: `docker compose ps`
5. **로그 모니터링**: `docker compose logs -f`

### 3.3 무중단 배포 (Blue/Green) - *고급*
- 현재 Docker Compose 구성은 롤링 업데이트를 기본적으로 지원하지 않습니다.
- 무중단 배포가 필요한 경우 Kubernetes(K8s) 도입 또는 Nginx를 활용한 Blue/Green 배포 스크립트 작성이 필요합니다.

## 4. Git 브랜치 전략 (Git Branch Strategy)

### 4.1 Feature Branch Workflow
- **main**: 배포 가능한 안정적인 상태 (Protected Branch)
- **develop**: (선택 사항) 다음 릴리스를 위한 통합 브랜치
- **feature/**: 새로운 기능 개발 (예: `feature/login-page`)
- **fix/**: 버그 수정 (예: `fix/api-timeout`)
- **hotfix/**: 프로덕션 긴급 수정

### 4.2 Pull Request (PR) 프로세스
1. 기능 개발 완료 후 PR 생성
2. CI 파이프라인 통과 확인 (테스트, 린트, 빌드)
3. 동료 리뷰 (Code Review) - 최소 1명 승인 필요
4. Squash & Merge로 커밋 히스토리 정리하며 병합

## 5. CI/CD 자동화 (GitHub Actions 예시)

### 5.1 CI 워크플로우 (`.github/workflows/ci.yml`)
```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'pnpm'
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Lint
      run: pnpm lint
      
    - name: Type Check
      run: pnpm type-check
      
    - name: Test
      run: pnpm test
      
    - name: Build
      run: pnpm build
```

### 5.2 CD 워크플로우 (예시)
- **Docker Hub Push**: `main` 브랜치 병합 시 Docker 이미지 빌드 및 레지스트리 푸시
- **Deploy**: SSH를 통해 운영 서버에 접속하여 `docker compose pull && docker compose up -d` 실행

## 6. 환경별 설정 관리
- **Development**: `.env.development` (로컬 개발)
- **Staging**: `.env.staging` (통합 테스트 서버)
- **Production**: `.env.production` (운영 서버 - 보안 주의)
- **Secrets**: API Key, DB Password 등 민감 정보는 GitHub Secrets 및 서버 환경 변수로 관리
