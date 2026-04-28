# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 프로젝트 개요

**안동형 자기주도학습·진로성장 관리 시스템** — 사업 심사위원 시연용 프론트엔드 중심 1차 프로토타입.

### 현재 상태 (2026-04-24) — Phase A~D + UI 폴리싱 완료
- 기존 학습 진단 코드 → `src/legacy/` 이동 완료
- 신규 플랫폼 `src/platform/` 아래 구축 완료
- 시연 핵심 시나리오 전 흐름 동작 중
- **배포:** `andong.gooooookee.com` (서브도메인, Vercel)

### 신규 플랫폼 구조 (`src/platform/`)
```
context/
  AuthContext.jsx     — 퀵 로그인(6버튼: 학생/매니저/관리자 활성, 3개 준비중), LocalStorage 유지
  DataContext.jsx     — Mock 데이터 CRUD + LocalStorage 동기화
mocks/
  mockData.js         — 학생5, 교육자3, 마인드/학습/알림 등 더미 데이터
components/layout/
  PageLayout.jsx, Header.jsx, TabBar.jsx, ProtectedRoute.jsx
pages/
  LoginPage.jsx
  student/            — 5탭: 홈/학습/과제/마인드/진로
  manager/            — 3탭: 홈/학생목록/상담
  admin/              — 3탭: 홈/통계/사용자
```

### 라우팅 구조 (`src/App.jsx`)
```
/           → LoginPage (퀵 로그인)
/student/*  → StudentDashboard (5탭)
/manager/*  → ManagerDashboard (3탭)
/admin/*    → AdminDashboard (3탭)
```

### 구현 완료 기능 (Phase A~D)
- **학생:** 학습 타이머(스톱워치), 과목/집중도 기록, 주간 학습 BarChart, 마인드 기록(Smile/Meh/Frown 아이콘), 진로 흥미 설문 → 유형 결과, 과제 체크
- **매니저:** 알림→코칭 모달→해제 흐름, 학생 카드 미니 LineChart, 학생 상세 모달(주간 차트 + 마인드 기록)
- **관리자:** 통계 Recharts 차트(출석/자기주도지수/참여도), M:N 배정 현황 테이블, A4 인쇄 리포트(`window.print()`)

### UI 결정사항
- **아이콘:** `lucide-react` 사용. 이모지 아이콘 사용 금지 (UI 아이콘 용도로)
- **z-index:** Header/TabBar = `z-40`, 모달 = `z-50` (TabBar가 모달을 가리지 않도록)
- **TabBar:** `icon` prop은 lucide 컴포넌트 참조값 (JSX 아님). `<Icon size={22} />` 형태로 렌더링

### 신규 플랫폼 핵심 결정사항
- **1차 역할:** 학생, 학습매니저, 관리자 (3개. 학부모/강사/컨설턴트는 후순위)
- **레이아웃:** 모바일 탭 바 (하단 네비게이션)
- **CSS:** Tailwind CSS (@tailwindcss/vite) 완료
- **데이터:** Mock 데이터 + LocalStorage (백엔드 없음)
- **시연 흐름:** 학생(마인드 "힘듦" 입력) → 매니저(알림/코칭) → 관리자(통계/인쇄)

### 배포
- **URL:** `andong.gooooookee.com` (서브도메인, Vercel, 완료)
- **코드:** `vite.config.js` base=`/`, BrowserRouter basename 없음, vercel.json SPA fallback

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
- **Tailwind CSS v4** — @tailwindcss/vite 플러그인
- **Recharts** — 바/라인 차트 등 데이터 시각화
- **lucide-react** — UI 아이콘 (이모지 대체)
- **Supabase** — legacy 코드에서만 사용 (`src/legacy/lib/supabase.js`)
- **html2canvas / jsPDF / html-to-image** — PDF 리포트 출력 (legacy + 신규 공용)

---

## 기존 학습 진단 사이트 아키텍처 (`src/legacy/`)

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

- **백엔드/DB 신규 구축 금지** — 더미 데이터는 `src/platform/mocks/mockData.js`에 하드코딩
- **PDF 출력** — Puppeteer 등 서버 렌더링 사용 금지, `window.print()` 또는 html2canvas/jsPDF만 사용
- **아이콘** — UI 아이콘은 반드시 `lucide-react` 사용. 이모지를 아이콘 대용으로 쓰지 말 것
- **신규 플랫폼 로그인** — 퀵-로그인 버튼(학생/학습매니저/관리자 활성, 3개 준비중)으로 역할 전환
- **상세 기획 문서 위치:**
  - `docs/1차 프로토타입 개발/` — 더미 스펙, 시연 시나리오, 퀵-로그인 명세
  - `docs/전체 개발 스코프/유저별/` — 권한별 화면/유저스토리 명세
  - `docs/개념 정리/` — 자기주도지수 산출 로직, 다대다 배정 구조 등 도메인 개념
