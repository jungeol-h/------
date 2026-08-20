-- ============================================================
-- 강사(교직원) 키오스크 출퇴근 기록 (2026-08-20)
-- 사용: Supabase Studio → SQL Editor → 붙여넣기 후 RUN (재실행 안전)
-- ------------------------------------------------------------
-- 배경: 학생 키오스크(kiosk_check_in/kiosk_check_out/kiosk_find_students,
-- add-attendance-reentry.sql)와 별개로, 센터장·매니저·강사·컨설턴트가
-- 같은 태블릿에서 자기 출퇴근을 남길 방법이 없었다.
--
-- 설계: 학생 attendance_records와 완전히 분리된 전용 테이블
-- staff_attendance_records를 신설한다. 시간표/지각 판정은 없음 — 순수
-- 출퇴근 시각 기록만. 하루 1행(UNIQUE staff_id,date) + events(jsonb)
-- 로그로 등·하원(재등원 포함) 이력을 누적하는 것은 학생판과 동일한
-- 패턴을 그대로 미러링한다(재출근 = 학생판의 재등원과 동일 개념).
--
-- 영향 범위 점검 (나매크 규칙: 컬럼 의미 변경 시 다른 SQL RPC 소비처 확인):
--  - attendance_records / judge_attendance() / kiosk_check_in / kiosk_check_out /
--    kiosk_find_students 등 학생 출결 관련 어떤 것도 이 파일에서 건드리지
--    않는다 — 강사 데이터를 학생 테이블에 섞지 않는 것이 이 설계의 핵심.
--  - 새 RPC 3종(kiosk_find_staff/kiosk_staff_check_in/kiosk_staff_check_out)은
--    전부 신규 함수명이라 기존 RPC와 충돌 없음.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. 테이블
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_attendance_records (
  id            TEXT PRIMARY KEY,
  staff_id      TEXT NOT NULL REFERENCES users(id),
  date          DATE NOT NULL,
  check_in_at   TIMESTAMPTZ,
  check_out_at  TIMESTAMPTZ,
  events        JSONB NOT NULL DEFAULT '[]'::jsonb,
  source        TEXT NOT NULL DEFAULT 'kiosk',
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, date)
);

-- ----------------------------------------------------------------
-- 2. RLS — 정책 누락 시 침묵 실패(빈 배열 반환)하므로 필수
-- ----------------------------------------------------------------
ALTER TABLE staff_attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_all ON staff_attendance_records;
CREATE POLICY anon_all ON staff_attendance_records FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 3. kiosk_find_staff — 전화번호 뒷 4자리로 교직원 조회
--    role IN ('admin','manager','instructor','consultant') AND status='active'
--    checked_in: 현재 출근 중(퇴근 안 함). checked_out: 오늘 퇴근 이력 있음.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION kiosk_find_staff(p_digits TEXT)
RETURNS TABLE (
  id          TEXT,
  name        TEXT,
  role        TEXT,
  checked_in  BOOLEAN,
  checked_out BOOLEAN
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT u.id, u.name, u.role,
         (sar.check_in_at IS NOT NULL AND sar.check_out_at IS NULL) AS checked_in,
         (sar.check_out_at IS NOT NULL)                             AS checked_out
  FROM users u
  LEFT JOIN staff_attendance_records sar
    ON sar.staff_id = u.id
   AND sar.date = (now() AT TIME ZONE 'Asia/Seoul')::date
  WHERE u.role IN ('admin', 'manager', 'instructor', 'consultant')
    AND u.status = 'active'
    AND right(u.phone, 4) = p_digits
  ORDER BY u.name;
$$;

-- ----------------------------------------------------------------
-- 4. kiosk_staff_check_in — 출근. 시간표/지각 판정 없음(순수 기록).
--    ① 출근 중(in 있고 out 없음) → already_in
--    ② 퇴근 완료 상태 → 재출근: check_out_at NULL 리셋 + events append + note 누적
--    ③ 오늘 행 없음 → INSERT
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION kiosk_staff_check_in(p_staff_id TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_date DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  rec      staff_attendance_records%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM staff_attendance_records
   WHERE staff_id = p_staff_id AND date = kst_date;

  -- 현재 출근 중(퇴근 안 함)
  IF rec.id IS NOT NULL AND rec.check_in_at IS NOT NULL AND rec.check_out_at IS NULL THEN
    RETURN jsonb_build_object('result', 'already_in', 'record', to_jsonb(rec));
  END IF;

  -- 퇴근 완료 상태에서 다시 출근 → 재출근 (하루 1행 유지, check_out_at만 리셋)
  IF rec.id IS NOT NULL AND rec.check_in_at IS NOT NULL AND rec.check_out_at IS NOT NULL THEN
    UPDATE staff_attendance_records
       SET check_out_at = NULL,
           events       = events || jsonb_build_object('type', 'in', 'at', now()),
           note = CASE WHEN coalesce(note, '') = '' THEN '재출근'
                       ELSE note || ' / 재출근' END
     WHERE id = rec.id
     RETURNING * INTO rec;

    RETURN jsonb_build_object('result', 'ok', 'reentry', TRUE, 'record', to_jsonb(rec));
  END IF;

  -- 오늘 행 없음 → 신규 출근 기록
  INSERT INTO staff_attendance_records (id, staff_id, date, check_in_at, source, events)
  VALUES (
    'sat-' || gen_random_uuid(), p_staff_id, kst_date, now(), 'kiosk',
    jsonb_build_array(jsonb_build_object('type', 'in', 'at', now()))
  )
  RETURNING * INTO rec;

  RETURN jsonb_build_object('result', 'ok', 'reentry', FALSE, 'record', to_jsonb(rec));
END $$;

-- ----------------------------------------------------------------
-- 5. kiosk_staff_check_out — 퇴근.
--    직전 이벤트가 'out'이면(재입력=갱신) 마지막 out 시각만 교체,
--    아니면 새 out 이벤트 append (학생판 kiosk_check_out과 동일 로직).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION kiosk_staff_check_out(p_staff_id TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_date    DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  rec         staff_attendance_records%ROWTYPE;
  v_last_type TEXT;
  v_events    JSONB;
BEGIN
  SELECT * INTO rec FROM staff_attendance_records
   WHERE staff_id = p_staff_id AND date = kst_date;

  IF rec.id IS NULL OR rec.check_in_at IS NULL THEN
    RETURN jsonb_build_object('result', 'no_check_in');
  END IF;

  v_last_type := (rec.events -> (jsonb_array_length(rec.events) - 1) ->> 'type');
  IF jsonb_array_length(rec.events) > 0 AND v_last_type = 'out' THEN
    v_events := (rec.events - (jsonb_array_length(rec.events) - 1))
                || jsonb_build_object('type', 'out', 'at', now());
  ELSE
    v_events := rec.events || jsonb_build_object('type', 'out', 'at', now());
  END IF;

  UPDATE staff_attendance_records
     SET check_out_at = now(),
         events       = v_events
   WHERE id = rec.id
   RETURNING * INTO rec;

  RETURN jsonb_build_object('result', 'ok', 'record', to_jsonb(rec));
END $$;

-- 적용 확인:
--   select column_name from information_schema.columns
--    where table_name = 'staff_attendance_records';
--   -- 출근→퇴근→재출근 시나리오 수동 테스트:
--   -- select kiosk_staff_check_in('교직원id'); select kiosk_staff_check_out('교직원id');
--   -- select kiosk_staff_check_in('교직원id'); -- result에 "reentry": true 포함돼야 정상
