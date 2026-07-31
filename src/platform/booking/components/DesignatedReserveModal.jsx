// 강사지정예약 (2026-07-30 클라이언트 요청) — 강사가 학생·날짜·시간을 지정해
// 예약을 미리 고정한다. 매주 반복(종료일자)으로 주기 예약도 한 번에 건다.
// 2026-07-31 확장: 학생 다중 선택(최대 10명) + 시작~종료 시간 자유 지정(최대 100분).
//
// 구현: 회차마다 "비공개 슬롯(정원 = 선택 학생 수) + 학생별 확정 예약"을 생성한다.
// 지정 슬롯도 강사의 슬롯이므로 타임테이블이 그 시간대를 비켜간다:
//  - 가용시간 규칙 파생(SQL _booking_generate_rule_slots)은 같은 강사의 기존 슬롯과
//    겹치는 시간을 건너뛴다 (기존 동작).
//  - 타임테이블 일괄 생성(TimetableWizard)은 generateSlots의 blocked 파라미터로
//    같은 강사의 기존 슬롯과 겹치는 슬롯을 만들지 않는다.
// 강사 본인 슬롯과 겹치는 회차는 미리보기에서 표시하고 건너뛴다. 학생 쪽 겹침·
// 하루 횟수 제한은 RPC(booking_reserve)가 학생별로 최종 판정하며, 회차의 전원이
// 거절된 경우에만 만들었던 슬롯을 되물린다(삭제).

