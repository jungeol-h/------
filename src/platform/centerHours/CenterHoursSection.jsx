// 출결 탭에 내장되는 센터 이용시간 관리 섹션 (매니저·관리자 공용).
// 데이터(registrations/config)는 부모(AttendanceTab)의 useCenterHours 훅에서
// props로 받는다 — 타임라인과 fetch를 공유하기 위함. 쓰기 후엔 reload 호출.
// 주간 명단은 종이 출석부처럼 시간 단위=열 테이블로 보여준다 (데스크톱 기준,
// 모바일은 가로 스크롤). 등록 열기/잠금·등·하원 시간표 반영은 관리자 전용.

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange, CheckCheck, FileSpreadsheet, Loader2, Lock, LockOpen, UserPen,
} from 'lucide-react'
import {
  CENTER_HOUR_UNITS, CENTER_DAY_LABEL as DAY_LABEL, CENTER_WEEK_ORDER,
  operatingDayOrder, unitKey, unitLabel,
} from '../data/centerHours.js'
import { saveCenterHours, updateCenterHoursConfig, syncAttendanceSchedules } from './centerHoursApi.js'
import { buildCenterHoursSheets, downloadCenterHoursWorkbook } from './centerHoursExcel.js'
import { selectionToEntries } from './centerHoursSelection.js'
import CenterHourGrid from './CenterHourGrid.jsx'
import { todayStr } from '../utils/dateUtils.js'

