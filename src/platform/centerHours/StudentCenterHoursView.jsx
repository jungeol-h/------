// 학생 센터 이용시간 등록 화면 — 요일×1시간 단위 그리드에서 체크 후 일괄 저장.
// 정원 최종 검증은 RPC(center_save_hours)가 하고, 여기 잔여 표시는 안내용이다.
// 등록이 잠기면(isOpen=false) 읽기 전용으로 내 시간만 보여준다.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCheck, Loader2, Lock } from 'lucide-react'
import { unitKey } from '../data/centerHours.js'
import { fetchCenterHours, saveCenterHours, isMigrationMissing } from './centerHoursApi.js'
import { selectionToEntries, summarizeDays } from './centerHoursSelection.js'
import CenterHourGrid from './CenterHourGrid.jsx'

const DAY_LABEL = { 0: '일', 1: '월', 2: '화', 5: '금', 6: '토' }

export default function StudentCenterHoursView({ student }) {
  const [state, setState] = useState({ loading: true, error: null, migrationNeeded: false })
  const [config, setConfig] = useState({ isOpen: false, capacity: 40 })
  const [othersCount, setOthersCount] = useState({})
  const [selected, setSelected] = useState(() => new Set())
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'error', text }

  // keepSelection: 정원 마감 등으로 저장이 거절됐을 때 잔여 인원만 갱신하고
  // 학생이 고르던 선택은 유지한다 (전부 리셋되면 처음부터 다시 골라야 함)
  const load = useCallback(async ({ keepSelection = false } = {}) => {
    if (!keepSelection) setState({ loading: true, error: null, migrationNeeded: false })
    try {
      const { registrations, config: cfg } = await fetchCenterHours()
      const counts = {}
      const mine = new Set()
      for (const reg of registrations) {
        const k = unitKey(reg.dayOfWeek, reg.startTime)
        if (reg.studentId === student.id) mine.add(k)
        else counts[k] = (counts[k] ?? 0) + 1
      }
      setConfig(cfg)
      setOthersCount(counts)
      if (!keepSelection) {
        setSelected(mine)
        setDirty(false)
      }
      setState({ loading: false, error: null, migrationNeeded: false })
    } catch (e) {
      setState({ loading: false, error: e, migrationNeeded: isMigrationMissing(e) })
    }
  }, [student.id])

  useEffect(() => { load() }, [load])

  const summary = useMemo(() => summarizeDays(selected), [selected])

  const handleToggle = (day, unit) => {
    setNotice(null)
    setDirty(true)
    setSelected((prev) => {
      const next = new Set(prev)
      const k = unitKey(day, unit.start)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const handleSave = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await saveCenterHours({
        studentId: student.id,
        actorRole: 'student',
        entries: selectionToEntries(selected),
      })
      if (result?.ok) {
        setNotice({ kind: 'ok', text: '이용시간이 저장되었습니다. 등·하원 시간에도 자동 반영돼요.' })
        await load()
      } else if (result?.code === 'SLOT_FULL') {
        const full = (result.full ?? [])
          .map((f) => `${DAY_LABEL[f.day] ?? ''} ${f.start}`)
          .join(', ')
        setNotice({ kind: 'error', text: `정원이 가득 찬 시간이 있어요: ${full}. 다른 시간을 선택해 주세요.` })
        await load({ keepSelection: true })
      } else if (result?.code === 'LOCKED') {
        setNotice({ kind: 'error', text: '등록이 마감되었습니다. 변경은 선생님께 문의해 주세요.' })
      } else {
        setNotice({ kind: 'error', text: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' })
      }
    } catch {
      setNotice({ kind: 'error', text: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setBusy(false)
    }
  }

  if (state.loading) {
    return (
      <div className="py-16 flex justify-center text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  if (state.migrationNeeded || state.error) {
    return (
      <div className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">
        센터 이용시간 등록 준비 중입니다. 잠시 후 다시 확인해 주세요.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-gray-700">센터 이용시간 등록</h3>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          센터에 있을 시간을 1시간 단위로 선택해 주세요. 시간당 {config.capacity}명까지 등록할 수 있어요.
        </p>
      </div>

      {!config.isOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Lock size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            등록이 마감되어 지금은 볼 수만 있어요. 변경이 필요하면 선생님께 말씀해 주세요.
          </p>
        </div>
      )}

      <CenterHourGrid
        selected={selected}
        othersCount={othersCount}
        capacity={config.capacity}
        editable={config.isOpen}
        onToggle={handleToggle}
      />

      {summary.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h4 className="text-xs font-bold text-gray-500 mb-2">내 등원 시간 요약</h4>
          <div className="flex flex-wrap gap-2">
            {summary.map(({ day, arrival, departure }) => (
              <span key={day} className="text-xs bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full">
                {DAY_LABEL[day]} {arrival}~{departure}
              </span>
            ))}
          </div>
        </div>
      )}

      {notice && (
        <p className={`text-sm rounded-xl p-3 ${
          notice.kind === 'ok' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
        }`}>
          {notice.kind === 'ok' && <CheckCheck size={14} className="inline mr-1" />}
          {notice.text}
        </p>
      )}

      {config.isOpen && (
        <button
          onClick={handleSave}
          disabled={busy || !dirty}
          className="w-full py-3.5 bg-indigo-500 text-white rounded-2xl font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? '저장 중...' : '이용시간 저장'}
        </button>
      )}
    </div>
  )
}
