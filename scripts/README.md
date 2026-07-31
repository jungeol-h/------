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
| `add-center-hours.sql` | 센터 이용시간 등록: center_hour_registrations(학생×요일×1시간 단위) + admin_config('center_hours') 설정 + RPC 2종(center_save_hours 정원·잠금 검증 저장 / center_sync_attendance_schedules 일괄 보정). v2(2026-07-18): center_save_hours가 저장 시 등·하원 시간표 자동 파생 | 적용됨 (v2 포함 — 2026-07-20 실DB 검증: 당일 저장 건이 즉시 파생됐고 59명·199건 시간표가 등록과 전건 일치) |
| `add-quiz-attachments-and-score-only.sql` | 확인평가 확장: quiz_questions.attachments(이미지/PDF 메타) + quiz_sets.is_score_only/max_score(외부시험 점수전용 회차) + 'quiz-attachments' 버킷 | 적용됨 (2026-07-20) |
| `add-booking-science-educators.sql` | 예약 교과 컨설팅에 '과학' 교과 추가 + 최돈권(수학)·박영균(과학) 상담사 배정 (계정은 seed-staff-accounts로 기존재, 역할 변경 없음) | 적용됨 (2026-07-20) |
| `add-task-attachments.sql` | 과제 파일 첨부(양방향): tasks.attachments(강사 문제/자료 메타) + tasks.submissions(학생 제출 메타) + 'task-files' 버킷(이미지/PDF) | 적용됨 (2026-07-23) |
| `add-quiz-question-points.sql` | quiz_questions.points (서술형 배점 — 교사가 0~배점 점수 입력 채점, 단답형·기존 데이터는 1점) | 적용됨 (2026-07-23) |
| `add-student-dedup-guard.sql` | 학생 중복 등록 DB 백스톱: 부분 unique 인덱스 users(name, password) WHERE role='student' (자리표시 비밀번호 제외). 2026-07-24 동일인 5쌍 중복 정리 후 재발 방지 — 프론트 검사(studentDedup.js·studentImport.js)와 세트. **인덱스는 add-password-security에서 (name, phone) 기반으로 교체됨** | 적용됨 (2026-07-24) |
| `add-password-security.sql` | 비밀번호 보안 1단계: users.phone/parent_phone(연락처 분리) + password_changed_at(강제 재설정 플래그) + 겸용 전화번호 복사 + 중복 방지 인덱스를 (name, phone)으로 교체. 해시화는 클라이언트가 수행(로그인 시 투명 업그레이드 + 강제 재설정 모달). 전환 완료 후 parent_password drop·평문 fallback 제거 예정 | 적용됨 (2026-07-29, Studio) |
| `fix-kiosk-phone-lookup.sql` | **긴급 핫픽스**: kiosk_find_students 매칭을 right(password,4) → right(phone,4)로 교체. 해시 전환 후 키오스크가 학생을 못 찾던 라이브 장애 해소 (add-password-security 후속 누락분) | 적용됨 (2026-07-29, Studio) |
| `add-2607-work-plan-range-audience.sql` | 업무계획 개편(2026-07-30 클라이언트): work_plans.plan_end_time(종료 시간 'HH:MM') + audiences(대상 복수선택 jsonb — 학생/학부모/강사/시청담당자/관리자). student_ids는 구 기록 호환용으로 유지 | 적용됨 (2026-07-31, Studio) |
| `add-notices.sql` | 공지·알림(2026-07-31 클라이언트): notices 테이블 — kind(announcement=로그인 팝업 공지 / notification=홈 알림 칸 누적), audience(전체/학생/학부모), active 내리기 토글 | 적용됨 (2026-07-31, Studio) |
| `add-notice-reads.sql` | 공지 읽음 기록(add-notices 후속): notice_reads(notice_id×user_id, FK CASCADE) — 다기기 사용자가 기기마다 팝업을 다시 보던 localStorage 판정을 서버 기록으로 전환 (클라는 미적용 시 localStorage로 자연 강등) | 미적용 |

## 시드·일회성 유틸 (재실행 금지 또는 불필요)

