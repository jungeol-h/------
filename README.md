# 나매크 (study-mind-check)

안동형 자기주도학습·진로성장 관리 시스템(LMS). 학원(학사)의 학생 자기주도학습을
**관리·모니터링**하는 도구다 — 앱 안에서 학습을 시키는 것이 목적이 아니다.

- **운영 중**: 산청 우정학사 중등부 50~60명 베타테스트 (2026-05-11~), `gooooookee.com` (Vercel)
- **스택**: React 19 · Vite 8 · react-router v7 (SPA) · Tailwind v4 · Supabase · Recharts ·
  @react-pdf/renderer · PWA(vite-plugin-pwa) · Sentry. **JSX (TypeScript 아님)**

## 시작하기

```bash
npm install
cp .env.example .env   # Supabase URL/anon key 등 채우기 (주석 참고)
npm run dev            # 개발 서버
npm run lint           # ESLint — 0건 유지가 기준선
npm run test           # Vitest — selector/유틸 순수함수 단위테스트
npm run build          # 프로덕션 빌드 (배포 전 필수 확인)
```

배포는 Vercel이 main 브랜치를 자동 빌드. **DB 스키마 변경이 있는 커밋은 push 전에
Supabase Studio에서 SQL을 먼저 적용할 것** → `scripts/README.md` (마이그레이션 대장).

## 코드 지도 — 각 폴더에 상세 README가 있다

```
src/platform/
├── context/    데이터 계층 4계층 (fetchers/domains/selectors) → context/README.md
│   └── selectors/  지표 공식·판정 임계값 도메인 지식 → selectors/README.md
├── pages/      역할별 화면 + 역할 추가 체크리스트 → pages/README.md
│   └── educator/external/  외부상담 격리 모듈 → external/README.md
├── booking/    컨설팅·코칭 예약 시스템 격리 모듈 → booking/README.md
├── centerHours/ 센터 이용시간 등록·시간대별 출석부 격리 모듈 → centerHours/README.md
├── components/ 공용 UI (common/ModalShell, counseling/, admin/, workRecords/ ...)
├── pdf/        PDF 리포트 인프라 + 금기사항 → pdf/README.md
├── lib/        Supabase·Sentry·Storage + ⚠️ 보안 부채 목록 → lib/README.md
├── utils/      순수 유틸 (dateUtils — 날짜 문자열은 반드시 이걸로)
└── data/       도메인 상수 (상담 유형, 업무 유형, 과목, 진단 문항)
```

기획 배경·용어는 `docs/README.md`, AI 작업 지침은 `CLAUDE.md`.

**README 원칙**: 각 README는 코드가 말해주지 못하는 것만 담는다 — 설계 의도·격리 원칙,
클라이언트와 확정한 비즈니스 규칙, 사고 이력 기반 금기, 운영 절차·이력. 탭 구성·파일 목록·
함수 시그니처·개수처럼 코드에서 즉시 확인되는 사실은 적지 않는다(적으면 반드시 낡는다).
문서와 코드가 다르면 코드가 현행이다 — 발견 시 문서를 고칠 것.

## 운영 특성 (코드만 봐서는 모르는 것)

- **실사용자가 있는 라이브 서비스다.** 파괴적 변경(스키마, 데이터 삭제, 대규모 UI 개편)은
  분할 배포 + 매니저 공지가 관례. UX 개편 계획은 `docs/1. Task/6. UX 개선 계획*.md`.
- 마이그레이션 미적용 상태에서도 앱은 죽지 않고 "일부 데이터를 불러오지 못했습니다" 배너를
  띄운다 (graceful degradation) — 이 배너가 보이면 `scripts/README.md`부터 확인.
- 보안 부채(평문 비밀번호·RLS 무력화 등)는 알려진 상태로 수용 중 — `lib/README.md` 필독.
  **새 기능이 부채를 키우지 않게 할 것.**
- OS 푸시 알림은 **미구현** (인앱 배너만). 구현 시: VAPID 키 + push_subscriptions 테이블 +
  vite-plugin-pwa를 generateSW→injectManifest 전환 + Supabase Edge Function(web-push) +
  iOS는 16.4+ 홈화면 설치 PWA에서만 동작.

## 미구현·보류 백로그 (클라이언트와 협의된 상태)

| 항목 | 상태 |
|---|---|
| 카카오 알림톡 연동 | 대행사 계정·템플릿 준비 후 진행 (발송 시점: 등하원 즉시·미등원 10분·판정 확정) |
| OS 푸시 알림 | 위 체크리스트로 별도 작업 |
| Q&A(웹 내 질의응답) | 스펙 불명확 — 클라이언트 확인 후 |
| 외부학생 명단 시드 | 명단 수령 대기 (`scripts/seed-external-program.sql`) |
| UX 개선 Tier 1~2 | 계획 확정, 미착수 (`docs/1. Task/6.*.md`) |
| LearningTab(1,400줄) 분리 | Tier 3 보류 — 사용자 체감 없음 |
| 진로설계 '진로 활동 기록' 더미 | `CareerDesignTab.jsx`에 가짜 3건 하드코딩 노출 중 — 실데이터 연결 또는 섹션 제거를 클라이언트와 협의 |
| 타이머 버그 임시 보정 철거 | `student/tempBetaNotice.js` + `[임시]` 블록 — 타이머 안정화 확인 후 제거 |
