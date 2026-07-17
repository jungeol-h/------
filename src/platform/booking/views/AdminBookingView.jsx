// 관리자 예약 탭 — 내부 5메뉴(?menu= 딥링크, WorkRecordsTab 선례):
// 운영현황 · 예약현황 · 타임테이블 · 프로그램 · 이력.
// 기존 admin 6탭은 건드리지 않고 7번째 탭으로 격리 (회귀 0 원칙).

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useBooking } from '../BookingContext.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { addDaysStr } from '../bookingRules.js'
import { SLOT_STATUS } from '../bookingStatus.js'
import BookingNotificationsBell from '../components/BookingNotificationsBell.jsx'
import BookingOpsDashboard from '../components/BookingOpsDashboard.jsx'
import ReservationSearch from '../components/ReservationSearch.jsx'
import AuditLogList from '../components/AuditLogList.jsx'
import ProgramFormModal from '../components/ProgramFormModal.jsx'
import TimetableWizard from '../components/TimetableWizard.jsx'
import OpenPeriodEditor from '../components/OpenPeriodEditor.jsx'
import SlotEditorModal from '../components/SlotEditorModal.jsx'

const MENUS = [
  { key: 'ops', label: '운영현황' },
  { key: 'reservations', label: '예약현황' },
  { key: 'timetable', label: '타임테이블' },
  { key: 'programs', label: '프로그램' },
  { key: 'audit', label: '이력' },
]

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'
const EDUCATOR_ROLES = ['manager', 'instructor', 'consultant']

