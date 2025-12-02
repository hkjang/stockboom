# 교육 및 학습 가이드 (Education & Training Guide)

## 1. 개요
본 문서는 StockBoom 시스템의 신규 개발자, 운영자, 관리자가 시스템을 빠르게 이해하고 업무에 적응할 수 있도록 단계별 학습 로드맵과 자료를 제공합니다.

## 2. 역할별 학습 로드맵

### 2.1 신입 개발자 (Developer)
1. **1주차: 시스템 이해 및 환경 설정**
   - [ ] [README.md](../../README.md) 정독: 프로젝트 개요 및 기술 스택 파악
   - [ ] [개발자 가이드](../developer-guide.md) 정독: 아키텍처 및 모듈 구조 이해
   - [ ] 로컬 개발 환경 구축 ([환경 가이드](../technical/environment.md) 참조)
   - [ ] `Hello World` API 생성 및 테스트 실습

2. **2주차: 핵심 모듈 분석**
   - [ ] [모듈 설계 가이드](../developer/module-design.md) 학습
   - [ ] 데이터 수집(Worker) -> 저장(DB) -> 조회(API) 흐름 코드 분석
   - [ ] [테스트 가이드](../developer/testing.md)에 따라 단위 테스트 작성 실습

3. **3주차: 기능 구현 및 배포**
   - [ ] 간단한 신규 기능(예: 새로운 기술적 지표 추가) 구현
   - [ ] PR 생성 및 [코드 표준](../developer/coding-standards.md) 준수 여부 리뷰 받기
   - [ ] CI/CD 파이프라인 동작 확인

### 2.2 신입 운영자 (Operator)
1. **기초 단계**
   - [ ] [운영자 가이드](../operator-guide.md) 학습
   - [ ] Docker Compose 명령어 및 컨테이너 로그 확인 방법 실습
   - [ ] [서버 운영 가이드](../operator/server-operation.md) 숙지

2. **심화 단계**
   - [ ] [모니터링 가이드](../operator/monitoring-alert.md) 학습: Grafana 대시보드 해석법
   - [ ] [장애 대응 가이드](../operator/incident-response.md) 학습: 시나리오별 모의 훈련
   - [ ] 백업 및 복구 절차 실습 (테스트 환경)

### 2.3 관리자 (Admin)
1. **기능 숙지**
   - [ ] [관리자 가이드](../admin-guide.md) 및 [사용자 가이드](../user-guide.md) 정독
   - [ ] 관리자 대시보드 메뉴별 기능 직접 확인
   - [ ] [포트폴리오 관리](../admin/portfolio-management.md) 및 [사용자 관리](../admin/user-management.md) 실습

2. **위험 관리**
   - [ ] [위험 관리 가이드](../admin/risk-management.md) 학습
   - [ ] 알림 설정 및 수신 테스트
   - [ ] AI 분석 리포트 해석 방법 학습

## 3. 실습 시나리오 (Hands-on Labs)

### Lab 1: 신규 종목 수집 및 매매 테스트
1. 로컬 환경에서 `npm run dev`로 시스템 실행
2. 관리자 계정으로 로그인 후 '삼성전자' 종목 추가
3. Worker 로그에서 데이터 수집 과정 확인
4. RSI 전략 생성 후 백테스팅 실행
5. 모의투자 모드로 자동 매매 활성화 및 주문 체결 확인

### Lab 2: 장애 조치 모의 훈련
1. 의도적으로 Redis 컨테이너 중지 (`docker stop stockboom-redis`)
2. API 호출 시 에러 발생 확인 및 로그 분석
3. [장애 대응 가이드](../operator/incident-response.md)에 따라 Redis 재시작 및 서비스 복구
4. 유실된 작업이 있는지 BullMQ 대시보드에서 확인

## 4. 체크리스트 (Onboarding Checklist)
- [ ] 개발/운영 환경 접속 권한 획득 (VPN, SSH, DB 등)
- [ ] 필수 도구 설치 (Docker, Node.js, IDE, DB Client)
- [ ] 보안 규정 서약 및 [보안 가이드](../technical/security.md) 숙지
- [ ] 팀 커뮤니케이션 채널(Slack, Jira) 초대 확인