import { useMemo, useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import TimeField from '../../components/common/TimeField.jsx'
import MultiStudentSelect from '../../components/common/MultiStudentSelect.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useBooking } from '../BookingContext.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { addDaysStr, minutesToTime, overlaps, timeToMinutes } from '../bookingRules.js'
import { createSlot, rpcReserve, rpcUpdateSlot } from '../bookingApi.js'
import { bookingMessage } from '../bookingMessages.js'
import { isActiveStudent } from '../../data/studentStatus.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'
const MAX_OCCURRENCES = 26 // 반복 상한 (약 6개월) — 무한 실체화 방지
const MAX_STUDENTS = 10 // 클라이언트 요청 상한
const MAX_MINUTES = 100 // 회차당 최대 시간

export default function DesignatedReserveModal({ educatorId, programs, onClose }) {
  const { data } = useData()
  const { config, slots, actor, refetch } = useBooking()

  const students = useMemo(
    () => (data.students ?? []).filter(isActiveStudent),
    [data.students],
  )

  const [studentIds, setStudentIds] = useState([])
  const [programId, setProgramId] = useState(programs[0]?.id ?? '')
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState(() =>
    minutesToTime(timeToMinutes('16:00') + (programs[0]?.slotMinutes ?? 20)))
  const [repeat, setRepeat] = useState(false)
  const [repeatUntil, setRepeatUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [failures, setFailures] = useState(null) // [{ date, studentId, code }]

  const program = programs.find((p) => p.id === programId)
  const subjectOptions = config.subjects.filter((s) => s.programId === programId && s.active)

  const duration = startTime && endTime
    ? timeToMinutes(endTime) - timeToMinutes(startTime)
    : 0
  const durationValid = duration > 0 && duration <= MAX_MINUTES

  // 시작 시간을 바꾸면 기존 소요시간을 유지한 채 종료 시간을 따라 옮긴다
  const changeStart = (v) => {
    setStartTime(v)
    if (v && durationValid) setEndTime(minutesToTime(timeToMinutes(v) + duration))
  }
  // 프로그램을 바꾸면 종료 시간을 그 프로그램 기본 슬롯 길이로 재설정한다
  const changeProgram = (id) => {
    setProgramId(id)
    setSubjectId('')
    const next = programs.find((p) => p.id === id)
    if (startTime && next) setEndTime(minutesToTime(timeToMinutes(startTime) + next.slotMinutes))
  }

  // 회차 전개 — 매주 반복이면 종료일자까지 7일 간격 (상한 MAX_OCCURRENCES)
  const occurrences = useMemo(() => {
    if (!date || !startTime || !endTime || !durationValid) return []
    const dates = [date]
    if (repeat && repeatUntil > date) {
      let d = addDaysStr(date, 7)
      while (d <= repeatUntil && dates.length < MAX_OCCURRENCES) {
        dates.push(d)
        d = addDaysStr(d, 7)
      }
    }
    return dates.map((d) => ({
      date: d,
      // 강사 본인의 기존 슬롯(취소 제외)과 겹치면 생성하지 않는다
      conflict: slots.some((s) =>
        s.educatorId === educatorId && s.date === d && s.status !== 'cancelled' &&
        overlaps(startTime, endTime, s.startTime, s.endTime)),
    }))
  }, [date, startTime, endTime, durationValid, repeat, repeatUntil, slots, educatorId])

  const creatable = occurrences.filter((o) => !o.conflict)

  const submit = async () => {
    if (busy) return
    if (studentIds.length === 0) { setError('학생을 선택해 주세요.'); return }
    if (!program || !date || !startTime) { setError('날짜와 시작 시간을 입력해 주세요.'); return }
    if (!durationValid) { setError(`종료 시간을 확인해 주세요. 시작 이후 최대 ${MAX_MINUTES}분까지 가능합니다.`); return }
    if (repeat && !(repeatUntil > date)) { setError('반복 종료일자를 첫 상담일 이후로 입력해 주세요.'); return }
    if (creatable.length === 0) { setError('생성할 수 있는 회차가 없습니다. 시간대를 확인해 주세요.'); return }
    setBusy(true)
    setError(null)
    setFailures(null)
    try {
      const fails = []
      for (const o of creatable) {
        const slot = await createSlot({
          programId: program.id,
          educatorId,
          subjectId: program.usesSubject ? (subjectId || null) : null,
          date: o.date,
          startTime,
          endTime,
          capacity: studentIds.length,
          status: 'open',
          isPublic: false, // 지정 예약 — 학생 예약 화면에 노출하지 않는다
          note: '강사지정',
        }, actor)
        let okCount = 0
        for (const sid of studentIds) {
          const result = await rpcReserve({
            slotId: slot.id, studentId: sid,
            actorId: actor.id, actorRole: actor.role,
          })
          if (result?.ok) okCount += 1
          else fails.push({ date: o.date, studentId: sid, code: result?.code ?? 'ERROR' })
        }
        if (okCount === 0) {
          // 전원 거절된 회차는 빈 지정 슬롯이 남지 않게 되물린다
          await rpcUpdateSlot({
            slotId: slot.id, del: true,
            actorId: actor.id, actorRole: actor.role,
            reason: '강사지정예약 실패 회차 정리',
          })
        }
      }
      await refetch()
      if (fails.length === 0) onClose()
      else setFailures(fails)
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const studentName = (id) => students.find((s) => s.id === id)?.name ?? id

  return (
    <ModalShell title="강사지정예약" onClose={onClose} maxWidth="max-w-xl">
      <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
        학생·날짜·시간을 지정해 예약을 고정합니다. 학생은 최대 {MAX_STUDENTS}명까지
        함께 지정할 수 있고, 시간은 시작~종료로 최대 {MAX_MINUTES}분까지 가능해요.
        지정된 시간대에는 타임테이블 생성 시 예약 가능 시간이 만들어지지 않으며,
        매주 반복을 켜면 종료일자까지 같은 요일·시간으로 반복 예약됩니다.
      </p>

      {/* 대리예약(ReservationSearch)과 같은 다중선택 관용구 — 선택 후에도 검색창 유지 */}
      <MultiStudentSelect
        students={students}
        value={studentIds}
        onChange={setStudentIds}
        max={MAX_STUDENTS}
        label="학생"
        placeholder="학생 검색해서 추가..."
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 col-span-2">
          프로그램
          <select
            value={programId}
            onChange={(e) => changeProgram(e.target.value)}
            className={`${FIELD} w-full mt-1`}
          >
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slotMinutes}분)</option>)}
          </select>
        </label>
        {program?.usesSubject && (
          <label className="text-xs text-gray-500 col-span-2">
            교과
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={`${FIELD} w-full mt-1`}>
              <option value="">미지정</option>
              {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs text-gray-500 col-span-2">
          첫 상담일
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          시작 시간
          <TimeField value={startTime} onChange={changeStart} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          종료 시간 (최대 {MAX_MINUTES}분)
          <TimeField value={endTime} onChange={setEndTime} className={`${FIELD} w-full mt-1`} />
        </label>
        {startTime && endTime && (
          <p className={`col-span-2 text-xs ${durationValid ? 'text-gray-500' : 'text-red-500'}`}>
            {durationValid
              ? `회차당 ${duration}분 (${startTime}~${endTime})`
              : duration <= 0
                ? '종료 시간이 시작 시간보다 늦어야 합니다.'
                : `최대 ${MAX_MINUTES}분까지 지정할 수 있습니다. (현재 ${duration}분)`}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          매주 반복 (같은 요일·시간)
        </label>
        {repeat && (
          <label className="text-xs text-gray-500 block">
            반복 종료일자
            <input
              type="date"
              value={repeatUntil}
              min={date}
              onChange={(e) => setRepeatUntil(e.target.value)}
              className={`${FIELD} w-full mt-1`}
            />
          </label>
        )}
      </div>

      {occurrences.length > 0 && startTime && (
        <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          <p>
            <b>{creatable.length}회</b>
            {studentIds.length > 1 && <> × <b>{studentIds.length}명</b></>}
            {' '}예약됩니다 ({startTime}~{endTime})
            {occurrences.some((o) => o.conflict) && ' — 겹치는 회차는 건너뜁니다'}
          </p>
          <div className="flex flex-wrap gap-1">
            {occurrences.map((o) => (
              <span
                key={o.date}
                className={`px-1.5 py-0.5 rounded ${o.conflict ? 'bg-red-50 text-red-400 line-through' : 'bg-white text-gray-600'}`}
                title={o.conflict ? '내 기존 슬롯과 겹쳐 건너뜁니다' : undefined}
              >
                {o.date.slice(5)}
              </span>
            ))}
          </div>
        </div>
      )}

      {failures && (
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 space-y-1">
          <p className="text-xs font-bold text-orange-600">일부 예약은 완료하지 못했습니다 (나머지는 예약 완료):</p>
          {failures.map((f) => (
            <p key={`${f.date}-${f.studentId}`} className="text-xs text-orange-600">
              {f.date} {studentName(f.studentId)} — {bookingMessage(f.code, { program })}
            </p>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || studentIds.length === 0 || creatable.length === 0}
        className="w-full h-12 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50"
      >
        {busy
          ? '처리 중...'
          : `지정 예약 확정 (${creatable.length}회${studentIds.length > 1 ? ` × ${studentIds.length}명` : ''})`}
      </button>
    </ModalShell>
  )
}
