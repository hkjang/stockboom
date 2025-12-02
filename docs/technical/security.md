# 보안 가이드 (Security Guide)

## 1. 개요
본 문서는 StockBoom 시스템의 보안 아키텍처와 데이터 보호 정책, 접근 제어 방안을 설명합니다.

## 2. 인증 및 권한 관리 (IAM)

### 2.1 사용자 인증
- **JWT (JSON Web Token)**: Access Token(수명 1시간)과 Refresh Token(수명 7일) 사용
- **비밀번호 저장**: bcrypt 알고리즘(Salt Rounds 10)으로 해싱하여 저장
- **2단계 인증 (2FA)**: TOTP (Time-based One-Time Password) 표준 지원

### 2.2 API 접근 제어
- **Rate Limiting**: IP당 분당 요청 횟수 제한 (DDoS 방지)
- **Role-Based Access Control (RBAC)**:
  - `@Roles('ADMIN')`: 관리자 전용 API 보호
  - `@UseGuards(JwtAuthGuard)`: 인증된 사용자만 접근 허용

## 3. 데이터 암호화

### 3.1 전송 구간 암호화
- **HTTPS/TLS**: 모든 API 통신은 TLS 1.2 이상 암호화 프로토콜 사용
- **WebSocket**: WSS (Secure WebSocket) 프로토콜 사용

### 3.2 저장 데이터 암호화
- **민감 정보**: 증권사 API Key, Secret 등은 AES-256-GCM 알고리즘으로 암호화하여 DB 저장
- **키 관리**: 암호화 키(Encryption Key)는 소스코드와 분리하여 환경 변수 또는 KMS(Key Management Service)로 관리

## 4. 네트워크 보안

### 4.1 망 분리
- **Public Subnet**: Load Balancer, Bastion Host
- **Private Subnet**: API Server, Worker, Database, Redis (외부 직접 접근 차단)

### 4.2 방화벽 (Security Group)
- **Database**: API/Worker 서버의 IP에서만 5432 포트 접근 허용
- **Redis**: API/Worker 서버의 IP에서만 6379 포트 접근 허용
- **SSH**: Bastion Host를 통해서만 접근 가능하며, 특정 관리자 IP만 허용

## 5. 운영 보안

### 5.1 감사 로그 (Audit Log)
- **대상**: 로그인, 비밀번호 변경, API Key 조회, 관리자 권한 행사 등 주요 행위
- **기록**: 수행자 IP, 시간, 행위 내용, 결과 등을 별도 로그 테이블 또는 파일로 기록

### 5.2 취약점 점검
- **정기 점검**: 월 1회 의존성 패키지 취약점 스캔 (`npm audit`)
- **코드 스캔**: CI 파이프라인에서 SAST(Static Application Security Testing) 도구 실행
