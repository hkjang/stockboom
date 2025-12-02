# StockBoom 문서 (Documentation)

이 폴더에는 StockBoom 주식 자동 매매 시스템의 상세 가이드가 포함되어 있습니다.

## 📚 가이드 목록

### 1. [개발자용 가이드](./developer-guide.md) 👨‍💻
**대상**: 백엔드/프론트엔드 개발자, DevOps 엔지니어

- **기본 가이드**: [시스템 아키텍처 및 API 명세](./developer-guide.md)
- **상세 가이드**:
  - [모듈별 상세 설계](./developer/module-design.md): 수집, 분석, 매매, 알림 모듈 구조
  - [코드 작성 표준](./developer/coding-standards.md): TypeScript, NestJS, Next.js 스타일 가이드
  - [테스트 가이드](./developer/testing.md): 단위/통합/E2E 테스트 전략
  - [배포 및 CI/CD](./developer/deployment-cicd.md): Docker Compose 배포 및 Git 전략

### 2. [운영자용 가이드](./operator-guide.md) 🔧
**대상**: 시스템 운영자, 인프라 관리자

- **기본 가이드**: [배포 및 운영 절차](./operator-guide.md)
- **상세 가이드**:
  - [서버 운영](./operator/server-operation.md): 상태 점검, DB 관리, 로그 분석
  - [장애 대응](./operator/incident-response.md): 시나리오별 복구 절차 및 롤백
  - [모니터링 & 알림](./operator/monitoring-alert.md): Prometheus/Grafana 설정

### 3. [관리자용 가이드](./admin-guide.md) 👔
**대상**: 서비스 관리자, 비즈니스 운영팀

- **기본 가이드**: [관리자 대시보드 및 운영](./admin-guide.md)
- **상세 가이드**:
  - [포트폴리오 관리](./admin/portfolio-management.md): 성과 분석 및 전략 검토
  - [사용자 관리](./admin/user-management.md): 계정, 권한, 증권사 연동 관리
  - [알림 & 위험 관리](./admin/risk-management.md): 실시간 위험 대응 및 정책

### 4. [사용자용 가이드](./user-guide.md) 👤
**대상**: 일반 사용자, 투자자

- **기본 가이드**: [서비스 이용 방법](./user-guide.md)
- **상세 가이드**:
  - [계정 & 인증](./user/account-auth.md): 회원가입, 2FA, API 연동
  - [포트폴리오 & 종목](./user/portfolio-stock.md): 자산 관리 및 종목 검색
  - [자동 매매 전략](./user/trading-strategy.md): 전략 설정 및 백테스팅
  - [알림 & AI 활용](./user/alert-ai.md): 투자 정보 활용법

### 5. 기술 심화 가이드 🔬
**대상**: 아키텍트, 보안 담당자, 데이터 사이언티스트

- [데이터 가이드](./technical/data.md): 데이터 구조, TTL, 표준화
- [보안 가이드](./technical/security.md): 암호화, 네트워크 보안, 접근 제어
- [AI 모델 가이드](./technical/ai-model.md): 분석 모델 구조 및 학습 주기
- [운영 환경 가이드](./technical/environment.md): 환경별 구성 및 변수 관리

### 6. 교육 자료 🎓
**대상**: 신규 입사자, 시스템 학습자

- [교육/학습 가이드](./education/training.md): 역할별 로드맵 및 실습 시나리오

---

## 🚀 빠른 시작

### 새로운 사용자
1. [사용자용 가이드](./user-guide.md) → "시작하기" 섹션
2. 계정 생성 및 증권사 API 연동
3. 첫 포트폴리오 생성

### 개발자
1. [개발자용 가이드](./developer-guide.md) → "개발 환경 설정" 섹션
2. [교육/학습 가이드](./education/training.md) → "신입 개발자 로드맵"
3. 로컬 환경 구축 및 코드 분석

### 운영자
1. [운영자용 가이드](./operator-guide.md) → "시스템 배포" 섹션
2. [서버 운영 가이드](./operator/server-operation.md) 숙지
3. 모니터링 대시보드 설정

---

## 📝 문서 업데이트 이력

| 날짜 | 버전 | 변경 사항 |
|------|------|-----------|
| 2025-12-02 | 1.1.0 | 상세 가이드(Developer, Operator, Admin, User, Technical) 추가 |
| 2025-12-02 | 1.0.0 | 초기 문서 생성 (4개 기본 가이드) |

---

**작성자**: StockBoom 개발팀  
**최종 업데이트**: 2025-12-02  
**버전**: 1.1.0
