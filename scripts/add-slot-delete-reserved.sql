-- ================================================================
-- 예약 있는 슬롯 삭제 (2026-08-02 클라이언트: 강사지정예약 슬롯이 편집만 되고
-- 삭제가 안 되던 문제) — booking_update_slot의 p_delete 경로 확장.
--
-- 기존: 확정 예약이 있으면 HAS_RESERVATIONS 거부 (명세 10.2). 강사지정예약은
--       생성 즉시 확정 예약이 붙으므로 삭제가 원천 불가였다.
-- 변경: p_delete 시 ①확정 예약이 있으면 사유 필수 — 전건을 센터 사유 취소
--       (attendance center_cancel) + 학생·학부모 알림(운영취소와 동일 처리).
--       ②예약 이력 행이 하나라도 남아 있으면 FK(booking_reservations.slot_id
--       RESTRICT) 때문에 물리 삭제 대신 운영취소(status='cancelled') 전환.
--       ③이력이 전혀 없는 슬롯만 종전대로 물리 DELETE.
--   부수 수정: 종전에는 취소된 예약 이력만 남은 슬롯(전원 학생취소 등)을
--   삭제하면 FK 위반으로 RPC가 예외 크래시했다 — ②가 이 잠재 버그도 해소.
--
-- CREATE OR REPLACE 멱등 — 재실행 안전. 원본: add-booking-system.sql
-- (delete 분기 외 로직 무변경, 구 프런트와 호환: 구 UI는 예약 있는 슬롯에
-- del을 보내지 않는다).
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

  -- 삭제 (명세 10.2 확장 2026-08-02): 확정 예약이 있으면 사유 필수 —
  -- 전건 센터 사유 취소 + 알림 후, 예약 이력이 남은 슬롯은 물리 삭제 대신
  -- 운영취소 전환(soft), 이력 없는 슬롯만 물리 DELETE.
  IF p_delete THEN
    IF v_booked > 0 AND COALESCE(trim(p_reason), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
    END IF;
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
    IF EXISTS (SELECT 1 FROM booking_reservations WHERE slot_id = slot.id) THEN
      UPDATE booking_slots SET status = 'cancelled' WHERE id = slot.id
      RETURNING * INTO slot;
      PERFORM _booking_audit('slot', slot.id, 'delete', p_actor_id, p_actor_role,
        p_reason, FALSE, v_before, to_jsonb(slot));
      RETURN jsonb_build_object('ok', true, 'code', 'OK', 'soft', true);
    END IF;
    DELETE FROM booking_slots WHERE id = slot.id;
    PERFORM _booking_audit('slot', slot.id, 'delete', p_actor_id, p_actor_role,
      p_reason, FALSE, v_before, NULL);
    RETURN jsonb_build_object('ok', true, 'code', 'OK', 'soft', false);
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
