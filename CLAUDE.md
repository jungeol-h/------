# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 프로젝트 개요

**안동형 자기주도학습·진로성장 관리 시스템** — 사업 심사위원 시연용 프론트엔드 중심 1차 프로토타입.

### 현재 상태 (2026-04-24)
- 기존 **학습 진단 사이트** 코드가 `src/`에 있음 → **`src/legacy/`로 이동 예정**
- 신규 **다중 역할 교육 플랫폼** 프로토타입을 앱 메인으로 구축 예정
- 상세 구현 계획: `~/.claude/plans/elegant-knitting-nest.md` 참조

### 신규 플랫폼 핵심 결정사항
- **1차 역할:** 학생, 학습매니저, 관리자 (3개 먼저)
- **레이아웃:** 모바일 탭 바 (하단 네비게이션)
- **CSS:** Tailwind CSS 도입
- **데이터:** Mock 데이터 + LocalStorage (백엔드 없음)
- **시연 흐름:** 학생(마인드 "힘듦" 입력) → 매니저(🚨알림/코칭) → 관리자(통계/인쇄)

---

## 개발 환경 명령어

```bash
npm run dev       # 개발 서버 실행 (Vite + HMR)
npm run build     # 프로덕션 빌드
npm run lint      # ESLint 검사
npm run preview   # 빌드 결과 미리보기
```

---

## 기술 스택

- **React 19** + **Vite 8** (JSX, not TypeScript)
- **react-router-dom v7** — BrowserRouter 기반 SPA 라우팅
- **Recharts** — 레이더 차트 등 데이터 시각화
- **Supabase** — `admin_config` 테이블에 피드백/연습카드 설정 저장 (연결 실패 시 로컬 기본값 fallback)
- **html2canvas / jsPDF / html-to-image** — PDF 리포트 출력

---

## 기존 학습 진단 사이트 아키텍처 (→ src/legacy/ 이동 예정)

### 라우팅 구조 (`src/App.jsx`)

```
/           → IntroPage       (시작 화면)
/info       → PersonalInfoPage (개인정보 입력)
/pre-survey → PreSurveyPage   (사전설문, studentName 필요)
/survey     → SurveyPage      (진단 문항, studentName 필요)
/result     → ResultPage      (결과 탭 뷰, isCompleted + result 필요)
/complete   → CompletePage    (완료 화면)
/admin      → AdminPage       (관리자 설정 대시보드)
```

`ProtectedRoute`는 `DiagnosisContext`의 상태를 condition 함수로 검사해서 조건 불만족 시 redirectTo로 보냄.

### 전역 상태 (`src/context/`)

**DiagnosisContext** — 진단 세션 전체 상태 관리.
- `useReducer` 기반, 상태는 `sessionStorage`에 자동 저장/복원.
- 주요 상태: `studentName`, `preSurvey`, `answers[]`, `shuffledQuestions`, `currentIndex`, `isCompleted`, `result`.
- `NEXT_QUESTION` 액션 처리 시 마지막 문항이면 `buildResult()`를 호출해 result 생성.

**AdminConfigContext** — Supabase에서 `admin_config` 테이블을 로드해 피드백 라이브러리와 연습카드 커스텀 설정을 제공. SurveyPage에서 config를 주입받아 `NEXT_QUESTION` dispatch 시 함께 넘김.

### 핵심 로직 (`src/utils/scoreCalculator.js`)

1. `calcDomainScores(answers, shuffledQuestions)` — 답변 배열 → 영역별 100점 환산 점수
2. `scoreToGrade(score)` — A~E 등급 변환 (90↑ A, 80↑ B, 70↑ C, 60↑ D, 미만 E)
3. `buildResult()` — 전체 점수, 등급, 학습자 유형(주도형/전략형/노력형), 코칭 메시지, 연습카드를 종합해 result 객체 반환

### 데이터 파일 (`src/data/`)

- `questions.js` — 진단 문항 정의, 영역(domain) 분류, `DOMAIN_ORDER`, `DOMAIN_LABELS` 상수
- `feedbackLibrary.js` — 영역·등급별 피드백 텍스트 라이브러리
- `coachingTemplates.js` — 결과 유형별 종합 코칭/요약 문구 빌더 함수들

### 결과 컴포넌트 (`src/components/result/`)

ResultPage는 탭 방식으로 3개 페이지를 렌더링:
- `Page1Summary` — 레이더 차트 + 영역별 등급 배지
- `Page2Detail` — 세부 영역 점수 상세
- `Page3Coaching` — 코칭 메시지 + 연습카드
- `PdfReport` — html2canvas/jsPDF로 PDF 출력용 숨김 컴포넌트

### Supabase 설정 (`src/lib/supabase.js`)

환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 필요. 없거나 연결 실패해도 `loadAdminConfig()`가 로컬 기본값으로 fallback하므로 진단 기능 자체는 동작함.

---

## 프로토타입 개발 제약 사항

- **백엔드/DB 신규 구축 금지** — 더미 데이터는 `src/mocks/mockData.js`(또는 `.ts`)에 하드코딩
- **PDF 출력** — Puppeteer 등 서버 렌더링 사용 금지, `window.print()` 또는 html2canvas/jsPDF만 사용
- **신규 플랫폼 로그인** — 퀵-로그인 5개 버튼(학생/학부모/강사/학습매니저/관리자)으로 역할 전환
- **상세 기획 문서 위치:**
  - `docs/1차 프로토타입 개발/` — 더미 스펙, 시연 시나리오, 퀵-로그인 명세
  - `docs/전체 개발 스코프/유저별/` — 권한별 화면/유저스토리 명세
  - `docs/개념 정리/` — 자기주도지수 산출 로직, 다대다 배정 구조 등 도메인 개념
