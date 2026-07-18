// 출결 탭에 내장되는 센터 이용시간 관리 섹션 (매니저·관리자 공용).
// 시간대별 등록 명단(출석부) 조회 · 엑셀 추출은 공용, 등록 열기/잠금과
// 등·하원 시간표 일괄 반영은 관리자 전용. 학생 대리 수정은 정원을 무시한다
// (RPC가 admin/manager 역할이면 정원·잠금 검증을 건너뛴다).

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarRange, CheckCheck, FileSpreadsheet, Loader2, Lock, LockOpen, RefreshCw, UserPen,
} from 'lucide-react'
import { CENTER_HOUR_UNITS, CENTER_DAY_ORDER, unitKey, unitLabel } from '../data/centerHours.js'
import {
  fetchCenterHours, saveCenterHours, updateCenterHoursConfig,
  syncAttendanceSchedules, isMigrationMissing,
} from './centerHoursApi.js'
import { buildCenterHoursSheets, downloadCenterHoursWorkbook } from './centerHoursExcel.js'
import { selectionToEntries } from './centerHoursSelection.js'
import CenterHourGrid from './CenterHourGrid.jsx'
import { todayStr } from '../utils/dateUtils.js'

const DAY_LABEL = { 0: '일', 1: '월', 2: '화', 5: '금', 6: '토' }

