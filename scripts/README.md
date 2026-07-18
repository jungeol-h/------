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

2026-07-17에 아래 전 항목 적용 확인됨 (REST로 실DB 컬럼·테이블 존재 검증).

| 파일 | 내용 | 상태 (2026-07-17 기준) |
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
| `add-counseling-attachments.sql` | counseling_records.attachments + 'counseling-files' 버킷 | 적용됨 |
| `add-2607-work-records.sql` | management_reports·finance_records·lesson_reports + 상담 시간·업무계획 status + 'finance-receipts' 버킷 | 적용됨 |
| `add-user-groups.sql` | users.group_names(소속 그룹, 복수) + 관리보고·재정·긴급보고 group_name + 역할별 백필 (add-2607-work-records 선행 필요) | 적용됨 |
| `add-study-location.sql` | learning_records.study_location (공부 장소: 센터·집·스카·학원·학교) | 적용됨 |
| `add-booking-system.sql` | 컨설팅·코칭 예약 시스템: booking_* 테이블 10종(프로그램·교과·강사배정·오픈기간·배치·슬롯·예약·상담기록·알림·감사이력) + SECURITY DEFINER RPC 9종(예약/취소/변경/그룹배정/출결/슬롯편집/일괄상태/다이제스트) + 프로그램 3종 시드 + pg_cron `booking-daily-digest`(KST 00:05) | **적용됨 (2026-07-18, Studio)** |

## 시드·일회성 유틸 (재실행 금지 또는 불필요)

| 파일 | 내용 |
|---|---|
| `seed-test-accounts.sql` / `seed-staff-accounts.sql` | 베타 계정·교직원 7명 시드 (적용됨). 황광희(admin)는 FK CASCADE 때문에 delete-then-insert 금지 — 조건부 insert 유지 |
| `seed-quiz-content.sql` | 확인평가 초기 문항 시드 (적용됨) |
| `seed-external-program.sql` | 외부(외생) 상담 프로그램 시드 — **외부학생 명단 수령 후 실행 예정 (보류 중)** |
| `seed-navi4-students.sql` | 안동NAVI 4기 학생 77명 시드 (신청서 엑셀 기반, 신청취소 5명 status='cancelled') — **적용됨 (2026-07-17, REST로 삽입)**. 재실행해도 안전(on conflict do nothing). 이후 명단은 앱의 관리자 → 학생 → 일괄 등록으로 처리 가능 |
| `diagnose-quiz.sql` | 퀴즈 데이터 점검용 조회 (읽기 전용) |
| `patch-quiz-rls.sql` / `migrate-remaining-todo-items.sql` / `unify-learning-records.sql` | 과거 일회성 보정 (완료) |
| `delete-dummy-managers.sql` | 더미 매니저 m01~m04 삭제 + 실상담 1건 a-hwang 이관 — **적용됨 (2026-07-17, REST)**. 이후 실매니저 생성 시 assignments 재배정 필요 |
| `seed-parents-from-students.sql` | 학부모 계정 일괄 생성 (학생 parent_password 기반, 전화번호 dedupe — 형제 1계정 다자녀 링크. 로그인 = 학부모 전화번호/전화번호) — **적용됨 (2026-07-18, REST, 학부모 135·링크 144)**. 멱등이라 신규 학생 반영 시 재실행 가능 |
| `cleanup-booking-test-data.sql` | 예약 시스템 E2E 테스트 산출물 삭제 (기록·예약·알림·슬롯·배치·감사이력 전체 — 프로그램·교과·강사배정·오픈기간 설정은 유지). **⚠️ 실오픈 후 재실행 금지** |
