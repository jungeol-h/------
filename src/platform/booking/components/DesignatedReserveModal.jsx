// 강사지정예약 (2026-07-30 클라이언트 요청) — 강사가 학생·날짜·시간을 지정해
// 예약을 미리 고정한다. 매주 반복(종료일자)으로 주기 예약도 한 번에 건다.
//
// 구현: 회차마다 "비공개 슬롯(정원 1) + 확정 예약"을 생성한다. 지정 슬롯도 강사의
// 슬롯이므로 타임테이블이 그 시간대를 비켜간다:
//  - 가용시간 규칙 파생(SQL _booking_generate_rule_slots)은 같은 강사의 기존 슬롯과
//    겹치는 시간을 건너뛴다 (기존 동작).
//  - 타임테이블 일괄 생성(TimetableWizard)은 generateSlots의 blocked 파라미터로
//    같은 강사의 기존 슬롯과 겹치는 슬롯을 만들지 않는다.
// 강사 본인 슬롯과 겹치는 회차는 미리보기에서 표시하고 건너뛴다. 학생 쪽 겹침·
// 하루 횟수 제한은 RPC(booking_reserve)가 최종 판정하며, 실패한 회차는 만들었던
// 슬롯을 되물리고(삭제) 사유를 표시한다.

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import ModalShell from '../../components/common/ModalShell.jsx'
import TimeField from '../../components/common/TimeField.jsx'
import StudentCombobox from '../../components/counseling/StudentCombobox.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useBooking } from '../BookingContext.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { addDaysStr, minutesToTime, overlaps, timeToMinutes } from '../bookingRules.js'
import { createSlot, rpcReserve, rpcUpdateSlot } from '../bookingApi.js'
import { bookingMessage } from '../bookingMessages.js'
import { isActiveStudent } from '../../data/studentStatus.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'
const MAX_OCCURRENCES = 26 // 반복 상한 (약 6개월) — 무한 실체화 방지

export default function DesignatedReserveModal({ educatorId, programs, onClose }) {
  const { data } = useData()
  const { config, slots, actor, refetch } = useBooking()

  const students = useMemo(
    () => (data.students ?? []).filter(isActiveStudent),
    [data.students],
  )

  const [studentId, setStudentId] = useState('')
  const [programId, setProgramId] = useState(programs[0]?.id ?? '')
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [startTime, setStartTime] = useState('16:00')
  const [repeat, setRepeat] = useState(false)
  const [repeatUntil, setRepeatUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [failures, setFailures] = useState(null) // [{ date, code }]

  const program = programs.find((p) => p.id === programId)
  const subjectOptions = config.subjects.filter((s) => s.programId === programId && s.active)
  const endTime = program && startTime
    ? minutesToTime(timeToMinutes(startTime) + program.slotMinutes)
    : ''

  // 회차 전개 — 매주 반복이면 종료일자까지 7일 간격 (상한 MAX_OCCURRENCES)
  const occurrences = useMemo(() => {
    if (!date || !startTime || !endTime) return []
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
  }, [date, startTime, endTime, repeat, repeatUntil, slots, educatorId])

  const creatable = occurrences.filter((o) => !o.conflict)

  const submit = async () => {
    if (busy) return
    if (!studentId) { setError('학생을 선택해 주세요.'); return }
    if (!program || !date || !startTime) { setError('날짜와 시작 시간을 입력해 주세요.'); return }
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
          capacity: 1,
          status: 'open',
          isPublic: false, // 지정 예약 — 학생 예약 화면에 노출하지 않는다
          note: '강사지정',
        }, actor)
        const result = await rpcReserve({
          slotId: slot.id, studentId,
          actorId: actor.id, actorRole: actor.role,
        })
        if (!result?.ok) {
          // 예약이 거절된 회차는 빈 지정 슬롯이 남지 않게 되물린다
          await rpcUpdateSlot({
            slotId: slot.id, del: true,
            actorId: actor.id, actorRole: actor.role,
            reason: '강사지정예약 실패 회차 정리',
          })
          fails.push({ date: o.date, code: result?.code ?? 'ERROR' })
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
        학생·날짜·시간을 지정해 예약을 고정합니다. 지정된 시간대에는 타임테이블
        생성 시 예약 가능 시간이 만들어지지 않아요. 매주 반복을 켜면 종료일자까지
        같은 요일·시간으로 반복 예약됩니다.
      </p>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">학생</label>
        {studentId
          ? (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-sm font-semibold rounded-full pl-3 pr-1.5 py-1.5">
              {studentName(studentId)}
              <button
                type="button"
                onClick={() => setStudentId('')}
                className="p-0.5 hover:text-blue-900"
                aria-label="학생 변경"
              >
                <X size={14} />
              </button>
            </span>
          )
          : <StudentCombobox students={students} value="" onChange={setStudentId} placeholder="학생 검색..." />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 col-span-2">
          프로그램
          <select
            value={programId}
            onChange={(e) => { setProgramId(e.target.value); setSubjectId('') }}
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
        <label className="text-xs text-gray-500">
          첫 상담일
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          시작 시간 ({program?.slotMinutes ?? 20}분 상담{endTime && ` — ${endTime} 종료`})
          <TimeField value={startTime} onChange={setStartTime} className={`${FIELD} w-full mt-1`} />
        </label>
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
            <b>{creatable.length}회</b> 예약됩니다 ({startTime}~{endTime})
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
          <p className="text-xs font-bold text-orange-600">일부 회차는 예약하지 못했습니다 (나머지는 예약 완료):</p>
          {failures.map((f) => (
            <p key={f.date} className="text-xs text-orange-600">
              {f.date} — {bookingMessage(f.code, { program })}
            </p>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !studentId || creatable.length === 0}
        className="w-full h-12 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '처리 중...' : `지정 예약 확정 (${creatable.length}회)`}
      </button>
    </ModalShell>
  )
}