// ─── 타임테이블 메뉴: 슬롯 목록 + 일괄 상태 전환 ────────────────
function TimetableMenu() {
  const { config, slots, reservations, userNames, setSlotStatus } = useBooking()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [filters, setFilters] = useState({
    programId: '', status: '', from: todayStr(), to: addDaysStr(todayStr(), 30),
  })
  const [selected, setSelected] = useState(new Set())
  const [editSlot, setEditSlot] = useState(null)
  const [busy, setBusy] = useState(false)

  const setF = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))
  const programName = (id) => config.programs.find((p) => p.id === id)?.name ?? id
  const confirmedOf = (slotId) => reservations.filter((r) => r.slotId === slotId && r.status === 'confirmed').length

  const filtered = useMemo(
    () => slots
      .filter((s) => {
        if (filters.programId && s.programId !== filters.programId) return false
        if (filters.status && s.status !== filters.status) return false
        if (filters.from && s.date < filters.from) return false
        if (filters.to && s.date > filters.to) return false
        return true
      })
      .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1)),
    [slots, filters],
  )

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = () => setSelected((prev) =>
    prev.size === filtered.length ? new Set() : new Set(filtered.map((s) => s.id)))

  const bulkTransition = async (status) => {
    if (selected.size === 0 || busy) return
    setBusy(true)
    try {
      await setSlotStatus({ slotIds: [...selected], status })
      setSelected(new Set())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setWizardOpen(true)}
        className="w-full h-10 rounded-xl border border-dashed border-blue-300 text-blue-600 text-xs font-bold flex items-center justify-center gap-1"
      >
        <Plus size={14} /> 타임테이블 생성
      </button>

      <div className="grid grid-cols-2 gap-2">
        <select value={filters.programId} onChange={setF('programId')} className={FIELD}>
          <option value="">전체 프로그램</option>
          {config.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.status} onChange={setF('status')} className={FIELD}>
          <option value="">전체 상태</option>
          {Object.entries(SLOT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={setF('from')} className={FIELD} />
        <input type="date" value={filters.to} onChange={setF('to')} className={FIELD} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={filtered.length > 0 && selected.size === filtered.length}
            onChange={toggleAll}
          />
          전체 선택 ({selected.size}/{filtered.length})
        </label>
        {['reviewed', 'open', 'closed', 'done'].map((status) => (
          <button
            key={status}
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={() => bulkTransition(status)}
            className="px-2.5 h-8 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold disabled:opacity-40"
          >
            {SLOT_STATUS[status].label}로
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {filtered.map((s) => {
          const status = SLOT_STATUS[s.status]
          const booked = confirmedOf(s.id)
          return (
            <div key={s.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-2">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <button type="button" onClick={() => setEditSlot(s)} className="flex-1 text-left min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {s.date} {s.startTime}~{s.endTime}
                  <span className="ml-1.5 font-semibold text-gray-500">{programName(s.programId)}</span>
                  {!s.isPublic && <span className="ml-1 text-[10px] text-gray-400">비공개</span>}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {userNames[s.educatorId]?.name ?? '강사 미지정'} · {booked}/{s.capacity}명
                </p>
              </button>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${status?.color}`}>
                {status?.label}
              </span>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">조건에 맞는 슬롯이 없습니다.</p>
        )}
      </div>

      {wizardOpen && <TimetableWizard onClose={() => setWizardOpen(false)} />}
      {editSlot && (
        <SlotEditorModal
          slot={editSlot}
          program={config.programs.find((p) => p.id === editSlot.programId)}
          isAdmin
          onClose={() => setEditSlot(null)}
        />
      )}
    </div>
  )
}

// ─── 프로그램 메뉴: 프로그램·교과·강사배정·오픈기간 ─────────────
function ProgramsMenu() {
  const { data } = useData()
  const booking = useBooking()
  const { config, userNames, createSubject, updateSubject, assignEducator, removeEducator } = booking
  const [editProgram, setEditProgram] = useState(null)
  const [creating, setCreating] = useState(false)
  const [subjectInputs, setSubjectInputs] = useState({})
  const [assignForm, setAssignForm] = useState({})

  // DataContext에는 users 키가 없다 — 교직원은 educators 컬렉션 (admin fetch가 채움)
  const educatorUsers = useMemo(
    () => (data.educators ?? []).filter((u) => EDUCATOR_ROLES.includes(u.role) && u.status !== 'inactive'),
    [data.educators],
  )

  const addSubject = async (program) => {
    const name = (subjectInputs[program.id] ?? '').trim()
    if (!name) return
    await createSubject({ programId: program.id, name })
    setSubjectInputs((m) => ({ ...m, [program.id]: '' }))
  }

  const addEducator = async (program) => {
    const form = assignForm[program.id]
    if (!form?.educatorId) return
    await assignEducator({
      programId: program.id,
      educatorId: form.educatorId,
      subjectId: form.subjectId || null,
    })
    setAssignForm((m) => ({ ...m, [program.id]: { educatorId: '', subjectId: '' } }))
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="w-full h-10 rounded-xl border border-dashed border-blue-300 text-blue-600 text-xs font-bold flex items-center justify-center gap-1"
      >
        <Plus size={14} /> 프로그램 등록
      </button>

      {config.programs.map((program) => {
        const subjects = config.subjects.filter((s) => s.programId === program.id)
        const assigned = config.educators.filter((e) => e.programId === program.id)
        const form = assignForm[program.id] ?? { educatorId: '', subjectId: '' }
        return (
          <div key={program.id} className={`bg-white rounded-2xl shadow-sm p-4 space-y-3 ${program.active ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {program.name}
                  {!program.active && <span className="ml-1.5 text-[10px] text-gray-400">비활성</span>}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {program.slotMinutes}분 · 정원 {program.defaultCapacity} · 하루 {program.dailyLimit}회
                  {program.allowConsecutive ? '' : ' · 연속금지'}
                  {program.requiresOpenPeriod ? ' · 사전예약' : ' · 수시예약'}
                  {' · '}
                  {program.targetGroupNames.length > 0 ? program.targetGroupNames.join('/') : '전체 그룹'}
                </p>
              </div>
              <button type="button" onClick={() => setEditProgram(program)} className="p-1.5 text-gray-400 hover:text-blue-600" aria-label="프로그램 수정">
                <Pencil size={15} />
              </button>
            </div>

            {program.usesSubject && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-gray-400">교과</p>
                <div className="flex gap-1.5 flex-wrap">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateSubject(s.id, { active: !s.active })}
                      className={`px-2.5 h-7 rounded-full text-[11px] font-bold border ${
                        s.active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                      }`}
                      title="클릭하여 활성/비활성 전환"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={subjectInputs[program.id] ?? ''}
                    onChange={(e) => setSubjectInputs((m) => ({ ...m, [program.id]: e.target.value }))}
                    placeholder="교과명 (예: 과학)"
                    className={`${FIELD} flex-1`}
                  />
                  <button type="button" onClick={() => addSubject(program)} className="px-3 h-10 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">추가</button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-gray-400">담당 강사</p>
              {assigned.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <span>
                    {userNames[e.educatorId]?.name ?? e.educatorId}
                    {e.subjectId && ` · ${config.subjects.find((s) => s.id === e.subjectId)?.name ?? ''}`}
                  </span>
                  <button type="button" onClick={() => removeEducator(e.id)} className="text-gray-400 hover:text-red-500" aria-label="배정 해제">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <select
                  value={form.educatorId}
                  onChange={(e) => setAssignForm((m) => ({ ...m, [program.id]: { ...form, educatorId: e.target.value } }))}
                  className={`${FIELD} flex-1`}
                >
                  <option value="">강사 선택</option>
                  {educatorUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
                {program.usesSubject && (
                  <select
                    value={form.subjectId}
                    onChange={(e) => setAssignForm((m) => ({ ...m, [program.id]: { ...form, subjectId: e.target.value } }))}
                    className={`${FIELD} w-24`}
                  >
                    <option value="">교과</option>
                    {subjects.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <button type="button" onClick={() => addEducator(program)} className="px-3 h-10 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">배정</button>
              </div>
            </div>

            {program.requiresOpenPeriod && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-gray-400">예약 오픈기간</p>
                <OpenPeriodEditor program={program} />
              </div>
            )}
          </div>
        )
      })}

      {(creating || editProgram) && (
        <ProgramFormModal
          program={editProgram}
          onClose={() => { setCreating(false); setEditProgram(null) }}
        />
      )}
    </div>
  )
}

export default function AdminBookingView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawMenu = searchParams.get('menu')
  const menu = MENUS.some((m) => m.key === rawMenu) ? rawMenu : 'ops'
  const selectMenu = (key) => setSearchParams({ menu: key }, { replace: true })

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1 flex-1">
          {MENUS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => selectMenu(m.key)}
              className={`h-10 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center ${
                menu === m.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <BookingNotificationsBell />
      </div>

      {menu === 'ops' && <BookingOpsDashboard />}
      {menu === 'reservations' && <ReservationSearch />}
      {menu === 'timetable' && <TimetableMenu />}
      {menu === 'programs' && <ProgramsMenu />}
      {menu === 'audit' && <AuditLogList />}
    </div>
  )
}
