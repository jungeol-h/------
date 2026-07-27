-- ================================================================
-- 예약 — 강사 주간 가용시간 선언 + 롤링 자동 파생 (2026-07-27)
-- Supabase Dashboard > SQL Editor 에서 전체 실행 (재실행 안전)
--
-- 배경: 타임테이블을 "슬롯 뭉치 생산"으로 운영하니 기간이 끝날 때마다 다시
-- 찍어야 했다. 어포인트먼트 모델(Calendly류)로 전환 — 강사가 주간 반복 규칙
-- ("월·수 16~20시 코칭")을 선언하면 시스템이 내일부터 horizon_days(기본 28일)
-- 앞까지 예약공개 슬롯을 유지하고, pg_cron이 매일 지평을 연장한다.
--
-- 파생 의미론 (혼선 방지 — 코드 리뷰 시 필독):
--  - 규칙 저장/삭제/비활성: 그 규칙이 만든 "미래·미예약" 슬롯을 지우고(예약
--    있는 슬롯·오늘 슬롯은 보존) 활성 규칙이면 내일~지평까지 재생성한다.
--    규칙을 고치면 미예약 파생 슬롯이 다시 깔린다 — 개별 휴무는 슬롯 삭제가
--    아니라 규칙의 exclude_dates(휴무일)로 표현한다.
--  - cron 연장: generated_until 이후 날짜만 "추가"한다. 강사가 손으로 지운
--    파생 슬롯을 되살리지 않는다.
--  - 생성 시 같은 강사의 기존 슬롯(수동 생성·타 규칙 포함)과 겹치는 시간은
--    건너뛴다. 슬롯 단위는 프로그램(slot_minutes) 소관.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 규칙 테이블 + 파생 슬롯 역추적 컬럼
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_availability_rules (
  id            TEXT PRIMARY KEY,
  educator_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id    TEXT NOT NULL REFERENCES booking_programs(id) ON DELETE CASCADE,
  subject_id    TEXT REFERENCES booking_subjects(id) ON DELETE SET NULL,
  weekdays      INT[] NOT NULL,                    -- 0=일 ~ 6=토 (JS getDay 규약)
  day_start     TIME NOT NULL,
  day_end       TIME NOT NULL,
  break_start   TIME,
  break_end     TIME,
  capacity      INT CHECK (capacity IS NULL OR capacity >= 1),  -- NULL=프로그램 기본
  is_public     BOOLEAN NOT NULL DEFAULT TRUE,
  exclude_dates DATE[] NOT NULL DEFAULT '{}',      -- 휴무일 (개별 예외는 여기로)
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  horizon_days  INT NOT NULL DEFAULT 28 CHECK (horizon_days BETWEEN 7 AND 90),
  generated_until DATE,                            -- cron 연장 커서 (여기까지 생성됨)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CHECK (day_end > day_start)
);

CREATE INDEX IF NOT EXISTS booking_avail_rules_educator
  ON booking_availability_rules (educator_id);

ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS rule_id TEXT;
CREATE INDEX IF NOT EXISTS booking_slots_rule ON booking_slots (rule_id, date);

