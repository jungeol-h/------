// 타임테이블 일괄 생성 마법사 (관리자) — 명세 5.2·5.3.
// 운영기간·요일·운영시간·시간 단위 입력 → slotGeneration 미리보기 → 작성중(draft) 배치 저장.
// 저장 후 '타임테이블' 메뉴의 일괄 상태 전환으로 검토완료 → 예약공개.

import { useMemo, useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { addDaysStr } from '../bookingRules.js'
import { generateSlots } from '../slotGeneration.js'
import { useBooking } from '../BookingContext.jsx'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'
const WEEKDAYS = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' },
  { value: 4, label: '목' }, { value: 5, label: '금' }, { value: 6, label: '토' },
  { value: 0, label: '일' },
]

export default function TimetableWizard({ onClose }) {
  const { config, userNames, createSlotBatch } = useBooking()
  const programs = config.programs.filter((p) => p.active)

  const [form, setForm] = useState({
    programId: programs[0]?.id ?? '',
    educatorId: '',
    subjectId: '',
    from: todayStr(),
    to: addDaysStr(todayStr(), 27),
    weekdays: [1, 2, 3, 4, 5],
    dayStart: '16:00',
    dayEnd: '21:00',
    capacity: null,
    breakStart: '',
    breakEnd: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const program = programs.find((p) => p.id === form.programId)
  const educatorOptions = config.educators.filter((e) => e.programId === form.programId && e.active)
  const subjectOptions = config.subjects.filter((s) => s.programId === form.programId && s.active)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggleDay = (d) => setForm((f) => ({
    ...f,
    weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d],
  }))

  const preview = useMemo(() => {
    if (!program) return []
    return generateSlots({
      from: form.from,
      to: form.to,
      weekdays: form.weekdays,
      dayStart: form.dayStart,
      dayEnd: form.dayEnd,
      slotMinutes: program.slotMinutes,
      capacity: Number(form.capacity) || program.defaultCapacity,
      educatorId: form.educatorId || null,
      subjectId: form.subjectId || null,
      breaks: form.breakStart && form.breakEnd
        ? [{ start: form.breakStart, end: form.breakEnd }]
        : [],
    })
  }, [program, form])

  const previewDays = useMemo(() => new Set(preview.map((s) => s.date)).size, [preview])

  const submit = async () => {
    if (!program || busy) return
    if (preview.length === 0) {
      setError('생성될 슬롯이 없습니다. 입력값을 확인해 주세요.')
      return
    }
    setBusy(true)
    try {
      await createSlotBatch({
        programId: program.id,
        params: {
          from: form.from, to: form.to, weekdays: form.weekdays,
          day_start: form.dayStart, day_end: form.dayEnd,
          slot_minutes: program.slotMinutes,
          educator_id: form.educatorId || null,
          subject_id: form.subjectId || null,
        },
        slots: preview,
      })
      onClose()
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="타임테이블 생성" onClose={onClose} maxWidth="max-w-xl">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 col-span-2">
          프로그램
          <select value={form.programId} onChange={set('programId')} className={`${FIELD} w-full mt-1`}>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slotMinutes}분)</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          담당 강사
          <select value={form.educatorId} onChange={set('educatorId')} className={`${FIELD} w-full mt-1`}>
            <option value="">미지정</option>
            {educatorOptions.map((e) => (
              <option key={e.id} value={e.educatorId}>{userNames[e.educatorId]?.name ?? e.educatorId}</option>
            ))}
          </select>
        </label>
        {program?.usesSubject && (
          <label className="text-xs text-gray-500">
            교과
            <select value={form.subjectId} onChange={set('subjectId')} className={`${FIELD} w-full mt-1`}>
              <option value="">미지정</option>
              {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs text-gray-500">
          시작일
          <input type="date" value={form.from} onChange={set('from')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          종료일
          <input type="date" value={form.to} onChange={set('to')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          운영 시작
          <input type="time" value={form.dayStart} onChange={set('dayStart')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          운영 종료
          <input type="time" value={form.dayEnd} onChange={set('dayEnd')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          휴식 시작 (선택)
          <input type="time" value={form.breakStart} onChange={set('breakStart')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          휴식 종료 (선택)
          <input type="time" value={form.breakEnd} onChange={set('breakEnd')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          슬롯 정원 (기본 {program?.defaultCapacity ?? 1})
          <input type="number" min="1" value={form.capacity ?? ''} onChange={set('capacity')} className={`${FIELD} w-full mt-1`} />
        </label>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">운영 요일</p>
        <div className="flex gap-1.5">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`w-9 h-9 rounded-lg text-xs font-bold border ${
                form.weekdays.includes(d.value)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        미리보기: <b>{previewDays}일 × 슬롯 {preview.length}개</b>가 <b>작성중</b> 상태로 생성됩니다.
        {preview.length > 0 && (
          <span className="block mt-1 text-gray-400">
            예: {preview[0].date} {preview[0].startTime}~{preview[0].endTime} ...
          </span>
        )}
      </div>

      {!form.educatorId && (
        <p className="text-[11px] text-orange-500">
          담당 강사가 미지정입니다 — 생성 후 운영현황의 일정 이상 목록에 표시됩니다.
        </p>
      )}
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || preview.length === 0}
        className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '생성 중...' : `슬롯 ${preview.length}개 생성`}
      </button>
    </ModalShell>
  )
}
