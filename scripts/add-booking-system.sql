-- ================================================================
-- 컨설팅·코칭 통합 예약 시스템 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 전체 실행 (재실행 안전)
--
-- 설계 원칙 (supabase_attendance_migration.sql 관례 승계):
--  - 정원·시간겹침·횟수제한·기한 판정의 최종심은 전부 SECURITY DEFINER RPC.
--    supabase-js에는 원자 연산이 없으므로 클라이언트 검증은 UX용 사전 체크일 뿐이다.
--  - 시각 비교는 KST(now() AT TIME ZONE 'Asia/Seoul') — 단말 시계 불신.
--  - 좌석 카운터 컬럼 금지. 마감 여부는 confirmed 예약 count로 파생한다
--    (드리프트 원천 차단, 취소 시 정원 복원이 자동 성립).
--  - 동시성 방어 3중: 학생 advisory lock → 슬롯 FOR UPDATE(항상 이 순서,
--    슬롯 복수면 id 정렬 순 — 데드락 방지) → 부분 UNIQUE 인덱스(최후 방어선).
--  - 운영 규칙(시간 단위·정원·횟수·기한)은 전부 booking_programs 설정값.
--    소스코드에 고정하지 않는다 (명세 1.3-1).
--  - 자정을 넘는 슬롯(end <= start)은 상정하지 않는다 (출결 시스템과 동일 전제).
--  - RPC 실패 코드는 클라 bookingMessages.js 안내문 키와 1:1이다.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 프로그램 마스터 — 모든 예약 규칙의 설정값
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_programs (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  slot_minutes              INT  NOT NULL,               -- 슬롯 시간 단위 (분)
  default_capacity          INT  NOT NULL DEFAULT 1,
  daily_limit               INT  NOT NULL DEFAULT 1,     -- 하루 최대 블록 수
  daily_limit_scope         TEXT NOT NULL DEFAULT 'program'
    CHECK (daily_limit_scope IN ('program', 'program_educator', 'program_subject')),
    -- 'program'          : 프로그램 전체 합산 (자기주도 코칭 하루 2블록)
    -- 'program_educator' : 동일 강사별 합산 (진로진학 동일 컨설턴트 하루 1회)
    -- 'program_subject'  : 교과별 합산 (교과 컨설팅 교과별 하루 2블록)
  allow_consecutive         BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = 연속(인접) 예약 금지
  allow_group               BOOLEAN NOT NULL DEFAULT FALSE,  -- 그룹상담 편성 허용
  group_min                 INT DEFAULT 3,
  group_max                 INT DEFAULT 4,
  uses_subject              BOOLEAN NOT NULL DEFAULT FALSE,  -- 교과 구분 사용
  requires_open_period      BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = 월 단위 사전예약(오픈기간 필요)
  change_deadline_type      TEXT NOT NULL DEFAULT 'minutes_before'
    CHECK (change_deadline_type IN ('days_before', 'minutes_before')),
  change_deadline_value     INT  NOT NULL DEFAULT 60,
    -- days_before/2    → 상담일 D-2 23:59:59까지 변경·취소 (진로진학)
    -- minutes_before/60 → 시작 60분 전까지 변경·취소 (교과·코칭)
  booking_open_lead_minutes  INT NOT NULL DEFAULT 60,  -- 당일 접수: 그날 첫 슬롯 시작 N분 전부터
  booking_close_lead_minutes INT NOT NULL DEFAULT 60,  -- 당일 접수: 그날 마지막 슬롯 종료 N분 전까지
  target_group_names        TEXT[],                    -- NULL/빈 배열 = 전체 그룹 (groupScope.js 규약)
  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order                INT DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 2. 교과 마스터 (교과 컨설팅의 국·영·수 등 — 관리자 등록)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_subjects (
  id         TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES booking_programs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (program_id, name)
);

-- ----------------------------------------------------------------
-- 3. 프로그램-강사 배정 (신규 역할 없이 기존 instructor/consultant/manager 매핑)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_educators (
  id          TEXT PRIMARY KEY,
  program_id  TEXT NOT NULL REFERENCES booking_programs(id) ON DELETE CASCADE,
  educator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id  TEXT REFERENCES booking_subjects(id) ON DELETE SET NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS booking_educators_uniq
  ON booking_educators (program_id, educator_id, COALESCE(subject_id, ''));

-- ----------------------------------------------------------------
-- 4. 사전예약 오픈기간 (진로진학 월 단위 오픈·연장·재오픈)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_open_periods (
  id           TEXT PRIMARY KEY,
  program_id   TEXT NOT NULL REFERENCES booking_programs(id) ON DELETE CASCADE,
  target_start DATE NOT NULL,             -- 이 기간의 상담일 범위
  target_end   DATE NOT NULL,
  open_from    TIMESTAMPTZ NOT NULL,      -- 접수 시작·마감 일시
  open_until   TIMESTAMPTZ NOT NULL,
  note         TEXT DEFAULT '',
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CHECK (target_end >= target_start)
);

-- ----------------------------------------------------------------
-- 5. 타임테이블 일괄 생성 배치 (감사·묶음 관리용)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_timetable_batches (
  id         TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES booking_programs(id) ON DELETE CASCADE,
  params     JSONB,                       -- 기간·요일·운영시간·단위 스냅샷
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 6. 타임슬롯 (materialized — 관리자 일괄 생성, 강사 개별 편집)
--    정원 마감은 status가 아니라 confirmed 예약 count 파생.
--    'closed'는 수동 마감 전용, 'done'(운영종료)도 날짜 경과 파생이 기본.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_slots (
  id          TEXT PRIMARY KEY,
  program_id  TEXT NOT NULL REFERENCES booking_programs(id) ON DELETE CASCADE,
  educator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  subject_id  TEXT REFERENCES booking_subjects(id) ON DELETE SET NULL,
  batch_id    TEXT REFERENCES booking_timetable_batches(id) ON DELETE SET NULL,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  capacity    INT  NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  status      TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'open', 'closed', 'done', 'cancelled')),
    -- 작성중 → 검토완료 → 예약공개 → (수동)예약마감 / 운영종료 / 운영취소
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = 강사 지정 그룹 등 비공개 슬롯
  note        TEXT DEFAULT '',
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS booking_slots_program_date  ON booking_slots (program_id, date);
CREATE INDEX IF NOT EXISTS booking_slots_educator_date ON booking_slots (educator_id, date);
CREATE INDEX IF NOT EXISTS booking_slots_date_status   ON booking_slots (date, status);

-- ----------------------------------------------------------------
-- 7. 예약 (1행 = 학생 1명의 세션 1건 — 그룹상담도 학생별 1행이라
--    출결·상담기록·감사가 전부 이 행 기준으로 일관 처리된다)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_reservations (
  id                   TEXT PRIMARY KEY,
  slot_id              TEXT NOT NULL REFERENCES booking_slots(id),
  program_id           TEXT NOT NULL REFERENCES booking_programs(id),
  student_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booked_by            TEXT NOT NULL,      -- 예약 실행자 (학생 본인·학부모·강사·관리자)
  booked_by_role       TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'moved')),
  moved_to_id          TEXT,               -- 변경 시 새 예약 링크
  cancelled_by         TEXT,
  cancelled_by_role    TEXT,
  cancel_reason        TEXT,
  cancelled_at         TIMESTAMPTZ,
  -- 출결 — 예약시간이 지나도 자동 참석 처리하지 않는다 (명세 13.3). pending 유지.
  attendance_status    TEXT NOT NULL DEFAULT 'pending'
    CHECK (attendance_status IN ('pending', 'attended', 'absent',
           'student_cancel', 'educator_cancel', 'center_cancel', 'rescheduled')),
  attendance_marked_by TEXT,
  attendance_marked_at TIMESTAMPTZ,
  attendance_overdue   BOOLEAN NOT NULL DEFAULT FALSE,  -- 처리기한(익일 23:59:59) 초과 처리 표식
  attendance_note      TEXT DEFAULT '',
  is_override          BOOLEAN NOT NULL DEFAULT FALSE,  -- 관리자 예외 처리로 생성된 예약
  override_reason      TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
-- 동시예약 최후 방어선 — 같은 슬롯에 같은 학생의 확정 예약은 1건뿐
CREATE UNIQUE INDEX IF NOT EXISTS booking_reservations_active_seat
  ON booking_reservations (slot_id, student_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS booking_reservations_student ON booking_reservations (student_id, status);
CREATE INDEX IF NOT EXISTS booking_reservations_slot    ON booking_reservations (slot_id, status);

-- ----------------------------------------------------------------
-- 8. 상담기록 — 기존 상담보고 6단계 양식 재사용 (테이블은 분리:
--    counseling_records는 manager_id NOT NULL·통계·학생 홈에 결합돼 재사용 시 회귀 위험)
--    미작성/기한임박/기한초과/작성대상아님은 전부 클라이언트 파생 — 저장하지 않는다.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_records (
  id               TEXT PRIMARY KEY,
  reservation_id   TEXT NOT NULL UNIQUE REFERENCES booking_reservations(id) ON DELETE CASCADE,
  educator_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  student_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id       TEXT NOT NULL REFERENCES booking_programs(id),
  date             DATE NOT NULL,          -- 상담일 스냅샷 (작성기한 판정 기준)
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'done')),
  topic            TEXT DEFAULT '',
  diagnosis        TEXT DEFAULT '',
  advice           TEXT DEFAULT '',
  follow_up        TEXT DEFAULT '',
  note             TEXT DEFAULT '',
  next_appointment TEXT DEFAULT '',
  completed_at     TIMESTAMPTZ,            -- 작성 완료 시각 (기한 초과 작성 판정)
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_records_educator ON booking_records (educator_id, date);

-- ----------------------------------------------------------------
-- 9. 인앱 알림 (attendance_notifications 선례 — resolved 플래그 + Realtime)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_notifications (
  id             TEXT PRIMARY KEY,
  recipient_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
    -- reserved | changed | cancelled | slot_changed | group_assigned
    -- attendance_pending | attendance_overdue | record_due | record_overdue | today_schedule
  reservation_id TEXT,
  slot_id        TEXT,
  message        TEXT NOT NULL,
  resolved       BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_notifications_recipient
  ON booking_notifications (recipient_id, resolved);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE booking_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------
-- 10. 감사이력 (명세 19) — 예외 처리 기록 겸용(is_override 필터).
--     앱에는 이 테이블의 UPDATE/DELETE 경로를 만들지 않는다 (완전삭제 금지).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_audit_logs (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,   -- 'reservation' | 'slot' | 'record' | 'program' | 'subject' | 'educator' | 'open_period'
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,   -- 'create' | 'change' | 'cancel' | 'attendance' | 'attendance_overdue'
                               -- | 'group_assign' | 'slot_edit' | 'delete' | 'status_change' | 'update'
  actor_id    TEXT NOT NULL,
  actor_role  TEXT NOT NULL,
  reason      TEXT,
  is_override BOOLEAN NOT NULL DEFAULT FALSE,
  before_data JSONB,
  after_data  JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_audit_entity  ON booking_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS booking_audit_created ON booking_audit_logs (created_at);

-- ================================================================
-- RPC — 내부 헬퍼
-- ================================================================

CREATE OR REPLACE FUNCTION _booking_audit(
  p_entity_type TEXT, p_entity_id TEXT, p_action TEXT,
  p_actor_id TEXT, p_actor_role TEXT, p_reason TEXT, p_is_override BOOLEAN,
  p_before JSONB, p_after JSONB
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO booking_audit_logs
    (id, entity_type, entity_id, action, actor_id, actor_role, reason, is_override, before_data, after_data)
  VALUES
    ('bka-' || gen_random_uuid(), p_entity_type, p_entity_id, p_action,
     p_actor_id, p_actor_role, p_reason, COALESCE(p_is_override, FALSE), p_before, p_after);
$$;

CREATE OR REPLACE FUNCTION _booking_notify(
  p_recipient TEXT, p_type TEXT, p_reservation_id TEXT, p_slot_id TEXT, p_message TEXT
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO booking_notifications (id, recipient_id, type, reservation_id, slot_id, message)
  VALUES ('bkn-' || gen_random_uuid(), p_recipient, p_type, p_reservation_id, p_slot_id, p_message);
$$;

-- 수신자·유형·예약당 1회만 생성 (다이제스트 멱등용)
CREATE OR REPLACE FUNCTION _booking_notify_once(
  p_recipient TEXT, p_type TEXT, p_reservation_id TEXT, p_message TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM booking_notifications
    WHERE recipient_id = p_recipient AND type = p_type AND reservation_id = p_reservation_id
  ) THEN
    PERFORM _booking_notify(p_recipient, p_type, p_reservation_id, NULL, p_message);
  END IF;
END $$;

-- 학생 + 연결된 학부모 전원 + 담당 강사에게 일괄 알림
CREATE OR REPLACE FUNCTION _booking_notify_parties(
  p_student_id TEXT, p_educator_id TEXT, p_type TEXT,
  p_reservation_id TEXT, p_slot_id TEXT, p_message TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_parent TEXT;
BEGIN
  PERFORM _booking_notify(p_student_id, p_type, p_reservation_id, p_slot_id, p_message);
  FOR v_parent IN SELECT parent_id FROM parent_children WHERE student_id = p_student_id LOOP
    PERFORM _booking_notify(v_parent, p_type, p_reservation_id, p_slot_id, p_message);
  END LOOP;
  IF p_educator_id IS NOT NULL THEN
    PERFORM _booking_notify(p_educator_id, p_type, p_reservation_id, p_slot_id, p_message);
  END IF;
END $$;

-- 변경·취소 기한 판정.
--  days_before   : KST 날짜가 (상담일 - N일) 이하인 동안 허용 → D-N 23:59:59까지 (자정 경계 정확)
--  minutes_before: KST now가 (시작시각 - N분) 미만인 동안 허용
CREATE OR REPLACE FUNCTION _booking_deadline_ok(
  p_program booking_programs, p_slot booking_slots
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  kst_now TIMESTAMP := now() AT TIME ZONE 'Asia/Seoul';
BEGIN
  IF p_program.change_deadline_type = 'days_before' THEN
    RETURN kst_now::date <= p_slot.date - p_program.change_deadline_value;
  ELSE
    RETURN kst_now < (p_slot.date + p_slot.start_time)
                     - make_interval(mins => p_program.change_deadline_value);
  END IF;
END $$;

-- 예약 검증 본체 — reserve / change / assign_group 이 공유.
-- 호출측이 먼저 학생 advisory lock + 슬롯 FOR UPDATE를 잡아야 한다.
-- p_is_staff: 강사·관리자 경유(그룹 편성·대리 예약)는 접수기간·접수창을 적용하지
--   않는다 (명세 6.2·11 — 학생·학부모의 온라인 접수에만 해당하는 규칙).
-- 반환: 'OK' 또는 실패 코드 (bookingMessages.js 안내문 키와 1:1).
CREATE OR REPLACE FUNCTION _booking_validate(
  p_slot booking_slots, p_program booking_programs,
  p_student_id TEXT, p_exclude_id TEXT DEFAULT NULL,
  p_is_staff BOOLEAN DEFAULT FALSE
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_now      TIMESTAMP := now() AT TIME ZONE 'Asia/Seoul';
  kst_date     DATE      := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_groups     TEXT[];
  v_day_start  TIME;
  v_day_end    TIME;
  v_count      INT;
BEGIN
  -- 이미 시작됐거나 지난 슬롯 (명세 6.1)
  IF (p_slot.date + p_slot.start_time) <= kst_now THEN
    RETURN 'PAST_SLOT';
  END IF;

  -- 프로그램 대상 그룹 (학생 무소속 = 전체 허용 — groupScope.js 규약)
  IF p_program.target_group_names IS NOT NULL
     AND array_length(p_program.target_group_names, 1) > 0 THEN
    SELECT group_names INTO v_groups FROM users WHERE id = p_student_id;
    IF v_groups IS NOT NULL AND array_length(v_groups, 1) > 0
       AND NOT (v_groups && p_program.target_group_names) THEN
      RETURN 'NOT_TARGET_GROUP';
    END IF;
  END IF;

  IF p_is_staff THEN
    NULL;  -- 강사·관리자: 접수기간·당일 접수창 미적용
  ELSIF p_program.requires_open_period THEN
    -- 사전예약형: 접수기간 안이고 상담일이 기간 범위여야 신규 예약 가능 (명세 6.2)
    IF NOT EXISTS (
      SELECT 1 FROM booking_open_periods op
      WHERE op.program_id = p_program.id
        AND now() BETWEEN op.open_from AND op.open_until
        AND p_slot.date BETWEEN op.target_start AND op.target_end
    ) THEN
      RETURN 'OUT_OF_OPEN_PERIOD';
    END IF;
  ELSIF p_slot.date = kst_date THEN
    -- 당일 예약형 접수창: 그날 첫 슬롯 시작 N분 전 ~ 마지막 슬롯 종료 N분 전 (명세 6.1).
    -- ※ 해석: 접수창은 당일 슬롯에만 적용하고 미래 일자는 공개 즉시 수시 접수.
    --   해석이 바뀌면 이 분기 하나만 고치면 된다.
    -- ※ TIME - interval은 자정을 넘으면 wrap된다 — 운영시간이 01:00 이전에
    --   시작하는 케이스는 상정하지 않는다.
    SELECT min(start_time), max(end_time) INTO v_day_start, v_day_end
    FROM booking_slots
    WHERE program_id = p_program.id AND date = kst_date AND status = 'open';
    IF v_day_start IS NOT NULL AND (
         kst_now::time < v_day_start - make_interval(mins => p_program.booking_open_lead_minutes)
      OR kst_now::time > v_day_end   - make_interval(mins => p_program.booking_close_lead_minutes)
    ) THEN
      RETURN 'WINDOW_CLOSED';
    END IF;
  END IF;

  -- 같은 슬롯 중복 (부분 UNIQUE 인덱스의 사전 친절 버전)
  IF EXISTS (
    SELECT 1 FROM booking_reservations r
    WHERE r.slot_id = p_slot.id AND r.student_id = p_student_id AND r.status = 'confirmed'
      AND (p_exclude_id IS NULL OR r.id <> p_exclude_id)
  ) THEN
    RETURN 'ALREADY_BOOKED';
  END IF;

  -- 동일 시간대 겹침 — 전 프로그램 횡단, strict overlap (명세 7.2).
  -- 인접 블록(끝=시작)은 겹침이 아니므로 교과 연속 2블록이 자연 허용된다.
  IF EXISTS (
    SELECT 1 FROM booking_reservations r
    JOIN booking_slots s ON s.id = r.slot_id
    WHERE r.student_id = p_student_id AND r.status = 'confirmed'
      AND (p_exclude_id IS NULL OR r.id <> p_exclude_id)
      AND s.date = p_slot.date
      AND s.start_time < p_slot.end_time
      AND s.end_time   > p_slot.start_time
  ) THEN
    RETURN 'OVERLAP';
  END IF;

  -- 하루 횟수 제한 — daily_limit_scope에 따라 합산 범위 분기 (명세 4장)
  SELECT count(*) INTO v_count
  FROM booking_reservations r
  JOIN booking_slots s ON s.id = r.slot_id
  WHERE r.student_id = p_student_id AND r.status = 'confirmed'
    AND (p_exclude_id IS NULL OR r.id <> p_exclude_id)
    AND r.program_id = p_program.id
    AND s.date = p_slot.date
    AND (p_program.daily_limit_scope <> 'program_educator'
         OR s.educator_id IS NOT DISTINCT FROM p_slot.educator_id)
    AND (p_program.daily_limit_scope <> 'program_subject'
         OR s.subject_id IS NOT DISTINCT FROM p_slot.subject_id);
  IF v_count >= p_program.daily_limit THEN
    RETURN 'DAILY_LIMIT';
  END IF;

  -- 연속예약 금지 — 같은 프로그램·같은 날 인접 블록(등호 비교) (명세 4.3)
  IF NOT p_program.allow_consecutive THEN
    IF EXISTS (
      SELECT 1 FROM booking_reservations r
      JOIN booking_slots s ON s.id = r.slot_id
      WHERE r.student_id = p_student_id AND r.status = 'confirmed'
        AND (p_exclude_id IS NULL OR r.id <> p_exclude_id)
        AND r.program_id = p_program.id
        AND s.date = p_slot.date
        AND (s.end_time = p_slot.start_time OR s.start_time = p_slot.end_time)
    ) THEN
      RETURN 'CONSECUTIVE_FORBIDDEN';
    END IF;
  END IF;

  -- 정원 — 슬롯 행이 FOR UPDATE로 잠겨 있어 count-then-insert가 원자적 (명세 7.3)
  SELECT count(*) INTO v_count FROM booking_reservations
  WHERE slot_id = p_slot.id AND status = 'confirmed'
    AND (p_exclude_id IS NULL OR id <> p_exclude_id);
  IF v_count >= p_slot.capacity THEN
    RETURN 'SLOT_FULL';
  END IF;

  RETURN 'OK';
END $$;

-- 예약에 대한 행위자 권한: 학생 본인 / 연결된 학부모 / 슬롯 담당 강사 / 관리자
CREATE OR REPLACE FUNCTION _booking_actor_allowed(
  p_actor_id TEXT, p_actor_role TEXT, p_student_id TEXT, p_slot_educator_id TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_actor_role = 'admin' THEN RETURN TRUE; END IF;
  IF p_actor_role = 'student' THEN RETURN p_actor_id = p_student_id; END IF;
  IF p_actor_role = 'parent' THEN
    RETURN EXISTS (SELECT 1 FROM parent_children
                   WHERE parent_id = p_actor_id AND student_id = p_student_id);
  END IF;
  -- instructor / consultant / manager: 자기 슬롯만
  RETURN p_slot_educator_id IS NOT NULL AND p_slot_educator_id = p_actor_id;
END $$;

-- ================================================================
-- RPC — 예약 생성
-- ================================================================
CREATE OR REPLACE FUNCTION booking_reserve(
  p_slot_id TEXT, p_student_id TEXT, p_actor_id TEXT, p_actor_role TEXT,
  p_override BOOLEAN DEFAULT FALSE, p_reason TEXT DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  slot   booking_slots%ROWTYPE;
  prog   booking_programs%ROWTYPE;
  res    booking_reservations%ROWTYPE;
  v_code TEXT;
  v_id   TEXT;
  v_msg  TEXT;
BEGIN
  IF p_override THEN
    IF p_actor_role <> 'admin' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    END IF;
    IF COALESCE(trim(p_reason), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
    END IF;
  END IF;

  -- 잠금 순서 고정: 학생 advisory → 슬롯 FOR UPDATE
  PERFORM pg_advisory_xact_lock(hashtext('bk:' || p_student_id));
  SELECT * INTO slot FROM booking_slots WHERE id = p_slot_id FOR UPDATE;
  IF slot.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  SELECT * INTO prog FROM booking_programs WHERE id = slot.program_id;

  IF NOT _booking_actor_allowed(p_actor_id, p_actor_role, p_student_id, slot.educator_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  -- 공개 상태: 학생·학부모는 open + 공개 슬롯 + active 프로그램만.
  -- 관리자 예외 처리는 운영취소 슬롯만 아니면 허용 (명세 16.1).
  IF NOT p_override THEN
    IF slot.status <> 'open' OR NOT prog.active THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SLOT_NOT_OPEN');
    END IF;
    IF NOT slot.is_public AND p_actor_role IN ('student', 'parent') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SLOT_NOT_OPEN');
    END IF;
  ELSIF slot.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SLOT_NOT_OPEN');
  END IF;

  v_code := _booking_validate(slot, prog, p_student_id, NULL,
                              p_actor_role NOT IN ('student', 'parent'));
  IF v_code = 'ALREADY_BOOKED' OR (NOT p_override AND v_code <> 'OK') THEN
    RETURN jsonb_build_object('ok', false, 'code', v_code);
  END IF;

  v_id := 'bkr-' || gen_random_uuid();
  INSERT INTO booking_reservations
    (id, slot_id, program_id, student_id, booked_by, booked_by_role, is_override, override_reason)
  VALUES
    (v_id, slot.id, slot.program_id, p_student_id, p_actor_id, p_actor_role,
     p_override, CASE WHEN p_override THEN p_reason END)
  RETURNING * INTO res;

  PERFORM _booking_audit('reservation', v_id, 'create', p_actor_id, p_actor_role,
    p_reason, p_override, NULL,
    jsonb_build_object('slot_id', slot.id, 'student_id', p_student_id,
                       'date', slot.date, 'start_time', slot.start_time,
                       'validation_code', v_code));

  v_msg := '[' || prog.name || '] ' || to_char(slot.date, 'MM/DD') || ' '
           || to_char(slot.start_time, 'HH24:MI') || ' 예약이 확정되었습니다.';
  PERFORM _booking_notify_parties(p_student_id, slot.educator_id, 'reserved', v_id, slot.id, v_msg);

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'reservation', to_jsonb(res));
END $$;

-- ================================================================
-- RPC — 예약 취소 (정원 복원은 count 파생이라 자동)
-- ================================================================
CREATE OR REPLACE FUNCTION booking_cancel(
  p_reservation_id TEXT, p_actor_id TEXT, p_actor_role TEXT,
  p_reason TEXT DEFAULT NULL, p_override BOOLEAN DEFAULT FALSE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  res     booking_reservations%ROWTYPE;
  slot    booking_slots%ROWTYPE;
  prog    booking_programs%ROWTYPE;
  v_att   TEXT;
  v_msg   TEXT;
  v_before jsonb;
BEGIN
  SELECT * INTO res FROM booking_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF res.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  IF res.status <> 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_CANCELLED');
  END IF;
  SELECT * INTO slot FROM booking_slots WHERE id = res.slot_id;
  SELECT * INTO prog FROM booking_programs WHERE id = res.program_id;

  IF NOT _booking_actor_allowed(p_actor_id, p_actor_role, res.student_id, slot.educator_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  IF p_actor_role IN ('student', 'parent') THEN
    -- 온라인 취소 기한 (명세 9장). 관리자·강사는 기한 무관하되 사유 필수.
    IF NOT _booking_deadline_ok(prog, slot) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'DEADLINE_PASSED');
    END IF;
  ELSIF COALESCE(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
  END IF;

  v_att := CASE
    WHEN p_actor_role IN ('student', 'parent') THEN 'student_cancel'
    WHEN p_actor_role = 'admin' THEN 'center_cancel'
    ELSE 'educator_cancel'
  END;
  v_before := to_jsonb(res);

  UPDATE booking_reservations
     SET status = 'cancelled',
         cancelled_by = p_actor_id, cancelled_by_role = p_actor_role,
         cancel_reason = p_reason, cancelled_at = now(),
         attendance_status = v_att,
         attendance_marked_by = p_actor_id, attendance_marked_at = now()
   WHERE id = res.id
   RETURNING * INTO res;

  PERFORM _booking_audit('reservation', res.id, 'cancel', p_actor_id, p_actor_role,
    p_reason, p_override, v_before, to_jsonb(res));

  v_msg := '[' || prog.name || '] ' || to_char(slot.date, 'MM/DD') || ' '
           || to_char(slot.start_time, 'HH24:MI') || ' 예약이 취소되었습니다.'
           || CASE WHEN p_actor_role NOT IN ('student', 'parent')
                   THEN ' (사유: ' || COALESCE(p_reason, '') || ')' ELSE '' END;
  PERFORM _booking_notify_parties(res.student_id, slot.educator_id, 'cancelled', res.id, slot.id, v_msg);

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'reservation', to_jsonb(res));
END $$;

-- ================================================================
-- RPC — 예약 변경 (선확보 후 해제, 단일 트랜잭션 — 명세 8.1)
--       실패 시 전체 롤백이라 기존 예약만 날아가는 사고가 구조적으로 불가능.
-- ================================================================
CREATE OR REPLACE FUNCTION booking_change(
  p_reservation_id TEXT, p_new_slot_id TEXT, p_actor_id TEXT, p_actor_role TEXT,
  p_override BOOLEAN DEFAULT FALSE, p_reason TEXT DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  res      booking_reservations%ROWTYPE;
  old_slot booking_slots%ROWTYPE;
  new_slot booking_slots%ROWTYPE;
  old_prog booking_programs%ROWTYPE;
  new_prog booking_programs%ROWTYPE;
  new_res  booking_reservations%ROWTYPE;
  v_code   TEXT;
  v_id     TEXT;
  v_msg    TEXT;
  v_before jsonb;
BEGIN
  IF p_override THEN
    IF p_actor_role <> 'admin' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    END IF;
    IF COALESCE(trim(p_reason), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
    END IF;
  END IF;

  SELECT * INTO res FROM booking_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF res.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  IF res.status <> 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_CANCELLED');
  END IF;
  IF res.slot_id = p_new_slot_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;

  -- 잠금 순서: 학생 advisory → 슬롯 2개를 id 정렬 순 FOR UPDATE (데드락 방지)
  PERFORM pg_advisory_xact_lock(hashtext('bk:' || res.student_id));
  IF res.slot_id < p_new_slot_id THEN
    SELECT * INTO old_slot FROM booking_slots WHERE id = res.slot_id FOR UPDATE;
    SELECT * INTO new_slot FROM booking_slots WHERE id = p_new_slot_id FOR UPDATE;
  ELSE
    SELECT * INTO new_slot FROM booking_slots WHERE id = p_new_slot_id FOR UPDATE;
    SELECT * INTO old_slot FROM booking_slots WHERE id = res.slot_id FOR UPDATE;
  END IF;
  IF new_slot.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  SELECT * INTO old_prog FROM booking_programs WHERE id = old_slot.program_id;
  SELECT * INTO new_prog FROM booking_programs WHERE id = new_slot.program_id;

  IF NOT _booking_actor_allowed(p_actor_id, p_actor_role, res.student_id, old_slot.educator_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  -- 기존 예약의 변경 기한 (명세 8.2·8.3). 강사·관리자는 기한 무관하되 사유 필수.
  IF p_actor_role IN ('student', 'parent') THEN
    IF NOT _booking_deadline_ok(old_prog, old_slot) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'DEADLINE_PASSED');
    END IF;
  ELSIF COALESCE(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
  END IF;

  -- 새 슬롯 공개 상태 (reserve와 동일 기준)
  IF NOT p_override THEN
    IF new_slot.status <> 'open' OR NOT new_prog.active THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SLOT_NOT_OPEN');
    END IF;
    IF NOT new_slot.is_public AND p_actor_role IN ('student', 'parent') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SLOT_NOT_OPEN');
    END IF;
  ELSIF new_slot.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SLOT_NOT_OPEN');
  END IF;

  -- 새 슬롯 검증 — 기존 예약은 겹침·횟수·정원 count에서 제외(p_exclude)
  v_code := _booking_validate(new_slot, new_prog, res.student_id, res.id,
                              p_actor_role NOT IN ('student', 'parent'));
  IF v_code = 'ALREADY_BOOKED' OR (NOT p_override AND v_code <> 'OK') THEN
    RETURN jsonb_build_object('ok', false, 'code', v_code);
  END IF;

  -- 신규 확보
  v_id := 'bkr-' || gen_random_uuid();
  INSERT INTO booking_reservations
    (id, slot_id, program_id, student_id, booked_by, booked_by_role, is_override, override_reason)
  VALUES
    (v_id, new_slot.id, new_slot.program_id, res.student_id, p_actor_id, p_actor_role,
     p_override, CASE WHEN p_override THEN p_reason END)
  RETURNING * INTO new_res;

  -- 기존 해제 (변경완료 상태 — 명세 12)
  v_before := to_jsonb(res);
  UPDATE booking_reservations
     SET status = 'moved', moved_to_id = v_id,
         attendance_status = 'rescheduled',
         attendance_marked_by = p_actor_id, attendance_marked_at = now()
   WHERE id = res.id;

  PERFORM _booking_audit('reservation', res.id, 'change', p_actor_id, p_actor_role,
    p_reason, p_override, v_before,
    jsonb_build_object('moved_to', v_id, 'new_slot_id', new_slot.id,
                       'new_date', new_slot.date, 'new_start_time', new_slot.start_time,
                       'validation_code', v_code));

  v_msg := '[' || new_prog.name || '] 예약이 '
           || to_char(old_slot.date, 'MM/DD') || ' ' || to_char(old_slot.start_time, 'HH24:MI')
           || ' → ' || to_char(new_slot.date, 'MM/DD') || ' ' || to_char(new_slot.start_time, 'HH24:MI')
           || ' 으로 변경되었습니다.';
  PERFORM _booking_notify_parties(res.student_id, new_slot.educator_id, 'changed', v_id, new_slot.id, v_msg);
  IF old_slot.educator_id IS NOT NULL
     AND old_slot.educator_id IS DISTINCT FROM new_slot.educator_id THEN
    PERFORM _booking_notify(old_slot.educator_id, 'changed', v_id, new_slot.id, v_msg);
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'OK',
    'reservation', to_jsonb(new_res), 'moved_from', res.id);
END $$;

-- ================================================================
-- RPC — 그룹상담 학생 배정 (강사 직접 편성 — 명세 11)
--       배정도 동일 검증을 경유하며(명세 11.4), 학생별 부분 성공을 허용한다.
-- ================================================================
CREATE OR REPLACE FUNCTION booking_assign_group(
  p_slot_id TEXT, p_student_ids TEXT[], p_actor_id TEXT, p_actor_role TEXT,
  p_override BOOLEAN DEFAULT FALSE, p_reason TEXT DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  slot     booking_slots%ROWTYPE;
  prog     booking_programs%ROWTYPE;
  v_sorted TEXT[];
  v_sid    TEXT;
  v_code   TEXT;
  v_id     TEXT;
  v_msg    TEXT;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF p_actor_role IN ('student', 'parent') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF p_override AND p_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF p_override AND COALESCE(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
  END IF;

  -- 잠금 순서 유지: 학생들(정렬 순) advisory → 슬롯 FOR UPDATE
  SELECT array_agg(x ORDER BY x) INTO v_sorted FROM unnest(p_student_ids) AS x;
  IF v_sorted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;
  FOREACH v_sid IN ARRAY v_sorted LOOP
    PERFORM pg_advisory_xact_lock(hashtext('bk:' || v_sid));
  END LOOP;

  SELECT * INTO slot FROM booking_slots WHERE id = p_slot_id FOR UPDATE;
  IF slot.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  SELECT * INTO prog FROM booking_programs WHERE id = slot.program_id;

  IF p_actor_role <> 'admin'
     AND (slot.educator_id IS NULL OR slot.educator_id <> p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF NOT prog.allow_group THEN
    RETURN jsonb_build_object('ok', false, 'code', 'GROUP_NOT_ALLOWED');
  END IF;
  IF slot.status IN ('done', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SLOT_NOT_OPEN');
  END IF;

  FOREACH v_sid IN ARRAY v_sorted LOOP
    -- 강사 편성은 접수기간·접수창 미적용 (겹침·횟수·연속·정원은 검증)
    v_code := _booking_validate(slot, prog, v_sid, NULL, TRUE);
    IF v_code = 'OK' OR (p_override AND v_code <> 'ALREADY_BOOKED') THEN
      v_id := 'bkr-' || gen_random_uuid();
      -- is_override는 reserve/change와 동일하게 p_override 그대로 저장 —
      -- 검증을 통과한 학생도 override 배치의 일부임이 감사 필터에 일관되게 잡히도록.
      INSERT INTO booking_reservations
        (id, slot_id, program_id, student_id, booked_by, booked_by_role, is_override, override_reason)
      VALUES
        (v_id, slot.id, slot.program_id, v_sid, p_actor_id, p_actor_role,
         p_override, CASE WHEN p_override THEN p_reason END);

      v_msg := '[' || prog.name || '] ' || to_char(slot.date, 'MM/DD') || ' '
               || to_char(slot.start_time, 'HH24:MI') || ' 그룹상담에 배정되었습니다.';
      PERFORM _booking_notify_parties(v_sid, NULL, 'group_assigned', v_id, slot.id, v_msg);
      v_results := v_results || jsonb_build_object('student_id', v_sid, 'code', 'OK',
                                                   'reservation_id', v_id);
    ELSE
      v_results := v_results || jsonb_build_object('student_id', v_sid, 'code', v_code);
    END IF;
  END LOOP;

  PERFORM _booking_audit('slot', slot.id, 'group_assign', p_actor_id, p_actor_role,
    p_reason, p_override, NULL,
    jsonb_build_object('student_ids', to_jsonb(v_sorted), 'results', v_results));

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'results', v_results);
END $$;

-- ================================================================
-- RPC — 출결 처리 (명세 13). 자동 참석 처리는 어디에도 없다.
-- ================================================================
CREATE OR REPLACE FUNCTION booking_set_attendance(
  p_reservation_id TEXT, p_status TEXT, p_actor_id TEXT, p_actor_role TEXT,
  p_note TEXT DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  res      booking_reservations%ROWTYPE;
  slot     booking_slots%ROWTYPE;
  kst_date DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_overdue BOOLEAN;
  v_before  jsonb;
BEGIN
  IF p_actor_role IN ('student', 'parent') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF p_status NOT IN ('pending', 'attended', 'absent',
                      'student_cancel', 'educator_cancel', 'center_cancel', 'rescheduled') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;

  SELECT * INTO res FROM booking_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF res.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  SELECT * INTO slot FROM booking_slots WHERE id = res.slot_id;

  IF p_actor_role <> 'admin'
     AND (slot.educator_id IS NULL OR slot.educator_id <> p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  -- 취소·변경된 예약의 출결은 관리자만 정정 가능
  IF res.status <> 'confirmed' AND p_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_CANCELLED');
  END IF;

  -- 처리기한: 상담일 다음 날 23:59:59 (명세 13.2). 초과해도 입력은 허용하되 이력을 남긴다.
  v_overdue := kst_date > slot.date + 1;
  v_before  := to_jsonb(res);

  UPDATE booking_reservations
     SET attendance_status = p_status,
         attendance_marked_by = p_actor_id,
         attendance_marked_at = now(),
         attendance_overdue = attendance_overdue OR v_overdue,
         attendance_note = COALESCE(p_note, attendance_note)
   WHERE id = res.id
   RETURNING * INTO res;

  PERFORM _booking_audit('reservation', res.id,
    CASE WHEN v_overdue THEN 'attendance_overdue' ELSE 'attendance' END,
    p_actor_id, p_actor_role, p_note, FALSE, v_before, to_jsonb(res));

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'reservation', to_jsonb(res));
END $$;

-- ================================================================
-- RPC — 슬롯 편집·삭제 (명세 10). RPC 경유를 강제하는 이유:
--       예약 있는 슬롯의 변경은 사유·감사·영향자 알림이 한 트랜잭션이어야 한다.
-- ================================================================
CREATE OR REPLACE FUNCTION booking_update_slot(
  p_slot_id TEXT, p_patch JSONB, p_actor_id TEXT, p_actor_role TEXT,
  p_reason TEXT DEFAULT NULL, p_delete BOOLEAN DEFAULT FALSE,
  p_override BOOLEAN DEFAULT FALSE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  slot      booking_slots%ROWTYPE;
  prog      booking_programs%ROWTYPE;
  v_booked  INT;
  v_before  jsonb;
  v_new_date  DATE;
  v_new_start TIME;
  v_new_end   TIME;
  v_new_cap   INT;
  v_new_status TEXT;
  v_time_changed BOOLEAN;
  v_msg     TEXT;
  r         RECORD;
BEGIN
  IF p_actor_role IN ('student', 'parent') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF p_override AND p_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  SELECT * INTO slot FROM booking_slots WHERE id = p_slot_id FOR UPDATE;
  IF slot.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;
  SELECT * INTO prog FROM booking_programs WHERE id = slot.program_id;

  -- 강사는 자기 슬롯만 (명세 3.3)
  IF p_actor_role <> 'admin'
     AND (slot.educator_id IS NULL OR slot.educator_id <> p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  SELECT count(*) INTO v_booked FROM booking_reservations
  WHERE slot_id = slot.id AND status = 'confirmed';
  v_before := to_jsonb(slot);

  -- 삭제: 예약 없는 슬롯만 (명세 10.2). 예약 있으면 운영취소(status='cancelled')로.
  IF p_delete THEN
    IF v_booked > 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'HAS_RESERVATIONS');
    END IF;
    DELETE FROM booking_slots WHERE id = slot.id;
    PERFORM _booking_audit('slot', slot.id, 'delete', p_actor_id, p_actor_role,
      p_reason, FALSE, v_before, NULL);
    RETURN jsonb_build_object('ok', true, 'code', 'OK');
  END IF;

  v_new_date   := COALESCE((p_patch->>'date')::date, slot.date);
  v_new_start  := COALESCE((p_patch->>'start_time')::time, slot.start_time);
  v_new_end    := COALESCE((p_patch->>'end_time')::time, slot.end_time);
  v_new_cap    := COALESCE((p_patch->>'capacity')::int, slot.capacity);
  v_new_status := COALESCE(p_patch->>'status', slot.status);

  IF v_new_end <= v_new_start THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;
  IF v_new_status NOT IN ('draft', 'reviewed', 'open', 'closed', 'done', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;
  IF v_new_cap < v_booked THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CAPACITY_BELOW_BOOKED');
  END IF;

  v_time_changed := v_new_date <> slot.date
                    OR v_new_start <> slot.start_time OR v_new_end <> slot.end_time;

  IF v_booked > 0 THEN
    -- 예약 있는 슬롯: 변경 사유 필수 (명세 10.3)
    IF COALESCE(trim(p_reason), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
    END IF;
    -- 시간 이동 시 예약 학생들의 다른 예약과 겹치면 일반 강사는 불가, 관리자는 예외 처리
    IF v_time_changed AND NOT p_override THEN
      IF EXISTS (
        SELECT 1
        FROM booking_reservations mine
        JOIN booking_reservations other ON other.student_id = mine.student_id
         AND other.status = 'confirmed' AND other.slot_id <> slot.id
        JOIN booking_slots os ON os.id = other.slot_id
        WHERE mine.slot_id = slot.id AND mine.status = 'confirmed'
          AND os.date = v_new_date
          AND os.start_time < v_new_end AND os.end_time > v_new_start
      ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'OVERLAP');
      END IF;
    END IF;
  END IF;

  UPDATE booking_slots
     SET date        = v_new_date,
         start_time  = v_new_start,
         end_time    = v_new_end,
         capacity    = v_new_cap,
         status      = v_new_status,
         is_public   = COALESCE((p_patch->>'is_public')::boolean, is_public),
         note        = COALESCE(p_patch->>'note', note),
         subject_id  = CASE WHEN p_patch ? 'subject_id'
                            THEN NULLIF(p_patch->>'subject_id', '') ELSE subject_id END,
         educator_id = CASE WHEN p_patch ? 'educator_id'
                            THEN NULLIF(p_patch->>'educator_id', '') ELSE educator_id END
   WHERE id = slot.id
   RETURNING * INTO slot;

  PERFORM _booking_audit('slot', slot.id, 'slot_edit', p_actor_id, p_actor_role,
    p_reason, p_override, v_before, to_jsonb(slot));

  IF v_booked > 0 THEN
    IF v_new_status = 'cancelled' THEN
      -- 운영취소: 확정 예약 전건을 센터 사유 취소로 전환 + 알림 (명세 12 운영취소)
      FOR r IN SELECT * FROM booking_reservations
               WHERE slot_id = slot.id AND status = 'confirmed' LOOP
        UPDATE booking_reservations
           SET status = 'cancelled',
               cancelled_by = p_actor_id, cancelled_by_role = p_actor_role,
               cancel_reason = p_reason, cancelled_at = now(),
               attendance_status = 'center_cancel',
               attendance_marked_by = p_actor_id, attendance_marked_at = now()
         WHERE id = r.id;
        v_msg := '[' || prog.name || '] ' || to_char(slot.date, 'MM/DD') || ' '
                 || to_char(slot.start_time, 'HH24:MI')
                 || ' 상담이 운영 사정으로 취소되었습니다. (사유: ' || COALESCE(p_reason, '') || ')';
        PERFORM _booking_notify_parties(r.student_id, NULL, 'cancelled', r.id, slot.id, v_msg);
      END LOOP;
    ELSIF v_time_changed OR (p_patch ? 'educator_id') THEN
      v_msg := '[' || prog.name || '] ' || to_char((v_before->>'date')::date, 'MM/DD') || ' 예약 슬롯이 '
               || to_char(slot.date, 'MM/DD') || ' ' || to_char(slot.start_time, 'HH24:MI')
               || ' 으로 변경되었습니다. (사유: ' || COALESCE(p_reason, '') || ')';
      FOR r IN SELECT * FROM booking_reservations
               WHERE slot_id = slot.id AND status = 'confirmed' LOOP
        PERFORM _booking_notify_parties(r.student_id, NULL, 'slot_changed', r.id, slot.id, v_msg);
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'slot', to_jsonb(slot));
END $$;

-- ================================================================
-- RPC — 슬롯 일괄 상태 전환 (관리자: 작성중→검토완료→예약공개 등 — 명세 5.4)
--       'cancelled' 전환은 예약 처리·알림이 필요하므로 booking_update_slot으로만.
-- ================================================================
CREATE OR REPLACE FUNCTION booking_set_slot_status(
  p_slot_ids TEXT[], p_status TEXT, p_actor_id TEXT, p_actor_role TEXT
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF p_status NOT IN ('draft', 'reviewed', 'open', 'closed', 'done') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;

  UPDATE booking_slots SET status = p_status
   WHERE id = ANY(p_slot_ids) AND status <> 'cancelled';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM _booking_audit('slot', 'bulk', 'status_change', p_actor_id, p_actor_role,
    NULL, FALSE, NULL,
    jsonb_build_object('slot_ids', to_jsonb(p_slot_ids), 'status', p_status, 'count', v_count));

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'count', v_count);
END $$;

-- ================================================================
-- 일일 다이제스트 — pg_cron 이 매일 KST 00:05 실행 (명세 13.4·17)
--   전일 출결 미처리 임박·초과, 상담기록 기한 임박·초과 알림.
--   NOT EXISTS 로 수신자·유형·예약당 1회만 (멱등).
-- ================================================================
CREATE OR REPLACE FUNCTION booking_daily_digest()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_date DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  r RECORD;
BEGIN
  -- 1) 출결 미처리: 상담일이 지났는데 pending — 어제 상담분은 '오늘 자정까지' 임박,
  --    그제 이전 상담분은 기한 초과 (담당 강사 + 관리자 전원)
  FOR r IN
    SELECT res.id, res.student_id, s.educator_id, s.date, s.start_time,
           p.name AS program_name, u.name AS student_name,
           (s.date <= kst_date - 2) AS overdue
    FROM booking_reservations res
    JOIN booking_slots s ON s.id = res.slot_id
    JOIN booking_programs p ON p.id = res.program_id
    JOIN users u ON u.id = res.student_id
    WHERE res.status = 'confirmed' AND res.attendance_status = 'pending'
      AND s.date < kst_date
  LOOP
    DECLARE
      v_type TEXT := CASE WHEN r.overdue THEN 'attendance_overdue' ELSE 'attendance_pending' END;
      v_msg  TEXT := '[' || r.program_name || '] ' || to_char(r.date, 'MM/DD') || ' '
                     || r.student_name || ' 출결이 미처리 상태입니다.'
                     || CASE WHEN r.overdue THEN ' (처리기한 초과)' ELSE ' (오늘 자정까지)' END;
      v_admin RECORD;
    BEGIN
      IF r.educator_id IS NOT NULL THEN
        PERFORM _booking_notify_once(r.educator_id, v_type, r.id, v_msg);
      END IF;
      IF r.overdue THEN
        FOR v_admin IN SELECT id FROM users WHERE role = 'admin' AND status = 'active' LOOP
          PERFORM _booking_notify_once(v_admin.id, v_type, r.id, v_msg);
        END LOOP;
      END IF;
    END;
  END LOOP;

  -- 2) 상담기록: 참석 처리됐는데 작성 완료가 아닌 건.
  --    작성기한 = 상담일 + 7일 23:59:59. 기한이 오늘·내일이면 임박, 지났으면 초과.
  FOR r IN
    SELECT res.id, s.educator_id, s.date,
           p.name AS program_name, u.name AS student_name,
           (s.date + 7 < kst_date) AS overdue
    FROM booking_reservations res
    JOIN booking_slots s ON s.id = res.slot_id
    JOIN booking_programs p ON p.id = res.program_id
    JOIN users u ON u.id = res.student_id
    WHERE res.attendance_status = 'attended'
      AND NOT EXISTS (
        SELECT 1 FROM booking_records br
        WHERE br.reservation_id = res.id AND br.status = 'done'
      )
      AND s.date + 7 <= kst_date + 1
  LOOP
    DECLARE
      v_type TEXT := CASE WHEN r.overdue THEN 'record_overdue' ELSE 'record_due' END;
      v_msg  TEXT := '[' || r.program_name || '] ' || to_char(r.date, 'MM/DD') || ' '
                     || r.student_name || ' 상담기록이 미작성 상태입니다.'
                     || CASE WHEN r.overdue THEN ' (작성기한 초과)'
                        ELSE ' (기한: ' || to_char(r.date + 7, 'MM/DD') || ')' END;
      v_admin RECORD;
    BEGIN
      IF r.educator_id IS NOT NULL THEN
        PERFORM _booking_notify_once(r.educator_id, v_type, r.id, v_msg);
      END IF;
      IF r.overdue THEN
        FOR v_admin IN SELECT id FROM users WHERE role = 'admin' AND status = 'active' LOOP
          PERFORM _booking_notify_once(v_admin.id, v_type, r.id, v_msg);
        END LOOP;
      END IF;
    END;
  END LOOP;

  -- 3) 강사 당일 상담 일정 알림 (명세 17.2) — 강사·날짜당 1회
  FOR r IN
    SELECT s.educator_id, count(*) AS cnt
    FROM booking_reservations res
    JOIN booking_slots s ON s.id = res.slot_id
    WHERE res.status = 'confirmed' AND s.date = kst_date AND s.educator_id IS NOT NULL
    GROUP BY s.educator_id
  LOOP
    PERFORM _booking_notify_once(r.educator_id, 'today_schedule', 'today-' || kst_date,
      '오늘 예약된 상담이 ' || r.cnt || '건 있습니다. 타임테이블을 확인해 주세요.');
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- 기본 프로그램 시드 (명세 2장 초기 3종 — 관리자 화면에서 수정 가능, 멱등)
-- ----------------------------------------------------------------
INSERT INTO booking_programs
  (id, name, slot_minutes, default_capacity, daily_limit, daily_limit_scope,
   allow_consecutive, allow_group, uses_subject, requires_open_period,
   change_deadline_type, change_deadline_value, sort_order)
VALUES
  ('bkp-career',   '진로진학 컨설팅',   40, 1, 1, 'program_educator', TRUE,  FALSE, FALSE, TRUE,  'days_before',    2,  1),
  ('bkp-subject',  '교과 컨설팅',       20, 1, 2, 'program_subject',  TRUE,  TRUE,  TRUE,  FALSE, 'minutes_before', 60, 2),
  ('bkp-coaching', '자기주도학습 코칭', 20, 1, 2, 'program',          FALSE, FALSE, FALSE, FALSE, 'minutes_before', 60, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO booking_subjects (id, program_id, name, sort_order) VALUES
  ('bksj-kor', 'bkp-subject', '국어', 1),
  ('bksj-eng', 'bkp-subject', '영어', 2),
  ('bksj-math', 'bkp-subject', '수학', 3)
ON CONFLICT (program_id, name) DO NOTHING;

-- ----------------------------------------------------------------
-- RLS — 새 테이블은 RLS 기본 활성화라 anon 정책이 없으면 침묵 실패한다 (관례)
-- ----------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'booking_programs', 'booking_subjects', 'booking_educators', 'booking_open_periods',
    'booking_timetable_batches', 'booking_slots', 'booking_reservations',
    'booking_records', 'booking_notifications', 'booking_audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "anon_all" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- pg_cron — 일일 다이제스트. KST 00:05 = UTC 15:05.
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('booking-daily-digest');
EXCEPTION WHEN OTHERS THEN NULL;  -- 최초 실행 시 잡이 없으면 무시
END $$;

SELECT cron.schedule('booking-daily-digest', '5 15 * * *', 'SELECT booking_daily_digest()');
