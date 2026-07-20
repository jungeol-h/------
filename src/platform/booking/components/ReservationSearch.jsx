// 관리자 예약현황 — 검색·필터(명세 15.3) + 대리 예약·취소·변경·예외 처리(명세 3.4·16).
// 예외(override) 처리는 반드시 사유를 입력해야 하며, RPC가 감사이력에 남긴다.

import { useMemo, useState } from 'react'
import { Plus, FileSpreadsheet } from 'lucide-react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useBooking } from '../BookingContext.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { addDaysStr } from '../bookingRules.js'
import { bookingMessage } from '../bookingMessages.js'
import { reservationDisplayStatus, ATTENDANCE_STATUS } from '../bookingStatus.js'
import WeeklySlotPicker from './WeeklySlotPicker.jsx'
import { isActiveStudent } from '../../data/studentStatus.js'
import { buildReservationSheets, downloadReservationWorkbook } from '../reservationExcel.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

// 관리자 슬롯 선택 그리드 (대리 예약·변경 공용) — 학생 화면과 같은 주간 그리드.
// 마감 셀도 탭 가능(정원 초과는 예외 처리 토글 + RPC 판단), 같은 시간 복수 강사는
// 인라인 목록으로 고른다. studentReservations로 대상 학생의 '내예약' 셀도 표시.
function AdminSlotGrid({ slots, slotCounts, programId, studentReservations, userNames, onPick }) {
  const [chooser, setChooser] = useState(null)
  const candidates = useMemo(
    () => slots.filter((s) =>
      s.programId === programId && s.date >= todayStr() && s.status !== 'cancelled'),
    [slots, programId],
  )
  if (candidates.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">선택 가능한 슬롯이 없습니다.</p>
  }
  return (
    <div className="space-y-2">
      <WeeklySlotPicker
        slots={candidates}
        slotCounts={slotCounts}
        myReservations={studentReservations}
        onPick={(s) => { setChooser(null); onPick(s) }}
        onPickMany={setChooser}
        adminMode
      />
      {chooser && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2 space-y-1">
          <p className="text-[11px] font-bold text-blue-600 px-1">
            {chooser[0].date} {chooser[0].startTime} — 강사 선택
          </p>
          {chooser.map((s) => {
            const count = slotCounts[s.id] ?? 0
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { setChooser(null); onPick(s) }}
                className="w-full rounded-lg bg-white border border-gray-200 px-3 py-2 text-left text-xs flex justify-between"
              >
                <span>{userNames[s.educatorId]?.name ?? '미지정'}{s.status !== 'open' ? ` · ${s.status}` : ''}</span>
                <span className={count >= s.capacity ? 'text-red-500 font-bold' : 'text-gray-400'}>
                  {count}/{s.capacity}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OverrideFields({ override, setOverride, reason, setReason, reasonRequired }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
        예외 처리 (정원·횟수·기한 제한 무시)
      </label>
      <label className="text-xs text-gray-500 block">
        처리 사유 {override || reasonRequired ? '(필수)' : '(선택)'}
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`${FIELD} w-full mt-1`}
          placeholder="예: 학부모 유선 요청"
        />
      </label>
    </div>
  )
}

// readOnly: viewer(감독관) 열람용 — 대리 예약·변경·취소 등 쓰기 액션 숨김 (엑셀 다운로드는 허용)
export default function ReservationSearch({ readOnly = false }) {
  const { data } = useData()
  const booking = useBooking()
  const { config, slots, reservations, slotCounts, userNames, reserve, cancel, change } = booking

  const [filters, setFilters] = useState({
    from: addDaysStr(todayStr(), -7),
    to: addDaysStr(todayStr(), 30),
    programId: '',
    educatorId: '',
    subjectId: '',
    status: '',
    attendance: '',
    query: '',
    overrideOnly: false,
    overdueOnly: false,
  })
  const [proxyOpen, setProxyOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [changeTarget, setChangeTarget] = useState(null)
  const [exporting, setExporting] = useState(false)

  const setF = (key, cast = (v) => v) => (e) => setFilters((f) => ({ ...f, [key]: cast(e.target.value) }))
  const studentName = (id) => userNames[id]?.name ?? data.students?.find((u) => u.id === id)?.name ?? id
  const programName = (id) => config.programs.find((p) => p.id === id)?.name ?? id

  const educatorOptions = useMemo(
    () => [...new Set(config.educators.map((e) => e.educatorId))],
    [config.educators],
  )

  const filtered = useMemo(
    () => reservations
      .filter((r) => {
        if (!r.slot) return false
        if (filters.from && r.slot.date < filters.from) return false
        if (filters.to && r.slot.date > filters.to) return false
        if (filters.programId && r.programId !== filters.programId) return false
        if (filters.educatorId && r.slot.educatorId !== filters.educatorId) return false
        if (filters.subjectId && r.slot.subjectId !== filters.subjectId) return false
        if (filters.status && r.status !== filters.status) return false
        if (filters.attendance && r.attendanceStatus !== filters.attendance) return false
        if (filters.overrideOnly && !r.isOverride) return false
        if (filters.overdueOnly && !r.attendanceOverdue) return false
        if (filters.query && !studentName(r.studentId).includes(filters.query)) return false
        return true
      })
      .sort((a, b) => (a.slot.date === b.slot.date
        ? (a.slot.startTime < b.slot.startTime ? -1 : 1)
        : a.slot.date < b.slot.date ? -1 : 1)),
    [reservations, filters], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // 현재 필터 결과를 그대로 상담사별 시트로 내보낸다
  const exportExcel = async () => {
    if (exporting || filtered.length === 0) return
    setExporting(true)
    try {
      const sheets = buildReservationSheets({
        reservations: filtered,
        students: data.students ?? [],
        userNames,
        config,
      })
      await downloadReservationWorkbook(sheets, `${filters.from}_${filters.to}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {!readOnly && (
          <button
            type="button"
            onClick={() => setProxyOpen(true)}
            className="flex-1 h-10 rounded-xl border border-dashed border-blue-300 text-blue-600 text-xs font-bold flex items-center justify-center gap-1"
          >
            <Plus size={14} /> 학생 대리 예약
          </button>
        )}
        <button
          type="button"
          onClick={exportExcel}
          disabled={exporting || filtered.length === 0}
          className="flex-1 h-10 rounded-xl border border-dashed border-emerald-300 text-emerald-600 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"
        >
          <FileSpreadsheet size={14} /> {exporting ? '생성 중...' : '엑셀 다운로드'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={filters.from} onChange={setF('from')} className={FIELD} />
        <input type="date" value={filters.to} onChange={setF('to')} className={FIELD} />
        <select value={filters.programId} onChange={setF('programId')} className={FIELD}>
          <option value="">전체 프로그램</option>
          {config.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.status} onChange={setF('status')} className={FIELD}>
          <option value="">전체 상태</option>
          <option value="confirmed">예약확정</option>
          <option value="cancelled">취소</option>
          <option value="moved">변경완료</option>
        </select>
        <select value={filters.educatorId} onChange={setF('educatorId')} className={FIELD}>
          <option value="">전체 강사</option>
          {educatorOptions.map((eid) => (
            <option key={eid} value={eid}>{userNames[eid]?.name ?? eid}</option>
          ))}
        </select>
        <select value={filters.subjectId} onChange={setF('subjectId')} className={FIELD}>
          <option value="">전체 교과</option>
          {config.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.attendance} onChange={setF('attendance')} className={`${FIELD} col-span-2`}>
          <option value="">전체 출결상태</option>
          {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input
          type="text"
          value={filters.query}
          onChange={setF('query')}
          placeholder="학생 이름 검색"
          className={`${FIELD} col-span-2`}
        />
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={filters.overrideOnly}
            onChange={(e) => setFilters((f) => ({ ...f, overrideOnly: e.target.checked }))}
          />
          예외 처리 건만
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={filters.overdueOnly}
            onChange={(e) => setFilters((f) => ({ ...f, overdueOnly: e.target.checked }))}
          />
          출결 기한초과 건만
        </label>
      </div>

      <p className="text-[11px] text-gray-400">{filtered.length}건</p>

      <div className="space-y-2">
        {filtered.map((r) => {
          const display = reservationDisplayStatus(r, r.slot)
          return (
            <div key={r.id} className="bg-white rounded-xl shadow-sm p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">
                  {studentName(r.studentId)}
                  <span className="ml-1.5 text-xs font-semibold text-gray-500">{programName(r.programId)}</span>
                  {r.isOverride && <span className="ml-1 text-[10px] font-bold text-purple-500">예외</span>}
                </p>
                <span className="text-[11px] font-bold text-gray-500">{display.label}</span>
              </div>
              <p className="text-xs text-gray-500">
                {r.slot.date} {r.slot.startTime}~{r.slot.endTime}
                {' · '}{userNames[r.slot.educatorId]?.name ?? '미지정'}
                {' · '}{r.bookedByRole === 'parent' ? '학부모 예약' : r.bookedByRole === 'student' ? '학생 예약' : '대리 등록'}
              </p>
              {r.cancelReason && <p className="text-[11px] text-gray-400">취소사유: {r.cancelReason}</p>}
              {r.overrideReason && <p className="text-[11px] text-purple-400">예외사유: {r.overrideReason}</p>}
              {!readOnly && r.status === 'confirmed' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChangeTarget(r)}
                    className="flex-1 h-8 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold"
                  >
                    변경
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelTarget(r)}
                    className="flex-1 h-8 rounded-lg bg-red-50 text-red-500 text-[11px] font-bold"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">조건에 맞는 예약이 없습니다.</p>
        )}
      </div>

      {proxyOpen && (
        <ProxyReserveModal
          students={(data.students ?? []).filter(isActiveStudent)}
          config={config}
          slots={slots}
          slotCounts={slotCounts}
          reservations={reservations}
          userNames={userNames}
          reserve={reserve}
          onClose={() => setProxyOpen(false)}
        />
      )}
      {cancelTarget && (
        <AdminCancelModal
          reservation={cancelTarget}
          studentName={studentName(cancelTarget.studentId)}
          cancel={cancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
      {changeTarget && (
        <AdminChangeModal
          reservation={changeTarget}
          studentName={studentName(changeTarget.studentId)}
          slots={slots}
          slotCounts={slotCounts}
          reservations={reservations}
          userNames={userNames}
          change={change}
          onClose={() => setChangeTarget(null)}
        />
      )}
    </div>
  )
}

function ProxyReserveModal({ students, config, slots, slotCounts, reservations, userNames, reserve, onClose }) {
  const [studentId, setStudentId] = useState('')
  const [programId, setProgramId] = useState(config.programs[0]?.id ?? '')
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [failCode, setFailCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const filteredStudents = query ? students.filter((s) => s.name.includes(query)) : students
  const program = config.programs.find((p) => p.id === programId)

  const pick = async (slot) => {
    if (!studentId || busy) return
    if (override && !reason.trim()) {
      setFailCode('REASON_REQUIRED')
      return
    }
    setBusy(true)
    try {
      const result = await reserve({ slotId: slot.id, studentId, override, reason: reason.trim() || null })
      if (result?.ok) onClose()
      else setFailCode(result?.code ?? 'ERROR')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="학생 대리 예약" onClose={onClose} maxWidth="max-w-xl">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학생 검색"
          className={FIELD}
        />
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={FIELD}>
          <option value="">학생 선택</option>
          {filteredStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={`${FIELD} col-span-2`}>
          {config.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <OverrideFields override={override} setOverride={setOverride} reason={reason} setReason={setReason} reasonRequired={false} />
      {failCode && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode, { program })}</p>
      )}
      {studentId
        ? (
          <AdminSlotGrid
            slots={slots}
            slotCounts={slotCounts}
            programId={programId}
            studentReservations={reservations.filter((r) => r.studentId === studentId)}
            userNames={userNames}
            onPick={pick}
          />
        )
        : <p className="py-4 text-center text-xs text-gray-400">학생을 먼저 선택하세요.</p>}
    </ModalShell>
  )
}

function AdminCancelModal({ reservation, studentName, cancel, onClose }) {
  const [reason, setReason] = useState('')
  const [failCode, setFailCode] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    if (!reason.trim()) {
      setFailCode('REASON_REQUIRED')
      return
    }
    setBusy(true)
    try {
      const result = await cancel({ reservationId: reservation.id, reason: reason.trim() })
      if (result?.ok) onClose()
      else setFailCode(result?.code ?? 'ERROR')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="관리자 취소" onClose={onClose}>
      <p className="text-sm text-gray-600">
        {studentName} · {reservation.slot?.date} {reservation.slot?.startTime} 예약을 취소합니다.
        기한과 무관하게 처리되며 사유가 기록됩니다.
      </p>
      <label className="text-xs text-gray-500 block">
        취소 사유 (필수)
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={`${FIELD} w-full mt-1`} />
      </label>
      {failCode && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode)}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full h-12 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50"
      >
        {busy ? '처리 중...' : '취소 확정'}
      </button>
    </ModalShell>
  )
}

function AdminChangeModal({ reservation, studentName, slots, slotCounts, reservations, userNames, change, onClose }) {
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [failCode, setFailCode] = useState(null)
  const [busy, setBusy] = useState(false)

  const pick = async (slot) => {
    if (busy) return
    if (!reason.trim()) {
      setFailCode('REASON_REQUIRED')
      return
    }
    setBusy(true)
    try {
      const result = await change({
        reservationId: reservation.id, newSlotId: slot.id, override, reason: reason.trim(),
      })
      if (result?.ok) onClose()
      else setFailCode(result?.code ?? 'ERROR')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="관리자 예약 변경" onClose={onClose} maxWidth="max-w-xl">
      <p className="text-sm text-gray-600">
        {studentName} · 기존 {reservation.slot?.date} {reservation.slot?.startTime} → 새 시간을 선택하세요.
      </p>
      <OverrideFields override={override} setOverride={setOverride} reason={reason} setReason={setReason} reasonRequired />
      {failCode && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode)}</p>}
      <AdminSlotGrid
        slots={slots}
        slotCounts={slotCounts}
        programId={reservation.programId}
        studentReservations={reservations.filter((r) => r.studentId === reservation.studentId)}
        userNames={userNames}
        onPick={pick}
      />
    </ModalShell>
  )
}