// readOnly: 감독관(viewer) 열람용 — 학생 대리 수정 에디터 숨김 (엑셀은 허용)
export default function CenterHoursSection({
  role, allStudents, editableStudents, registrations, config, reload, readOnly = false,
}) {
  const isAdmin = role === 'admin'
  const dayOrder = operatingDayOrder(config.operatingDays)
  const [day, setDay] = useState(() => {
    const dow = new Date().getDay()
    return operatingDayOrder(config.operatingDays).includes(dow) ? dow : operatingDayOrder(config.operatingDays)[0]
  })
  const [busy, setBusy] = useState(null) // 'toggle' | 'sync' | 'excel' | 'days'
  const [notice, setNotice] = useState(null) // { kind, text }

  // 운영 요일이 바뀌어 현재 선택 요일이 빠지면 첫 운영 요일로 이동
  useEffect(() => {
    if (!dayOrder.includes(day)) setDay(dayOrder[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOrder.join(',')])

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
      setNotice({ kind: 'ok', text: next.isOpen ? '학생 등록을 열었습니다.' : '학생 등록을 잠갔습니다.' })
      await reload()
    } catch {
      setNotice({ kind: 'error', text: '설정 변경에 실패했습니다.' })
    } finally {
      setBusy(null)
    }
  }

  // 운영 요일 토글 (관리자 전용) — 등록이 있는 요일을 닫을 땐 확인을 받는다
  const handleToggleDay = async (d) => {
    const isOn = dayOrder.includes(d)
    const next = isOn
      ? dayOrder.filter((x) => x !== d)
      : CENTER_WEEK_ORDER.filter((x) => dayOrder.includes(x) || x === d)
    if (next.length === 0) {
      setNotice({ kind: 'error', text: '운영 요일은 최소 1일 이상이어야 합니다.' })
      return
    }
    if (isOn) {
      const count = new Set(
        registrations.filter((r) => r.dayOfWeek === d).map((r) => r.studentId),
      ).size
      if (count > 0 && !window.confirm(
        `${DAY_LABEL[d]}요일에 등록한 학생이 ${count}명 있습니다. 운영을 닫아도 기존 등록은 유지되지만 학생 화면에서 보이지 않게 됩니다. 계속할까요?`,
      )) return
    }
    setBusy('days')
    setNotice(null)
    try {
      await updateCenterHoursConfig({ operatingDays: next })
      setNotice({
        kind: 'ok',
        text: `운영 요일을 ${operatingDayOrder(next).map((x) => DAY_LABEL[x]).join('·')}로 변경했습니다.`,
      })
      await reload()
    } catch {
      setNotice({ kind: 'error', text: '운영 요일 변경에 실패했습니다.' })
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
        setNotice({ kind: 'ok', text: `등록 학생 ${result.students}명의 등·하원 시간표에 반영했습니다.` })
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
      const sheets = buildCenterHoursSheets({ registrations, students: allStudents, dayOrder })
      await downloadCenterHoursWorkbook(sheets, todayStr())
      setNotice({ kind: 'ok', text: '출석부 엑셀을 다운로드했습니다.' })
    } catch {
      setNotice({ kind: 'error', text: '엑셀 생성에 실패했습니다.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* 상태 요약 + 조작 버튼 한 줄 */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-gray-400 mr-auto">
          등록 학생 {registeredCount}명 · 시간당 정원 {config.capacity}명 ·{' '}
          <span className={config.isOpen ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
            {config.isOpen ? '학생 등록 열림' : '학생 등록 잠김'}
          </span>
        </p>
        <button
          onClick={handleExcel}
          disabled={busy !== null}
          className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40"
        >
          {busy === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
          출석부 엑셀
        </button>
        {isAdmin && (
          <>
            <button
              onClick={handleToggleOpen}
              disabled={busy !== null}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 text-white ${
                config.isOpen ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
            >
              {busy === 'toggle' ? <Loader2 size={13} className="animate-spin" />
                : config.isOpen ? <Lock size={13} /> : <LockOpen size={13} />}
              {config.isOpen ? '등록 잠그기' : '등록 열기'}
            </button>
            <button
              onClick={handleSync}
              disabled={busy !== null}
              className="px-4 py-2 border-2 border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40"
            >
              {busy === 'sync' ? <Loader2 size={13} className="animate-spin" /> : <CalendarRange size={13} />}
              시간표 일괄 보정
            </button>
          </>
        )}
      </div>
      {isAdmin && (
        <p className="text-[11px] text-gray-400 -mt-2">
          이용시간을 저장하면 그 학생의 등·하원 시간표(키오스크 지각·결석 판정 기준)가 자동
          갱신됩니다. &lsquo;일괄 반영&rsquo;은 시드 SQL을 직접 넣은 직후 등 보정용이며, 오늘 이미 지난
          시간대가 새로 생기면 해당 학생들의 미등원 알림이 일괄 생성될 수 있어요.
        </p>
      )}

      {/* 운영 요일 설정 (관리자) — 임시 오픈(예: 이번 주 수·목)도 여기서 켠다 */}
      {isAdmin && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-gray-400 mr-1">운영 요일</span>
          {CENTER_WEEK_ORDER.map((d) => {
            const on = dayOrder.includes(d)
            return (
              <button
                key={d}
                onClick={() => handleToggleDay(d)}
                disabled={busy !== null}
                title={on ? '클릭하여 운영 닫기' : '클릭하여 운영 열기'}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${
                  on ? 'bg-indigo-500 text-white' : 'bg-white text-gray-300 shadow-sm'
                }`}
              >
                {DAY_LABEL[d]}
              </button>
            )
          })}
          <span className="text-[11px] text-gray-400 ml-1">
            학생 등록 화면·시간대별 현황·등하원 시간표에 바로 반영됩니다
          </span>
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

      {/* 요일 선택 */}
      <div className="flex gap-1.5">
        {dayOrder.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              day === d ? 'bg-indigo-500 text-white' : 'bg-white text-gray-400 shadow-sm'
            }`}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>

      {/* 시간대별 명단 — 종이 출석부처럼 단위=열 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <div className="min-w-[860px] grid" style={{ gridTemplateColumns: `repeat(${CENTER_HOUR_UNITS[day].length}, 1fr)` }}>
          {CENTER_HOUR_UNITS[day].map((unit) => {
            const students = roster.get(unitKey(day, unit.start)) ?? []
            const over = students.length >= config.capacity
            return (
              <div key={unit.start} className="border-r border-gray-100 last:border-r-0">
                <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/60 sticky top-0">
                  <p className="text-xs font-bold text-gray-700">{unitLabel(unit)}</p>
                  <p className={`text-[11px] font-bold ${over ? 'text-red-500' : 'text-gray-400'}`}>
                    {students.length}/{config.capacity}명{over && ' · 정원 초과'}
                  </p>
                </div>
                <ul className="px-3 py-2 space-y-1">
                  {students.length === 0 && (
                    <li className="text-[11px] text-gray-300 py-1">등록 없음</li>
                  )}
                  {students.map((s, i) => (
                    <li key={s.id} className="text-xs text-gray-700 flex items-baseline gap-1.5">
                      <span className="text-[10px] text-gray-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-[10px] text-gray-400 truncate">
                        {[s.school, s.grade].filter(Boolean).join(' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* 학생 대리 수정 — 열람 전용 역할에는 숨김 */}
      {!readOnly && (
        <StudentHoursEditor
          role={role}
          students={editableStudents}
          registrations={registrations}
          capacity={config.capacity}
          operatingDays={config.operatingDays}
          onSaved={reload}
          busyGlobal={busy}
        />
      )}
    </div>
  )
}

function StudentHoursEditor({ role, students, registrations, capacity, operatingDays, onSaved, busyGlobal }) {
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
    <div className="max-w-lg">
      <div className="flex items-center gap-2 mb-2 mt-2">
        <UserPen size={16} className="text-indigo-400" />
        <h4 className="text-sm font-bold text-gray-700">학생 이용시간 수정</h4>
        <span className="text-[11px] text-gray-400">정원 무시 · 저장 시 등·하원 시간표 자동 반영</span>
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
            days={operatingDays}
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
