# CLAUDE.md

본 프로젝트는 황광희(클라이언트)가 제안하여 학교/학원 등 현장 학생/강사들이 사용중인 학습관리 웹앱 '나매크'이다.

프로젝트 전반·운영 특성·백로그는 **루트 `README.md`부터 읽을 것.** 각 코드 폴더에 상세 README가 있다 (context/, selectors/, pages/, pdf/, lib/, external/, scripts/). Git 커밋 히스토리도 좋다.

## 명령어

```bash
npm run dev      # 개발 서버 (Vite + HMR)
npm run build    # 프로덕션 빌드 — 배포 전 필수 (lint/test가 못 잡는 import 오류를 잡는다)
npm run lint     # ESLint — 기준선 0건 유지할 것.
npm run test
```

## 기술 스택

React 19 · Vite 8 · react-router-dom v7 (BrowserRouter SPA) · Tailwind CSS v4 ·
Recharts · lucide-react · Supabase · @react-pdf/renderer · JSX

## 개발 규칙

- 메인 리더는 Fable. 단순한 구현, 노가다성 작업은 Fable이 직접 하지 않고 하위 AI 모델 Agent가 구현하고 Fable이 작업 결과를 판단/검증할 것. (혼자 작업하지 말고 관료제처럼 유기적으로 구현하라는 뜻이다. 다만 너무 많이 자주 분업하는 것은 지양.)
- **날짜 문자열('YYYY-MM-DD')은 반드시 `utils/dateUtils.js`** (toDateStr/todayStr/daysAgoStr).
  `toISOString().slice(0,10)` 금지 — UTC라 KST 00~09시에 전날로 기록되는 실버그가 있었다.
- **도메인 CRUD는 `context/domains/crudKit.js` 팩토리** 우선 (모범: workRecordsDomain).
  규약: withWriteRetry → throw → setData 로컬 동기화.
- **모달은 `components/common/ModalShell.jsx`** (하단 시트형). z-index: Header/TabBar `z-40`, 모달 `z-50`.
- **PDF**: `pdf/README.md`의 금기 필독 — 특히 페이지번호 `render` 콜백 금지(크래시 이력).
- **DB 변경**: `scripts/add-*.sql` 멱등 작성 → Studio 수동 적용(신코드 배포 전) →
  `scripts/README.md` 대장 갱신.
- **보안 부채**(평문 비밀번호·RLS 무력화·정답 노출 등)는 `lib/README.md` — 키우지 말 것.
- **학생 계정 생성(시드·명단 작업 포함) 전 중복 검사 필수**: 기존 users를 **전체 상태**
  (퇴원 withdrawn·신청취소 cancelled·inactive 포함)로 조회해 ①학생 전화번호(password)
  ②이름+학교 ③이름+학부모 번호(parent_password) 일치를 대조할 것. 일치하면 새로 만들지
  말고 기존 행 status 복구·정보 갱신으로 처리. login_id만 검사하면 이름 오타·아이디
  변형('강_은성')이 뚫린다 — 2026-07 동일인 5쌍 중복 사고의 원인. 프론트 검사는
  `utils/studentDedup.js`(폼)·`utils/studentImport.js`(일괄), DB 백스톱은
  `scripts/add-student-dedup-guard.sql`(name+password 부분 unique 인덱스).

## 코드 구조 (`src/platform/`)

- `context/` — 데이터 계층 4계층: DataContext(조립만) + fetchers[역할별 fetch] +
  domains[Write CRUD] + selectors[Read 순수함수] → `context/README.md`
- `pages/` — 역할별 화면: `student/` `manager/` `admin/`(6탭: 홈·출결·학생·업무기록·확인평가·외부상담)
  `educator/`(강사·컨설턴트 공용) `parent/` `viewer/` `shared/` → `pages/README.md`
- `components/`(공용 UI) `pdf/`(리포트) `lib/`(supabase·sentry) `utils/` `data/`(상수)

## 지키면 좋은 것

- 비-자명한 작업은 선제적으로 질문할 것. plan mode로 의사결정 정렬 후 구현.
- 라이브 서비스다: 파괴적 변경은 분할 배포 + 매니저 공지. 시드 SQL 재실행 주의(DELETE 포함).
- 기존 코드·docs는 더미 흔적/클라이언트 목소리일 수 있어 근거 삼기 전 검증할 것. `docs/`는 보관·운영 자료다 (`docs/README.md`) — 현행 기준은 코드와 코드 폴더 README.
