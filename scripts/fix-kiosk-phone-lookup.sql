-- ============================================================
-- 핫픽스: 키오스크 학생 검색을 password → phone 기반으로 (2026-07-29)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN
-- ------------------------------------------------------------
-- 장애: add-password-security(2026-07-29) 적용으로 password가 bcrypt
-- 해시로 전환되기 시작하면서, right(password, 4)로 매칭하던
-- kiosk_find_students가 해시 전환된 학생을 전혀 찾지 못함
-- ("해당 번호의 학생이 없어요"). 연락처 전용 컬럼 phone으로 매칭 교체.
-- 재실행 안전: CREATE OR REPLACE 멱등.
-- ============================================================

CREATE OR REPLACE FUNCTION kiosk_find_students(p_digits TEXT)
RETURNS TABLE (
  id          TEXT,
  name        TEXT,
  grade       TEXT,
  class_name  TEXT,
  checked_in  BOOLEAN,
  checked_out BOOLEAN
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT u.id, u.name, u.grade, u.class_name,
         (ar.check_in_at IS NOT NULL)  AS checked_in,
         (ar.check_out_at IS NOT NULL) AS checked_out
  FROM users u
  LEFT JOIN attendance_records ar
    ON ar.student_id = u.id
   AND ar.date = (now() AT TIME ZONE 'Asia/Seoul')::date
  WHERE u.role = 'student'
    AND u.status = 'active'
    AND right(u.phone, 4) = p_digits
  ORDER BY u.name;
$$;

-- 적용 확인: 실학생 전화 뒷 4자리로 1행 이상 나와야 정상
-- select * from kiosk_find_students('실제뒷4자리');
