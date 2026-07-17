// 그룹상담 편성 모달 (명세 11) — 강사가 비공개 그룹 슬롯을 만들고 학생을 직접 배정.
// 배정도 예약과 동일한 제한 검증(RPC)을 거치며, 학생별 부분 성공·실패 사유를 표시한다.

import { useMemo, useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useBooking } from '../BookingContext.jsx'
import { bookingMessage } from '../bookingMessages.js'
import { todayStr } from '../../utils/dateUtils.js'
import { isActiveStudent } from '../../data/studentStatus.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

export default function GroupAssignModal({ program, educatorId, subjectOptions, existingSlot, onClose }) {
  const { data } = useData()
  const { createSlot, assignGroup } = useBooking()

  const students = useMemo(
    () => (data.students ?? []).filter(isActiveStudent),
    [data.students],
  )

  const [form, setForm] = useState({
    date: existingSlot?.date ?? todayStr(),
    startTime: existingSlot?.startTime ?? '16:00',
    endTime: existingSlot?.endTime ?? '',
    subjectId: existingSlot?.subjectId ?? subjectOptions[0]?.id ?? null,
    capacity: existingSlot?.capacity ?? program.groupMax ?? 4,
    note: existingSlot?.note ?? '',
  })
  const [selected, setSelected] = useState(new Set())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // [{ student_id, code }]
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const filtered = query
    ? students.filter((s) => s.name.includes(query))
    : students

  // 종료시간 미입력 시 프로그램 시간 단위로 자동 계산
  const endTime = form.endTime || (() => {
    const [h, m] = form.startTime.split(':').map(Number)
    const total = h * 60 + m + program.slotMinutes
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  })()

  const submit = async () => {
    if (busy) return
    if (selected.size === 0) {
      setError('배정할 학생을 선택해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let slotId = existingSlot?.id
      if (!slotId) {
        const created = await createSlot({
          programId: program.id,
          educatorId,
          subjectId: program.usesSubject ? form.subjectId : null,
          date: form.date,
          startTime: form.startTime,
          endTime,
          capacity: Number(form.capacity),
          status: 'open',
          isPublic: false, // 강사 지정 그룹은 비공개 기본 (명세 11.3)
          note: form.note,
        })
        slotId = created.id
      }
      const result = await assignGroup({ slotId, studentIds: [...selected] })
      if (result?.ok) {
        const rs = result.results ?? []
        setResults(rs)
        if (rs.every((r) => r.code === 'OK')) onClose()
      } else {
        setError(bookingMessage(result?.code, { program }))
      }
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const studentName = (id) => students.find((s) => s.id === id)?.name ?? id

  return (
    <ModalShell title={`그룹상담 편성 — ${program.name}`} onClose={onClose} maxWidth="max-w-xl">
      {!existingSlot && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-500 col-span-2">
            날짜
            <input type="date" value={form.date} onChange={set('date')} className={`${FIELD} w-full mt-1`} />
          </label>
          <label className="text-xs text-gray-500">
            시작
            <input type="time" value={form.startTime} onChange={set('startTime')} className={`${FIELD} w-full mt-1`} />
          </label>
          <label className="text-xs text-gray-500">
            종료 (기본 {program.slotMinutes}분)
            <input type="time" value={form.endTime} onChange={set('endTime')} placeholder={endTime} className={`${FIELD} w-full mt-1`} />
          </label>
          {program.usesSubject && (
            <label className="text-xs text-gray-500">
              교과
              <select value={form.subjectId ?? ''} onChange={set('subjectId')} className={`${FIELD} w-full mt-1`}>
                {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs text-gray-500">
            정원 (기본 {program.groupMin}~{program.groupMax}명)
            <input type="number" min="1" value={form.capacity} onChange={set('capacity')} className={`${FIELD} w-full mt-1`} />
          </label>
          <label className="text-xs text-gray-500 col-span-2">
            그룹명·비고
            <input type="text" value={form.note} onChange={set('note')} className={`${FIELD} w-full mt-1`} />
          </label>
        </div>
      )}

      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학생 이름 검색"
          className={`${FIELD} w-full`}
        />
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
          {filtered.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700 py-1">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              {s.name}
              <span className="text-[11px] text-gray-400">{s.school} {s.grade}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">선택 {selected.size}명</p>
      </div>

      {results && results.some((r) => r.code !== 'OK') && (
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 space-y-1">
          <p className="text-xs font-bold text-orange-600">일부 학생은 배정하지 못했습니다:</p>
          {results.filter((r) => r.code !== 'OK').map((r) => (
            <p key={r.student_id} className="text-xs text-orange-600">
              {studentName(r.student_id)} — {bookingMessage(r.code, { program })}
            </p>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '처리 중...' : '그룹 배정 저장'}
      </button>
    </ModalShell>
  )
}