| 파일 | 내용 |
|---|---|
| `seed-test-accounts.sql` / `seed-staff-accounts.sql` | 베타 계정·교직원 7명 시드 (적용됨). 황광희(admin)는 FK CASCADE 때문에 delete-then-insert 금지 — 조건부 insert 유지 |
| `seed-test-cast.sql` | **전 역할 테스트 캐스트**: 테스트관리자·매니저·강사·컨설턴트·열람자·학부모 6계정 + 황준걸중1~3 재활용(비밀번호·연락처·그룹 갱신). 공통 비밀번호 `테스트1234`(bcrypt, 재설정 면제), 직원은 group_names=['테스트']로 실데이터와 격리, 학부모 링크·강사 배정·평일 15~21시 출결 시간표 포함. 로컬 dev 빠른 로그인 패널(DevQuickLogin)과 세트. upsert 멱등 — 재실행 안전 (적용됨 2026-07-29, Studio) |
| `seed-quiz-content.sql` | 확인평가 초기 문항 시드 (적용됨) |
| `seed-external-program.sql` | 외부(외생) 상담 프로그램 시드 — **외부학생 명단 수령 후 실행 예정 (보류 중, 2026-07-20 실DB 재확인: cp-2026-andong 없음)**. 클라이언트가 앱 UI로 프로그램("133 찾아가는 컨설팅")을 직접 생성해 운영 중(학생 0명) — 시드 실행 시 프로그램 중복 생성 주의, 명단은 기존 UI 프로그램에 등록하는 편이 자연스러움 |
| `seed-navi4-students.sql` | 안동NAVI 4기 학생 77명 시드 (신청서 엑셀 기반, 신청취소 5명 status='cancelled') — **적용됨 (2026-07-17, REST로 삽입)**. 재실행해도 안전(on conflict do nothing). 이후 명단은 앱의 관리자 → 학생 → 일괄 등록으로 처리 가능 |
| `diagnose-quiz.sql` | 퀴즈 데이터 점검용 조회 (읽기 전용) |
| `patch-quiz-rls.sql` / `migrate-remaining-todo-items.sql` / `unify-learning-records.sql` | 과거 일회성 보정 (완료) |
| `delete-dummy-managers.sql` | 더미 매니저 m01~m04 삭제 + 실상담 1건 a-hwang 이관 — **적용됨 (2026-07-17, REST)**. 이후 실매니저 생성 시 assignments 재배정 필요 |
| `migrate-admin-to-hwang.sql` | 범용 admin 계정의 모든 작성 기록(상담·업무기록·업무계획·긴급보고·과제·배정·예약·외부상담·로그인로그)을 황광희로 이관 후 admin 계정 삭제. 트랜잭션+FK 재지정으로 CASCADE 소실 방지, UNIQUE 충돌 방지(assignments·booking_educators), 대상 모호/부재 시 예외로 중단. 삭제 후 재실행 안전(대상 없음으로 종료) — **미적용, Studio 실행 필요** |
| `seed-parents-from-students.sql` | 학부모 계정 일괄 생성 (학생 parent_password 기반, 전화번호 dedupe — 형제 1계정 다자녀 링크. 로그인 = 학부모 전화번호/전화번호) — **적용됨 (2026-07-18, REST, 학부모 135·링크 144)**. 멱등이라 신규 학생 반영 시 재실행 가능 |
| `cleanup-booking-test-data.sql` | 예약 시스템 E2E 테스트 산출물 삭제 (기록·예약·알림·슬롯·배치·감사이력 전체 — 프로그램·교과·강사배정·오픈기간 설정은 유지). **⚠️ 예약 실오픈됨(2026-07-20 기준 실예약 다수) — 재실행 절대 금지** |
| `seed-center-hours.sql` | 센터 이용시간 초기 시드 — NAVI 4기 신청서(7.17) 블록 선택을 1시간 단위로 전개 (60명·639행, 생성 규칙·이름 정규화는 파일 헤더 참조). 이름 기준 매칭, 동명이인·미매칭은 말미 리포트 쿼리로 표시 — **적용됨 (2026-07-18)**. 이후 학생 편집 반영 중(2026-07-20 실DB 기준 59명·612행), 등록 열림(isOpen: true) 상태. **⚠️ 재실행 금지** (학생이 지운 시간이 되살아남) |
