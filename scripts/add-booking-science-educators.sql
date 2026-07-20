-- ============================================================
-- 교과 컨설팅 '과학' 교과 추가 + 최돈권(수학)·박영균(과학) 상담사 배정
-- 배경: 클라이언트 요청 (2026-07-20). 두 계정은 seed-staff-accounts.sql로
--       이미 존재(t02 최돈권 수학, t04 박영균 과학) — 역할 변경 불필요,
--       instructor 그대로 booking_educators에 배정하면 예약 상담사가 된다.
-- 사용: Supabase Studio → SQL Editor → RUN
-- 재실행 안전: on conflict do nothing / where not exists
-- 선행: add-booking-system.sql (bkp-subject 프로그램·bksj-* 교과 시드)
-- ============================================================

-- 0. 확인용 (필요 시 주석 해제 실행): 두 계정 존재·과목 확인
-- select id, name, role, subject, status from users where id in ('t02','t04');

-- 1. 교과 컨설팅 프로그램에 '과학' 교과 추가
insert into booking_subjects (id, program_id, name, sort_order)
values ('bksj-sci', 'bkp-subject', '과학', 4)
on conflict (program_id, name) do nothing;

-- 2. 상담사 배정 — 최돈권→수학, 박영균→과학
--    (booking_educators_uniq가 표현식 인덱스라 on conflict 대신 not exists)
insert into booking_educators (id, program_id, educator_id, subject_id)
select 'bke-t02-math', 'bkp-subject', 't02', 'bksj-math'
where not exists (
  select 1 from booking_educators
  where program_id = 'bkp-subject' and educator_id = 't02'
    and coalesce(subject_id, '') = 'bksj-math'
);

insert into booking_educators (id, program_id, educator_id, subject_id)
select 'bke-t04-sci', 'bkp-subject', 't04',
       (select id from booking_subjects where program_id = 'bkp-subject' and name = '과학')
where not exists (
  select 1 from booking_educators be
  join booking_subjects bs on bs.id = be.subject_id
  where be.program_id = 'bkp-subject' and be.educator_id = 't04' and bs.name = '과학'
);

-- 3. 결과 확인
-- select be.id, u.name, bs.name as subject from booking_educators be
--   join users u on u.id = be.educator_id
--   left join booking_subjects bs on bs.id = be.subject_id
--  where be.program_id = 'bkp-subject' order by u.name;
