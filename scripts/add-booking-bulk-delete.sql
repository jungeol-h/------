-- ================================================================
-- 슬롯 일괄 삭제 (2026-09-30 클라이언트: "타임테이블에서 예약 가능 시간을 못 연다 —
-- 날짜 및 슬롯 삭제 기능")
--
-- 배경: 슬롯 생성은 같은 강사의 기존 슬롯(운영종료·예약마감·자동 파생 포함)과
--   겹치면 만들어지지 않는데, 기존 슬롯을 치울 수단이 1개씩 삭제뿐이었다.
--   관리자가 남은 슬롯을 '운영종료'로 바꿔 치우려 해도 계속 막혔다(실DB 확인).
--
-- booking_delete_slots: 선택한 슬롯(날짜 단위 선택 포함)을 한 트랜잭션으로 삭제.
--   슬롯별 처리는 기존 booking_update_slot(p_delete) 를 그대로 호출한다 —
--   권한·확정 예약 센터 사유 취소·학생/학부모 알림·감사·soft/hard 분기 재사용.
--   추가 규칙:
--   ① 이미 시작한(과거) 슬롯에 확정 예약이 있으면 건너뛴다(PAST_HAS_RESERVATIONS) —
--      일괄 삭제가 지난 상담의 참석 이력을 '센터 사유 취소'로 뒤엎지 않게.
--   ② 남은 대상에 확정 예약이 있는데 사유가 없으면 아무것도 하지 않고 REASON_REQUIRED.
--   ③ 비관리자가 남의 슬롯을 섞어 보내면 전체 FORBIDDEN.
--   ④ 매주 반복 규칙이 만든 슬롯을 지워 그 규칙의 그 날짜 슬롯이 하나도 안 남으면
--      규칙 exclude_dates 에 그 날짜를 넣는다 — 규칙을 다시 저장해도 되살아나지 않게.
--      (그날 슬롯 일부만 지운 경우는 휴무일로 표현할 수 없어 규칙 재저장 시 재생성될 수 있다.)
--
-- 반환: { ok, code, deleted, soft, cancelled_reservations, excluded:[{rule_id,date}],
--         skipped:[{id,code}] }
-- 신규 함수만 추가 — 구 프런트와 무관. CREATE OR REPLACE 멱등.
-- 선행: add-slot-delete-reserved.sql, add-booking-availability.sql
-- ================================================================

CREATE OR REPLACE FUNCTION booking_delete_slots(
  p_slot_ids TEXT[], p_actor_id TEXT, p_actor_role TEXT,
  p_reason TEXT DEFAULT NULL, p_exclude_rule_dates BOOLEAN DEFAULT TRUE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  kst_now   TIMESTAMP := now() AT TIME ZONE 'Asia/Seoul';
  kst_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  s         booking_slots%ROWTYPE;
  v_booked  INT;
  v_id      TEXT;
  v_res     jsonb;
  v_pair    RECORD;
  v_targets TEXT[] := '{}';
  v_pairs   jsonb := '[]'::jsonb;   -- 삭제 대상 중 규칙 파생·미래 슬롯의 (rule_id, date)
  v_skipped jsonb := '[]'::jsonb;
  v_excluded jsonb := '[]'::jsonb;
  v_need_reason BOOLEAN := FALSE;
  v_deleted INT := 0;
  v_soft    INT := 0;
  v_cancelled INT := 0;
BEGIN
  IF p_actor_role IN ('student', 'parent') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF p_slot_ids IS NULL OR array_length(p_slot_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID');
  END IF;

  -- 1) 잠금(id 순 — 교착 방지) + 분류. 여기서는 아무것도 바꾸지 않는다.
  FOR s IN SELECT * FROM booking_slots WHERE id = ANY (p_slot_ids) ORDER BY id FOR UPDATE LOOP
    IF p_actor_role <> 'admin'
       AND (s.educator_id IS NULL OR s.educator_id <> p_actor_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    END IF;
    IF s.status = 'cancelled' THEN
      v_skipped := v_skipped || jsonb_build_object('id', s.id, 'code', 'ALREADY_CANCELLED');
      CONTINUE;
    END IF;
    SELECT count(*) INTO v_booked FROM booking_reservations
    WHERE slot_id = s.id AND status = 'confirmed';
    IF v_booked > 0 AND (s.date + s.start_time) <= kst_now THEN
      v_skipped := v_skipped || jsonb_build_object('id', s.id, 'code', 'PAST_HAS_RESERVATIONS');
      CONTINUE;
    END IF;
    IF v_booked > 0 THEN
      v_need_reason := TRUE;
      v_cancelled := v_cancelled + v_booked;
    END IF;
    IF s.rule_id IS NOT NULL AND s.date > kst_today THEN
      v_pairs := v_pairs || jsonb_build_object('rule_id', s.rule_id, 'date', s.date);
    END IF;
    v_targets := v_targets || s.id;
  END LOOP;

  IF v_need_reason AND COALESCE(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
      'cancelled_reservations', v_cancelled);
  END IF;

  -- 2) 슬롯별 삭제 — 기존 단건 경로 재사용
  FOREACH v_id IN ARRAY v_targets LOOP
    v_res := booking_update_slot(
      p_slot_id => v_id, p_patch => '{}'::jsonb,
      p_actor_id => p_actor_id, p_actor_role => p_actor_role,
      p_reason => p_reason, p_delete => TRUE);
    IF (v_res->>'ok')::boolean THEN
      IF (v_res->>'soft')::boolean THEN v_soft := v_soft + 1; ELSE v_deleted := v_deleted + 1; END IF;
    ELSE
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'code', v_res->>'code');
    END IF;
  END LOOP;

  -- 3) 규칙 파생 슬롯이 그 날짜에 하나도 안 남았으면 휴무일로 등록 (재생성 방지)
  IF p_exclude_rule_dates THEN
    FOR v_pair IN
      SELECT DISTINCT x->>'rule_id' AS rule_id, (x->>'date')::date AS date
      FROM jsonb_array_elements(v_pairs) x
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM booking_slots
        WHERE rule_id = v_pair.rule_id AND date = v_pair.date AND status <> 'cancelled'
      ) THEN
        UPDATE booking_availability_rules
           SET exclude_dates = array_append(COALESCE(exclude_dates, '{}'), v_pair.date)
         WHERE id = v_pair.rule_id
           AND NOT (v_pair.date = ANY (COALESCE(exclude_dates, '{}')));
        IF FOUND THEN
          v_excluded := v_excluded
            || jsonb_build_object('rule_id', v_pair.rule_id, 'date', v_pair.date);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 4) 요약 감사 1행 (슬롯별 'delete' 감사는 단건 경로가 이미 남긴다)
  PERFORM _booking_audit('slot', 'bulk', 'bulk_delete', p_actor_id, p_actor_role, p_reason, FALSE,
    NULL, jsonb_build_object(
      'requested', array_length(p_slot_ids, 1), 'deleted', v_deleted, 'soft', v_soft,
      'cancelled_reservations', v_cancelled, 'excluded', v_excluded, 'skipped', v_skipped));

  RETURN jsonb_build_object('ok', true, 'code', 'OK',
    'deleted', v_deleted, 'soft', v_soft, 'cancelled_reservations', v_cancelled,
    'excluded', v_excluded, 'skipped', v_skipped);
END $$;