// allStudents: 명단 표시용 전체 학생, editableStudents: 대리 수정 대상(매니저는 담당만)
export default function CenterHoursSection({ role, allStudents, editableStudents }) {
  const isAdmin = role === 'admin'
  const [state, setState] = useState({ loading: true, error: null, migrationNeeded: false })
  const [config, setConfig] = useState({ isOpen: false, capacity: 40 })
  const [registrations, setRegistrations] = useState([])
  const [day, setDay] = useState(() => {
    const dow = new Date().getDay()
    return CENTER_HOUR_UNITS[dow] ? dow : CENTER_DAY_ORDER[0]
  })
  const [busy, setBusy] = useState(null) // 'toggle' | 'sync' | 'excel' | 'save'
  const [notice, setNotice] = useState(null) // { kind, text }

  const load = useCallback(async () => {
    setState({ loading: true, error: null, migrationNeeded: false })
    try {
      const { registrations: regs, config: cfg } = await fetchCenterHours()
      setRegistrations(regs)
      setConfig(cfg)
      setState({ loading: false, error: null, migrationNeeded: false })
    } catch (e) {
      setState({ loading: false, error: e, migrationNeeded: isMigrationMissing(e) })
    }
  }, [])

  useEffect(() => { load() }, [load])

  const studentById = useMemo(
    () => new Map(allStudents.map((s) => [s.id, s])),
    [allStudents],
  )

  // (day#start) → 학생 목록 (학년→이름순)
  const roster = useMemo(() => {
    const bucket = new Map()
    for (const reg of registrations) {
      const student = studentById.get(reg.studentId)
      if (!student) continue
      const k = unitKey(reg.dayOfWeek, reg.startTime)
      if (!bucket.has(k)) bucket.set(k, [])
      bucket.get(k).push(student)
    }
    for (const list of bucket.values()) {
      list.sort((a, b) =>
        (a.grade ?? '').localeCompare(b.grade ?? '', 'ko') ||
        a.name.localeCompare(b.name, 'ko'))
    }
    return bucket
  }, [registrations, studentById])

  const registeredCount = useMemo(
    () => new Set(registrations.map((r) => r.studentId)).size,
    [registrations],
  )

  const handleToggleOpen = async () => {
    setBusy('toggle')
    setNotice(null)
    try {
      const next = await updateCenterHoursConfig({ isOpen: !config.isOpen })
      setConfig((prev) => ({ ...prev, ...next }))
      setNotice({ kind: 'ok', text: next.isOpen ? '학생 등록을 열었습니다.' : '학생 등록을 잠갔습니다.' })
    } catch {
      setNotice({ kind: 'error', text: '설정 변경에 실패했습니다.' })
    } finally {
      setBusy(null)
    }
  }

  const handleSync = async () => {
    setBusy('sync')
    setNotice(null)
    try {
      const result = await syncAttendanceSchedules(role)
      if (result?.ok) {
        setNotice({ kind: 'ok', text: `등록 학생 ${result.students}명의 등·하원 시간표에 반영했습니다. 키오스크 지각 판정에 바로 적용됩니다.` })
      } else {
        setNotice({ kind: 'error', text: '시간표 반영에 실패했습니다.' })
      }
    } catch {
      setNotice({ kind: 'error', text: '시간표 반영에 실패했습니다.' })
    } finally {
      setBusy(null)
    }
  }

  const handleExcel = async () => {
    setBusy('excel')
    setNotice(null)
    try {
      const sheets = buildCenterHoursSheets({ registrations, students: allStudents })
      await downloadCenterHoursWorkbook(sheets, todayStr())
      setNotice({ kind: 'ok', text: '출석부 엑셀을 다운로드했습니다.' })
    } catch {
      setNotice({ kind: 'error', text: '엑셀 생성에 실패했습니다.' })
    } finally {
      setBusy(null)
    }
  }

  if (state.loading) {
    return (
      <div className="py-10 flex justify-center text-gray-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    )
  }

  if (state.migrationNeeded) {
    return (
      <div className="py-8 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm px-4">
        센터 이용시간 마이그레이션(scripts/add-center-hours.sql)이 아직 적용되지 않았습니다.
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="py-8 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">
        이용시간 데이터를 불러오지 못했습니다.
        <button onClick={load} className="ml-2 text-indigo-500 font-bold">다시 시도</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 상태 요약 + 새로고침 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          등록 학생 {registeredCount}명 · 시간당 정원 {config.capacity}명 ·{' '}
          <span className={config.isOpen ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
            {config.isOpen ? '학생 등록 열림' : '학생 등록 잠김'}
          </span>
        </p>
        <button onClick={load} className="p-2 text-gray-300 hover:text-gray-500" aria-label="새로고침">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* 관리자 조작 + 엑셀 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleExcel}
          disabled={busy !== null}
          className="py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40"
        >
          {busy === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
          출석부 엑셀
        </button>
        {isAdmin ? (
          <button
            onClick={handleToggleOpen}
            disabled={busy !== null}
            className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 ${
              config.isOpen ? 'bg-amber-500 text-white' : 'bg-indigo-500 text-white'
            }`}
          >
            {busy === 'toggle' ? <Loader2 size={14} className="animate-spin" />
              : config.isOpen ? <Lock size={14} /> : <LockOpen size={14} />}
            {config.isOpen ? '등록 잠그기' : '등록 열기'}
          </button>
        ) : (
          <div />
        )}
      </div>
      {isAdmin && (
        <button
          onClick={handleSync}
          disabled={busy !== null}
          className="w-full py-3 border-2 border-indigo-200 text-indigo-600 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40"
        >
          {busy === 'sync' ? <Loader2 size={14} className="animate-spin" /> : <CalendarRange size={14} />}
          등·하원 시간표에 일괄 반영
        </button>
      )}

      {notice && (
        <p className={`text-sm rounded-xl p-3 ${
          notice.kind === 'ok' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
        }`}>
          {notice.kind === 'ok' && <CheckCheck size={14} className="inline mr-1" />}
          {notice.text}
        </p>
      )}

      {/* 요일 선택 + 시간대별 명단 */}
      <div className="flex gap-1.5">
        {CENTER_DAY_ORDER.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              day === d ? 'bg-indigo-500 text-white' : 'bg-white text-gray-400 shadow-sm'
            }`}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {CENTER_HOUR_UNITS[day].map((unit) => {
          const students = roster.get(unitKey(day, unit.start)) ?? []
          const over = students.length >= config.capacity
          return (
            <div key={unit.start} className="bg-white rounded-2xl shadow-sm p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-gray-700">{unitLabel(unit)}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  over ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {students.length}/{config.capacity}명
                </span>
              </div>
              {students.length === 0 ? (
                <p className="text-xs text-gray-300">등록 학생 없음</p>
              ) : (
                <p className="text-xs text-gray-600 leading-relaxed">
                  {students.map((s) => {
                    const meta = [s.school, s.grade].filter(Boolean).join(' ')
                    return meta ? `${s.name}(${meta})` : s.name
                  }).join(', ')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* 학생 대리 수정 */}
      <StudentHoursEditor
        role={role}
        students={editableStudents}
        registrations={registrations}
        capacity={config.capacity}
        onSaved={load}
        busyGlobal={busy}
      />
    </div>
  )
}

function StudentHoursEditor({ role, students, registrations, capacity, onSaved, busyGlobal }) {
  const [studentId, setStudentId] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  // 학생 선택 시 그 학생의 현재 등록으로 초기화
  useEffect(() => {
    if (!studentId) return
    const mine = new Set(
      registrations
        .filter((r) => r.studentId === studentId)
        .map((r) => unitKey(r.dayOfWeek, r.startTime)),
    )
    setSelected(mine)
    setDirty(false)
    setNotice(null)
    // registrations는 저장 후 refetch로 갱신되므로 여기서는 studentId 변경만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  const othersCount = useMemo(() => {
    const counts = {}
    for (const reg of registrations) {
      if (reg.studentId === studentId) continue
      const k = unitKey(reg.dayOfWeek, reg.startTime)
      counts[k] = (counts[k] ?? 0) + 1
    }
    return counts
  }, [registrations, studentId])

  const handleSave = async () => {
    setSaving(true)
    setNotice(null)
    try {
      const result = await saveCenterHours({
        studentId,
        actorRole: role,
        entries: selectionToEntries(selected),
      })
      if (result?.ok) {
        setNotice({ kind: 'ok', text: '저장되었습니다.' })
        setDirty(false)
        await onSaved()
      } else {
        setNotice({ kind: 'error', text: '저장에 실패했습니다.' })
      }
    } catch {
      setNotice({ kind: 'error', text: '저장에 실패했습니다.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 mt-2">
        <UserPen size={16} className="text-indigo-400" />
        <h4 className="text-sm font-bold text-gray-700">학생 이용시간 수정 (정원 무시)</h4>
      </div>
      <select
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        <option value="">학생을 선택하세요</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
        ))}
      </select>
      {studentId && (
        <div className="space-y-2">
          <CenterHourGrid
            selected={selected}
            othersCount={othersCount}
            capacity={capacity}
            editable
            ignoreCapacity
            onToggle={(day, unit) => {
              setDirty(true)
              setSelected((prev) => {
                const next = new Set(prev)
                const k = unitKey(day, unit.start)
                if (next.has(k)) next.delete(k)
                else next.add(k)
                return next
              })
            }}
          />
          {notice && (
            <p className={`text-sm rounded-xl p-3 ${
              notice.kind === 'ok' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
            }`}>
              {notice.text}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty || busyGlobal !== null}
            className="w-full py-3 bg-indigo-500 text-white rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? '저장 중...' : '이 학생 이용시간 저장'}
          </button>
        </div>
      )}
    </div>
  )
}