ALTER TABLE booking_availability_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON booking_availability_rules;
CREATE POLICY "anon_all" ON booking_availability_rules
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 2. 내부 — 규칙 1건의 슬롯 생성 (p_from ~ 오늘+지평, 겹침·휴무 건너뜀)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION _booking_generate_rule_slots(
  r booking_availability_rules, p_from DATE
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_until   DATE := kst_today + r.horizon_days;
  prog      RECORD;
  d         DATE;
  t         TIME;
  t_end     TIME;
  v_count   INT := 0;
BEGIN
  SELECT * INTO prog FROM booking_programs WHERE id = r.program_id;
  IF NOT FOUND OR prog.slot_minutes IS NULL OR prog.slot_minutes <= 0 THEN
    RETURN 0;
  END IF;

  d := GREATEST(p_from, kst_today + 1);  -- 오늘 슬롯은 건드리지 않는다 (당일 운영 보호)
  WHILE d <= v_until LOOP
    IF EXTRACT(dow FROM d)::int = ANY(r.weekdays) AND NOT (d = ANY(r.exclude_dates)) THEN
      t := r.day_start;
      LOOP
        t_end := t + make_interval(mins => prog.slot_minutes);
        EXIT WHEN t_end > r.day_end;
        -- 휴식과 겹치면 건너뜀
        IF NOT (r.break_start IS NOT NULL AND r.break_end IS NOT NULL
                AND t < r.break_end AND t_end > r.break_start) THEN
          -- 같은 강사의 기존 슬롯(취소 제외)과 겹치면 건너뜀 — 수동 슬롯·타 규칙 존중
          IF NOT EXISTS (
            SELECT 1 FROM booking_slots s
            WHERE s.educator_id = r.educator_id AND s.date = d
              AND s.status <> 'cancelled'
              AND s.start_time < t_end AND s.end_time > t
          ) THEN
            INSERT INTO booking_slots
              (id, program_id, educator_id, subject_id, batch_id, rule_id,
               date, start_time, end_time, capacity, status, is_public, note, created_by)
            VALUES
              ('bks' || gen_random_uuid(), r.program_id, r.educator_id, r.subject_id, NULL, r.id,
               d, t, t_end, COALESCE(r.capacity, prog.default_capacity, 1),
               'open', r.is_public, '', r.educator_id);
            v_count := v_count + 1;
          END IF;
        END IF;
        t := t_end;
      END LOOP;
    END IF;
    d := d + 1;
  END LOOP;

  UPDATE booking_availability_rules SET generated_until = v_until WHERE id = r.id;
  RETURN v_count;
END $$;

-- ----------------------------------------------------------------
-- 3. 내부 — 규칙이 만든 미래·미예약 슬롯 정리 (예약 있는 슬롯은 보존)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION _booking_cleanup_rule_slots(p_rule_id TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_count   INT;
BEGIN
  DELETE FROM booking_slots s
  WHERE s.rule_id = p_rule_id
    AND s.date > kst_today
    AND s.status IN ('draft', 'reviewed', 'open', 'closed')
    AND NOT EXISTS (
      SELECT 1 FROM booking_reservations res
      WHERE res.slot_id = s.id AND res.status = 'confirmed'
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ----------------------------------------------------------------
-- 4. RPC — 규칙 저장·삭제 + 즉시 재파생 (강사 본인 / 관리자)
--    p_rule: {id, educator_id, program_id, subject_id, weekdays, day_start,
--             day_end, break_start, break_end, capacity, is_public,
--             exclude_dates, active, horizon_days}
--    반환: { ok, code, created?, removed? }
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION booking_save_availability_rule(
  p_rule JSONB, p_actor_id TEXT, p_actor_role TEXT, p_delete BOOLEAN DEFAULT FALSE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id       TEXT := p_rule->>'id';
  v_educator TEXT := p_rule->>'educator_id';
  v_weekdays INT[];
  v_excludes DATE[];
  v_row      booking_availability_rules;
  v_created  INT := 0;
  v_removed  INT := 0;
BEGIN
  IF p_actor_role NOT IN ('admin', 'manager', 'instructor', 'consultant') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('booking_availability'));

  IF p_delete THEN
    SELECT * INTO v_row FROM booking_availability_rules WHERE id = v_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    END IF;
    IF p_actor_role <> 'admin' AND v_row.educator_id <> p_actor_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    END IF;
    v_removed := _booking_cleanup_rule_slots(v_id);
    DELETE FROM booking_availability_rules WHERE id = v_id;
    PERFORM _booking_audit('availability_rule', v_id, 'delete', p_actor_id, p_actor_role,
      NULL, FALSE, to_jsonb(v_row), NULL);
    RETURN jsonb_build_object('ok', true, 'code', 'OK', 'removed', v_removed);
  END IF;

  -- 소유·입력 검증
  IF p_actor_role <> 'admin' AND v_educator <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM booking_programs WHERE id = p_rule->>'program_id' AND active) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;
  SELECT COALESCE(array_agg(x::int), '{}') INTO v_weekdays
  FROM jsonb_array_elements_text(p_rule->'weekdays') x;
  IF array_length(v_weekdays, 1) IS NULL
     OR EXISTS (SELECT 1 FROM unnest(v_weekdays) w WHERE w < 0 OR w > 6)
     OR (p_rule->>'day_end')::time <= (p_rule->>'day_start')::time THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;
  SELECT COALESCE(array_agg(x::date), '{}') INTO v_excludes
  FROM jsonb_array_elements_text(p_rule->'exclude_dates') x;

  INSERT INTO booking_availability_rules
    (id, educator_id, program_id, subject_id, weekdays, day_start, day_end,
     break_start, break_end, capacity, is_public, exclude_dates, active, horizon_days)
  VALUES
    (v_id, v_educator, p_rule->>'program_id', NULLIF(p_rule->>'subject_id', ''),
     v_weekdays, (p_rule->>'day_start')::time, (p_rule->>'day_end')::time,
     NULLIF(p_rule->>'break_start', '')::time, NULLIF(p_rule->>'break_end', '')::time,
     NULLIF(p_rule->>'capacity', '')::int, COALESCE((p_rule->>'is_public')::boolean, TRUE),
     v_excludes, COALESCE((p_rule->>'active')::boolean, TRUE),
     COALESCE(NULLIF(p_rule->>'horizon_days', '')::int, 28))
  ON CONFLICT (id) DO UPDATE SET
    educator_id = EXCLUDED.educator_id,
    program_id = EXCLUDED.program_id,
    subject_id = EXCLUDED.subject_id,
    weekdays = EXCLUDED.weekdays,
    day_start = EXCLUDED.day_start,
    day_end = EXCLUDED.day_end,
    break_start = EXCLUDED.break_start,
    break_end = EXCLUDED.break_end,
    capacity = EXCLUDED.capacity,
    is_public = EXCLUDED.is_public,
    exclude_dates = EXCLUDED.exclude_dates,
    active = EXCLUDED.active,
    horizon_days = EXCLUDED.horizon_days
  RETURNING * INTO v_row;

  -- 재파생: 기존 미예약 파생 슬롯 정리 후 활성이면 내일~지평 재생성
  v_removed := _booking_cleanup_rule_slots(v_id);
  IF v_row.active THEN
    v_created := _booking_generate_rule_slots(v_row, (now() AT TIME ZONE 'Asia/Seoul')::date + 1);
  END IF;

  PERFORM _booking_audit('availability_rule', v_id, 'save', p_actor_id, p_actor_role,
    NULL, FALSE, NULL,
    to_jsonb(v_row) || jsonb_build_object('slots_created', v_created, 'slots_removed', v_removed));

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'created', v_created, 'removed', v_removed);
END $$;

-- ----------------------------------------------------------------
-- 5. RPC — 지평 연장 (pg_cron 매일 + 필요 시 수동). 추가 생성만 하고
--    기존 슬롯은 건드리지 않는다 (강사가 지운 파생 슬롯을 되살리지 않음).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION booking_sync_availability()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  r         booking_availability_rules;
  v_created INT := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('booking_availability'));
  FOR r IN SELECT * FROM booking_availability_rules WHERE active LOOP
    IF r.generated_until IS NULL OR r.generated_until < kst_today + r.horizon_days THEN
      v_created := v_created
        + _booking_generate_rule_slots(r, COALESCE(r.generated_until + 1, kst_today + 1));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'created', v_created);
END $$;

-- ----------------------------------------------------------------
-- 6. pg_cron — 매일 KST 00:20(UTC 15:20) 지평 연장
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('booking-extend-availability');
EXCEPTION WHEN OTHERS THEN NULL;  -- 최초 실행 시 잡이 없으면 무시
END $$;

SELECT cron.schedule('booking-extend-availability', '20 15 * * *',
  'SELECT booking_sync_availability()');
