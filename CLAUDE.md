# CLAUDE.md

안동형 자기주도학습·진로성장 관리 시스템(LMS) '나매크'. React 웹앱.
**산청 우정학사 중등부 50~60명이 실사용 중인 라이브 베타** (2026-05-11~, `gooooookee.com`/Vercel).

프로젝트 전반·운영 특성·백로그는 **루트 `README.md`부터 읽을 것.**
각 코드 폴더에 상세 README가 있다 (context/, selectors/, pages/, booking/, centerHours/,
pdf/, lib/, external/, scripts/).

## 명령어

```bash
npm run dev      # 개발 서버 (Vite + HMR)
npm run build    # 프로덕션 빌드 — 배포 전 필수 (lint/test가 못 잡는 import 오류를 잡는다)
npm run lint     # ESLint — 기준선 0건. 유지할 것
npm run test     # Vitest (selector/유틸 순수함수)
```

## 기술 스택

React 19 · Vite 8 · react-router-dom v7 (BrowserRouter SPA) · Tailwind CSS v4 ·
Recharts · lucide-react · Supabase · @react-pdf/renderer. **JSX (TypeScript 아님).**

## 코드 구조 (`src/platform/`)

- `context/` — 데이터 계층 4계층: DataContext(조립만) + fetchers[역할별 fetch] +
  domains[Write CRUD] + selectors[Read 순수함수] → `context/README.md`
- `pages/` — 역할별 화면: `student/` `manager/` `admin/` `educator/`(강사·컨설턴트 공용)
  `parent/` `viewer/` `shared/` → `pages/README.md`. 탭 구성은 각 Dashboard 파일이 정본.
- `booking/` `centerHours/` — DataContext에서 격리된 독립 모듈(예약·센터 이용시간) → 각 README
- `components/`(공용 UI) `pdf/`(리포트) `lib/`(supabase·sentry) `utils/` `data/`(상수)

## 개발 규칙

- **날짜 문자열('YYYY-MM-DD')은 반드시 `utils/dateUtils.js`** (toDateStr/todayStr/daysAgoStr).
  `toISOString().slice(0,10)` 금지 — UTC라 KST 00~09시에 전날로 기록되는 실버그가 있었다.
- **도메인 CRUD는 `context/domains/crudKit.js` 팩토리** 우선 (모범: workRecordsDomain).
  규약: withWriteRetry → throw → setData 로컬 동기화.
- **모달은 `components/common/ModalShell.jsx`** (하단 시트형). z-index: Header/TabBar `z-40`, 모달 `z-50`.
- **PDF**: `pdf/README.md`의 금기 필독 — 특히 페이지번호 `render` 콜백 금지(크래시 이력).
- **DB 변경**: `scripts/add-*.sql` 멱등 작성 → Studio 수동 적용(신코드 배포 전) →
  `scripts/README.md` 대장 갱신.
- **보안 부채**(평문 비밀번호·RLS 무력화·정답 노출 등)는 `lib/README.md` — 키우지 말 것.

## 작업 흐름

- 비-자명한 작업은 plan mode로 의사결정 정렬 후 구현.
- 라이브 서비스다: 파괴적 변경은 분할 배포 + 매니저 공지. 시드 SQL 재실행 주의(DELETE 포함).
- 기존 코드·docs는 더미 흔적/클라이언트 목소리일 수 있어 근거 삼기 전 검증할 것.
- `docs/`는 보관·운영 자료다 (`docs/README.md`) — 현행 기준은 코드와 코드 폴더 README.
- **README·주석에는 코드로 확인 가능한 사실(탭 구성·파일 목록·함수 시그니처·개수)을 적지 않는다** —
  설계 의도·비즈니스 규칙·금기·운영 이력만. 문서와 코드가 다르면 코드가 맞다 (루트 README의 README 원칙).
