-- ============================================================
-- admin 계정 정리: 범용 admin 계정 → 황광희로 데이터 이관 후 삭제
-- 배경: 별개로 존재하는 범용 'admin' 계정을 없애고, 그 계정이 작성한
--       모든 기록의 소유권을 총괄 관리자 황광희로 옮긴다 (클라이언트 2026-07-22).
-- 사용: Supabase Studio → SQL Editor → 전체 선택 후 RUN.
-- 안전장치:
--   · 트랜잭션(BEGIN/COMMIT)으로 감싸 중간 실패 시 전부 롤백.
--   · users를 그냥 delete하면 FK CASCADE로 상담·보고서 기록이 소실되므로
--     반드시 먼저 모든 참조 컬럼을 황광희로 UPDATE한 뒤 삭제한다.
--   · 대상 계정을 못 찾거나 황광희가 없으면 RAISE EXCEPTION으로 중단(안전).
-- 멱등성: 삭제 후 재실행하면 '대상 admin 없음'으로 안전하게 중단된다.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_keep   TEXT;   -- 남길 계정: 황광희
  v_del    TEXT;   -- 지울 계정: 범용 admin (황광희 아님)
  v_del_cnt INT;
BEGIN
  -- ── 1) 남길 계정(황광희) 찾기 ──────────────────────────────
  SELECT id INTO v_keep
  FROM users
  WHERE role = 'admin' AND (name = '황광희' OR login_id = '황광희')
  ORDER BY id
  LIMIT 1;

  IF v_keep IS NULL THEN
    RAISE EXCEPTION '황광희(admin) 계정을 찾을 수 없습니다. 이관 대상이 없어 중단합니다.';
  END IF;

  -- ── 2) 지울 계정(범용 admin, 황광희 아님) 찾기 ──────────────
  SELECT count(*) INTO v_del_cnt
  FROM users
  WHERE role = 'admin' AND id <> v_keep;

  IF v_del_cnt = 0 THEN
    RAISE NOTICE '삭제할 별개 admin 계정이 없습니다(이미 정리됨). 변경 없이 종료합니다.';
    RETURN;
  END IF;

  IF v_del_cnt > 1 THEN
    RAISE EXCEPTION '황광희 외 admin 계정이 %개 있습니다. 어느 것을 지울지 모호하여 중단합니다.', v_del_cnt;
  END IF;

  SELECT id INTO v_del
  FROM users
  WHERE role = 'admin' AND id <> v_keep
  LIMIT 1;

  RAISE NOTICE '이관: % → % (지울 계정 → 남길 계정)', v_del, v_keep;

  -- ── 3) 모든 참조를 황광희로 재지정 ─────────────────────────
  -- 직원(작성자·감독자) 컬럼만 이동한다. student_id 계열은 학생 참조라 무관.

  -- 상담 기록 (통계·학생 홈에 결합 — manager_id NOT NULL)
  UPDATE counseling_records        SET manager_id  = v_keep WHERE manager_id  = v_del;

  -- 업무기록 3종 (author_id NOT NULL, CASCADE)
  UPDATE management_reports        SET author_id   = v_keep WHERE author_id   = v_del;
  UPDATE finance_records           SET author_id   = v_keep WHERE author_id   = v_del;
  UPDATE lesson_reports            SET author_id   = v_keep WHERE author_id   = v_del;

  -- 업무계획 / 긴급보고
  UPDATE work_plans                SET author_id   = v_keep WHERE author_id   = v_del;
  UPDATE urgent_reports            SET author_id   = v_keep WHERE author_id   = v_del;
  UPDATE urgent_reports            SET confirmed_by = v_keep WHERE confirmed_by = v_del;

  -- 과제(부여자)
  UPDATE tasks                     SET assigner_id = v_keep WHERE assigner_id = v_del;

  -- 학생-매니저 배정: UNIQUE(student_id, educator_id) 충돌 방지 —
  -- 두 계정이 같은 학생에 배정돼 있으면 admin 쪽 행을 지운 뒤 나머지만 이동.
  DELETE FROM assignments a
  WHERE a.educator_id = v_del
    AND EXISTS (SELECT 1 FROM assignments b WHERE b.student_id = a.student_id AND b.educator_id = v_keep);
  UPDATE assignments               SET educator_id = v_keep WHERE educator_id = v_del;

  -- 로그인 로그 (CASCADE 대상 — 이력 보존 위해 이동)
  UPDATE login_logs                SET user_id     = v_keep WHERE user_id     = v_del;

  -- 외부(외생) 상담 (counselor_id FK, nullable)
  UPDATE program_counseling_records SET counselor_id = v_keep WHERE counselor_id = v_del;

  -- 예약 시스템
  -- FK 컬럼(educator_id·recipient_id)만 CASCADE/삭제차단 위험이 있어 반드시 이동.
  -- 나머지 actor 컬럼(booked_by·cancelled_by·attendance_marked_by·created_by·actor_id)은
  -- FK가 없는 TEXT 이력이라 삭제를 막지 않지만, 귀속 보존 위해 함께 이동한다.

  -- booking_educators: FK. UNIQUE(program_id, educator_id, coalesce(subject_id,'')) 충돌 방지
  DELETE FROM booking_educators a
  WHERE a.educator_id = v_del
    AND EXISTS (
      SELECT 1 FROM booking_educators b
      WHERE b.program_id = a.program_id AND b.educator_id = v_keep
        AND COALESCE(b.subject_id, '') = COALESCE(a.subject_id, '')
    );
  UPDATE booking_educators         SET educator_id  = v_keep WHERE educator_id  = v_del;

  -- FK 컬럼
  UPDATE booking_slots             SET educator_id  = v_keep WHERE educator_id  = v_del;   -- educator_id FK
  UPDATE booking_records           SET educator_id  = v_keep WHERE educator_id  = v_del;   -- educator_id FK (ON DELETE SET NULL)
  UPDATE booking_notifications     SET recipient_id = v_keep WHERE recipient_id = v_del;   -- recipient_id FK

  -- TEXT 이력 컬럼 (FK 없음)
  UPDATE booking_slots             SET created_by            = v_keep WHERE created_by            = v_del;
  UPDATE booking_open_periods      SET created_by            = v_keep WHERE created_by            = v_del;
  UPDATE booking_timetable_batches SET created_by            = v_keep WHERE created_by            = v_del;
  UPDATE booking_reservations      SET booked_by             = v_keep WHERE booked_by             = v_del;
  UPDATE booking_reservations      SET cancelled_by          = v_keep WHERE cancelled_by          = v_del;
  UPDATE booking_reservations      SET attendance_marked_by  = v_keep WHERE attendance_marked_by  = v_del;
  UPDATE booking_audit_logs        SET actor_id              = v_keep WHERE actor_id              = v_del;

  -- 관리자별 홈 그룹 필터 설정 (admin_config) — 지울 계정 키는 삭제(이관 불필요)
  DELETE FROM admin_config WHERE key = 'home_group_filter:' || v_del;

  -- ── 4) 계정 삭제 ───────────────────────────────────────────
  -- 위에서 참조를 모두 옮겼으므로 CASCADE로 잃을 데이터가 없다.
  DELETE FROM users WHERE id = v_del;

  RAISE NOTICE '완료: admin 계정 % 삭제, 데이터는 %로 이관됨.', v_del, v_keep;
END $$;

COMMIT;

-- ── 검증(선택): 남은 admin 계정 확인 ───────────────────────────
-- select id, login_id, name, role, status from users where role = 'admin';
