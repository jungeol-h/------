# CLAUDE.md

안동형 자기주도학습·진로성장 관리 시스템(LMS) '나매크'. React 웹앱.
산청 우정학사 중등부 50~60명 베타테스트 운영 중 (2026-05-11~).

## 명령어

```bash
npm run dev      # 개발 서버 (Vite + HMR)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # Vitest (selector/이벤트 로직 단위테스트)
```

## 기술 스택

React 19 · Vite 8 · react-router-dom v7 (BrowserRouter SPA) ·
Tailwind CSS v4 · Recharts · lucide-react · Supabase · @react-pdf/renderer.
JSX (not TypeScript). 배포: `gooooookee.com` (Vercel).

## 코드 구조 (`src/platform/`)

- `context/` — 데이터 계층. 아래 "DataContext 구조" 참고.
- `pages/` — 역할별 화면: `student/`(5탭) `manager/`(4탭) `admin/`(3탭) `shared/`
- `components/`, `mocks/`, `data/`, `pdf/`, `utils/`

라우팅(`src/App.jsx`): `/` 로그인 → `/student/*` `/manager/*` `/admin/*`.

### DataContext 구조 (3계층)

`context/DataContext.jsx`는 Provider 조립만. CRUD/조회/이벤트는 계층 분리:

- `domains/` [Write] — 도메인별 CRUD 훅
- `selectors/` [Read] — cross-domain 종합·지표 (순수함수)
- `events/` — 얇은 이벤트 버스 (현재 미사용, 푸시알림용 슬롯)
- `fetchers/` — 역할별 초기 fetch

새 기능 추가 패턴은 메모리 `reference_datacontext_layers` 참고.
알림은 위험 탐지(계산형)/코칭 기록(레코드형) 분리 — `project_alert_redesign` 참고.

## 데이터

Supabase 기반 (`src/platform/lib/supabase.js`). 스키마: `supabase_platform_schema.sql`.
snake_case DB ↔ camelCase 변환은 `lib/supabaseHelpers.js`.
**미해결 보안 부채**(평문 비밀번호·RLS·정답 노출)는 메모리 `project_security_debt` 참고.

## 개발 규칙

- 토큰 절약을 위해 설계는 Fable 5가 직접 하되, 구현, 코드 작성은 Opus 서브 에이전트를 적극 활용해야 한다.
- **z-index**: Header/TabBar `z-40`, 모달 `z-50`.
- **PDF**: `@react-pdf/renderer` 기반 `src/platform/pdf/`. 서버 렌더링 금지.
  추가 패턴은 메모리 `reference_pdf_infra` 참고.
- **작업 흐름**: 비-자명한 작업은 plan mode로 의사결정 정렬 후 구현 (`feedback_workflow_preferences`).
  기존 코드·docs는 더미 흔적/클라이언트 목소리일 수 있어 근거 삼기 전 검증 (`feedback_question_assumptions`).

## 기획 문서 (`docs/`)

(다소 오래되어 일단 신뢰도 떨어짐. 현재 세션의 요구사항에 더 집중)

- `docs/3. 자료/개념 정리/` — 도메인 개념(자기주도지수, 알림, 리포트, M:N 배정),
  `유저 개념/` 아래 역할별 유저스토리
- `docs/1. 프로젝트/산청 우정학사 중등부 베타테스트/` — 베타 요청사항·계정·교재
