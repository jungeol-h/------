# SQL 마이그레이션 대장

DB 스키마 변경은 **Supabase Studio SQL Editor에서 수동 실행**한다 (자동 마이그레이션 없음).
모든 스크립트는 멱등(재실행 안전)하게 작성하는 것이 규칙이다 (`if not exists`, 조건부 insert).

## 신규 마이그레이션 작성 규칙

1. `scripts/add-<기능>.sql` 파일로 작성 (멱등하게).
2. **신코드 배포 전에 SQL을 먼저 적용**한다 — 순서가 바뀌면 신기능 저장이 DB 에러.
3. 미적용 상태에서도 앱이 죽지 않도록 fetcher는 graceful하게 설계돼 있다
   (누락 테이블/컬럼은 `_fetchErrors`로 수집 → 화면에 "일부 데이터를 불러오지 못했습니다 (N개 항목)" 배너).
4. 적용 후 이 문서의 이력 표를 갱신할 것.

## 적용 여부 확인법

- 앱에서: 관리자로 로그인 → 배너 없으면 전부 적용된 상태.
- DB에서: Studio SQL Editor에서
  `select column_name from information_schema.columns where table_name = '<테이블>';`

## 루트의 기반 SQL (전부 적용됨)

| 파일 | 내용 |
|---|---|
| `supabase_platform_schema.sql` | **메인 스키마 정본.** users(학생+교직원 통합)·학습·마인드·상담 등 핵심 테이블 |
| `supabase_attendance_migration.sql` | 출결 판정: attendance_schedules + pg_cron `judge_attendance()` (지각/무단결석 자동 판정, KST 기준) |
| `supabase_admin_migration.sql` | admin_config(key/value jsonb) + updated_at 트리거 |
| `supabase_beta_seed.sql` | 산청 우정학사 실학생 명단 시드 (DELETE 후 INSERT — 재실행 주의) |

## scripts/ 증분 마이그레이션 이력

2026-07-11에 당시 대기분까지 전부 적용 확인됨. 그 이후 작성분 2건은 적용 여부 확인 필요.

| 파일 | 내용 | 상태 (2026-07-12 기준) |
|---|---|---|
| `add-todo-content.sql` | todo_items.content | 적용됨 |
| `add-learning-record-sort-order.sql` | learning_records.sort_order | 적용됨 |
| `add-user-gender-and-status.sql` | users.gender/status | 적용됨 |
| `add-task-assigner-and-programs.sql` | tasks.assigner_* + 외부상담 테이블 3종 | 적용됨 |
| `add-essay-counseling-target-task-fields.sql` | 서술형 문항·피상담자·과제 method/content·enrolled_at | 적용됨 |
| `add-counseling-report-fields.sql` | 상담 6단계 필드 (topic~next_appointment) | 적용됨 |
| `add-user-subject.sql` | users.subject + 강사 과목 시드 | 적용됨 |
| `add-quiz-subject.sql` | quiz_sets.subject (add-user-subject 선행 필요) | 적용됨 |
| `add-parent-role.sql` | parent_children 매핑 테이블 | 적용됨 |
| `add-2607-client-features.sql` | login_logs·daily_self_scores·work_plans·urgent_reports 등 | 적용됨 |
| `add-counseling-attachments.sql` | counseling_records.attachments + 'counseling-files' 버킷 | **확인 필요** — 미적용 시 상담 PDF 첨부 저장 에러 |
| `add-2607-work-records.sql` | management_reports·finance_records·lesson_reports + 상담 시간·업무계획 status + 'finance-receipts' 버킷 | **확인 필요** — 미적용 시 업무기록 3메뉴 저장 에러 + 배너(3개 항목) |

## 시드·일회성 유틸 (재실행 금지 또는 불필요)

| 파일 | 내용 |
|---|---|
| `seed-test-accounts.sql` / `seed-staff-accounts.sql` | 베타 계정·교직원 7명 시드 (적용됨). 황광희(admin)는 FK CASCADE 때문에 delete-then-insert 금지 — 조건부 insert 유지 |
| `seed-quiz-content.sql` | 확인평가 초기 문항 시드 (적용됨) |
| `seed-external-program.sql` | 외부(외생) 상담 프로그램 시드 — **외부학생 명단 수령 후 실행 예정 (보류 중)** |
| `diagnose-quiz.sql` | 퀴즈 데이터 점검용 조회 (읽기 전용) |
| `patch-quiz-rls.sql` / `migrate-remaining-todo-items.sql` / `unify-learning-records.sql` | 과거 일회성 보정 (완료) |
