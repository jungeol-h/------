// 월별 예약 오픈기간 관리 (관리자) — 명세 4.1·6.2.
// 사전예약형 프로그램의 접수기간(오픈~마감 일시)과 대상 상담일 범위를 등록·연장·삭제.

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useBooking } from '../BookingContext.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { addDaysStr } from '../bookingRules.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function OpenPeriodEditor({ program }) {
  const { config, createOpenPeriod, deleteOpenPeriod } = useBooking()
  const periods = config.openPeriods.filter((p) => p.programId === program.id)

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    targetStart: addDaysStr(todayStr(), 7),
    targetEnd: addDaysStr(todayStr(), 37),
    openFrom: '',
    openUntil: '',
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async () => {
    if (busy) return
    if (!form.openFrom || !form.openUntil) {
      setError('접수 시작·마감 일시를 입력해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createOpenPeriod({
        programId: program.id,
        targetStart: form.targetStart,
        targetEnd: form.targetEnd,
        openFrom: new Date(form.openFrom).toISOString(),
        openUntil: new Date(form.openUntil).toISOString(),
        note: form.note,
      })
      setAdding(false)
    } catch {
      setError('저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {periods.map((p) => {
        const now = new Date()
        const active = now >= new Date(p.openFrom) && now <= new Date(p.openUntil)
        return (
          <div key={p.id} className="rounded-xl bg-gray-50 p-3 flex items-center justify-between gap-2 text-xs">
            <div>
              <p className="font-bold text-gray-700">
                상담일 {p.targetStart} ~ {p.targetEnd}
                {active && <span className="ml-1.5 text-emerald-600">접수 중</span>}
              </p>
              <p className="text-gray-500 mt-0.5">접수 {fmt(p.openFrom)} ~ {fmt(p.openUntil)}{p.note ? ` · ${p.note}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={() => deleteOpenPeriod(p.id)}
              className="p-1.5 text-gray-400 hover:text-red-500"
              aria-label="오픈기간 삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}

      {adding ? (
        <div className="rounded-xl border border-blue-200 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">
              대상 상담일 시작
              <input type="date" value={form.targetStart} onChange={set('targetStart')} className={`${FIELD} w-full mt-1`} />
            </label>
            <label className="text-xs text-gray-500">
              대상 상담일 종료
              <input type="date" value={form.targetEnd} onChange={set('targetEnd')} className={`${FIELD} w-full mt-1`} />
            </label>
            <label className="text-xs text-gray-500">
              접수 시작 일시
              <input type="datetime-local" value={form.openFrom} onChange={set('openFrom')} className={`${FIELD} w-full mt-1`} />
            </label>
            <label className="text-xs text-gray-500">
              접수 마감 일시
              <input type="datetime-local" value={form.openUntil} onChange={set('openUntil')} className={`${FIELD} w-full mt-1`} />
            </label>
            <label className="text-xs text-gray-500 col-span-2">
              비고
              <input type="text" value={form.note} onChange={set('note')} className={`${FIELD} w-full mt-1`} />
            </label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="flex-1 h-9 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">닫기</button>
            <button type="button" onClick={submit} disabled={busy} className="flex-[2] h-9 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
              {busy ? '저장 중...' : '오픈기간 등록'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full h-9 rounded-lg border border-dashed border-blue-300 text-blue-600 text-xs font-bold"
        >
          + 예약 오픈기간 등록
        </button>
      )}
    </div>
  )
}
