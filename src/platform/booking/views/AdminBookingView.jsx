// 관리자 예약 탭 — 내부 6메뉴(?menu= 딥링크, WorkRecordsTab 선례):
// 운영현황 · 내 슬롯 · 예약현황 · 타임테이블 · 프로그램 · 이력.
// 기존 admin 6탭은 건드리지 않고 7번째 탭으로 격리 (회귀 0 원칙).
// '내 슬롯'은 관리자가 직접 상담을 진행하는 경우(예: 황광희 원장)를 위한
// 본인 슬롯 뷰 + 강사지정예약 (2026-07-31 클라이언트 요청) — MySlotsPanel 공용.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
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
import AvailabilityRulesSection from '../components/AvailabilityRulesSection.jsx'
import OpenPeriodEditor from '../components/OpenPeriodEditor.jsx'
import SlotEditorModal from '../components/SlotEditorModal.jsx'
import MySlotsPanel from '../components/MySlotsPanel.jsx'

const MENUS = [
  { key: 'ops', label: '운영현황' },
  { key: 'myslots', label: '내 슬롯' },
  { key: 'reservations', label: '예약현황' },
  { key: 'timetable', label: '타임테이블' },
  { key: 'programs', label: '프로그램' },
  { key: 'audit', label: '이력' },
]

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'
// admin도 강사로 배정될 수 있다 (예: 황광희 원장이 직접 상담 진행)
const EDUCATOR_ROLES = ['manager', 'instructor', 'consultant', 'admin']

// ─── 타임테이블 메뉴: 시간 축 전용 — 강사 예약 가능 시간 + 슬롯 목록.
//     접수제 슬롯 준비(상품 축 캠페인)는 프로그램 메뉴의 해당 카드에 있다.
//     슬롯 목록은 날짜 그룹 접기 — 롤링 파생으로 항상 수백 슬롯이 깔려 있어
//     평면 카드 나열은 못 읽는다. 날짜 헤더가 요약이자 그날 전체 선택 단위
//     ("8월 첫 주만 공개" 같은 부분 일괄 작업이 헤더 체크 몇 번으로 끝난다). ──

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const dowOf = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAY[new Date(y, m - 1, d).getDay()]
}

const timeToMin = (t) => {
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + m
}

// 점유율 스트립 — 접힌 날짜 행에서 "하루의 모양"(어느 시간대가 열렸고 찼는지)을
// 숫자 없이 전달한다 (출결 TodayTimeline의 비율 막대 관용구 승계).
// 색 = 상태(칩과 같은 색 계열), 위치·폭 = 실제 시간 비례. 여러 강사의 슬롯이
// 같은 시간에 겹치면 늦게 칠한 쪽이 보인다 — open을 맨 위로 칠해 "공개가 있다"가
// 이기게 하고, 강사 필터를 걸면 그 강사의 정확한 하루가 된다.
const STRIP_COLOR = {
  draft: 'bg-gray-300',
  reviewed: 'bg-yellow-400',
  open: 'bg-green-500',
  openFull: 'bg-green-800', // 파생: 공개인데 정원 마감
  closed: 'bg-orange-400',
  done: 'bg-gray-400',
  cancelled: 'bg-red-300',
}
const STRIP_PAINT_ORDER = ['cancelled', 'done', 'draft', 'reviewed', 'closed', 'open']

function DayOccupancyStrip({ group, isFull }) {
  const start = timeToMin(group.dayStart)
  const span = Math.max(timeToMin(group.dayEnd) - start, 1)
  const segments = [...group.slots].sort(
    (a, b) => STRIP_PAINT_ORDER.indexOf(a.status) - STRIP_PAINT_ORDER.indexOf(b.status),
  )
  return (
    <span className="flex items-center gap-1.5 mt-1.5">
      <span className="text-[9px] text-gray-400 tabular-nums flex-shrink-0">{group.dayStart}</span>
      <span className="relative flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        {segments.map((s) => {
          const color = s.status === 'open' && isFull(s) ? STRIP_COLOR.openFull : STRIP_COLOR[s.status]
          return (
            <i
              key={s.id}
              className={`absolute top-0 h-full ${color ?? 'bg-gray-300'}`}
              style={{
                left: `${((timeToMin(s.startTime) - start) / span) * 100}%`,
                width: `${((timeToMin(s.endTime) - timeToMin(s.startTime)) / span) * 100}%`,
              }}
            />
          )
        })}
      </span>
      <span className="text-[9px] text-gray-400 tabular-nums flex-shrink-0">{group.dayEnd}</span>
    </span>
  )
}

function TimetableMenu() {
  const { config, slots, reservations, userNames, setSlotStatus } = useBooking()
  const [filters, setFilters] = useState({
    programId: '', status: '', educatorId: '', from: todayStr(), to: addDaysStr(todayStr(), 30),
  })
  const [selected, setSelected] = useState(new Set())
  const [expanded, setExpanded] = useState(() => new Set()) // 펼친 날짜들 (기본 접힘)
  const [editSlot, setEditSlot] = useState(null)
  const [busy, setBusy] = useState(false)

  const setF = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))
  const programName = (id) => config.programs.find((p) => p.id === id)?.name ?? id
  const confirmedOf = (slotId) => reservations.filter((r) => r.slotId === slotId && r.status === 'confirmed').length

  // 강사 필터 선택지 — 현재 로드된 슬롯에 실제로 등장하는 강사만
  const educatorOptions = useMemo(
    () => [...new Set(slots.map((s) => s.educatorId).filter(Boolean))],
    [slots],
  )

  const filtered = useMemo(
    () => slots
      .filter((s) => {
        if (filters.programId && s.programId !== filters.programId) return false
        if (filters.status && s.status !== filters.status) return false
        if (filters.educatorId && s.educatorId !== filters.educatorId) return false
        if (filters.from && s.date < filters.from) return false
        if (filters.to && s.date > filters.to) return false
        return true
      })
      .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1)),
    [slots, filters],
  )

  // 날짜 그룹 + 헤더 요약(상태별 수·예약/정원 합)
  const dayGroups = useMemo(() => {
    const groups = []
    for (const s of filtered) {
      const last = groups[groups.length - 1]
      if (last && last.date === s.date) last.slots.push(s)
      else groups.push({ date: s.date, slots: [s] })
    }
    return groups.map((g) => {
      const byStatus = {}
      let booked = 0
      let capacity = 0
      let dayStart = g.slots[0].startTime
      let dayEnd = g.slots[0].endTime
      for (const s of g.slots) {
        byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
        booked += confirmedOf(s.id)
        capacity += s.capacity
        if (s.startTime < dayStart) dayStart = s.startTime
        if (s.endTime > dayEnd) dayEnd = s.endTime
      }
      return { ...g, byStatus, booked, capacity, dayStart, dayEnd }
    })
    // confirmedOf는 reservations 파생 — filtered와 함께 갱신되면 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, reservations])

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = () => setSelected((prev) =>
    prev.size === filtered.length ? new Set() : new Set(filtered.map((s) => s.id)))

  // 날짜 헤더 체크 — 그날 전부 선택돼 있으면 해제, 아니면 전부 선택
  const toggleDay = (group) => setSelected((prev) => {
    const next = new Set(prev)
    const allPicked = group.slots.every((s) => next.has(s.id))
    for (const s of group.slots) {
      if (allPicked) next.delete(s.id)
      else next.add(s.id)
    }
    return next
  })

  const toggleExpand = (date) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(date)) next.delete(date)
    else next.add(date)
    return next
  })

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
      {/* 상시 운영 = 강사 예약 가능 시간 (매주 반복 + 특정 날짜) — 단일 홈 */}
      <AvailabilityRulesSection />

      <p className="text-xs font-bold text-gray-400 pt-2">슬롯 목록</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={filters.programId} onChange={setF('programId')} className={FIELD}>
          <option value="">전체 프로그램</option>
          {config.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.status} onChange={setF('status')} className={FIELD}>
          <option value="">전체 상태</option>
          {Object.entries(SLOT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.educatorId} onChange={setF('educatorId')} className={`${FIELD} col-span-2`}>
          <option value="">전체 강사</option>
          {educatorOptions.map((eid) => (
            <option key={eid} value={eid}>{userNames[eid]?.name ?? eid}</option>
          ))}
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
            {SLOT_STATUS[status].label}(으)로
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {dayGroups.map((group) => {
          const isExpanded = expanded.has(group.date)
          const dayAllPicked = group.slots.every((s) => selected.has(s.id))
          const dayPickedCount = group.slots.filter((s) => selected.has(s.id)).length
          return (
            <div key={group.date} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-3">
                <input
                  type="checkbox"
                  checked={dayAllPicked}
                  onChange={() => toggleDay(group)}
                  aria-label={`${group.date} 전체 선택`}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand(group.date)}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900 whitespace-nowrap">
                      {group.date.slice(5).replace('-', '/')} ({dowOf(group.date)})
                    </span>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {group.slots.length}슬롯 · 예약 {group.booked}/{group.capacity}
                    </span>
                    <span className="flex items-center gap-1 flex-wrap min-w-0">
                      {Object.entries(group.byStatus).map(([status, count]) => (
                        <span
                          key={status}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${SLOT_STATUS[status]?.color ?? 'bg-gray-100 text-gray-500'}`}
                        >
                          {SLOT_STATUS[status]?.label ?? status} {count}
                        </span>
                      ))}
                    </span>
                    {dayPickedCount > 0 && !dayAllPicked && (
                      <span className="text-[10px] font-bold text-blue-500 whitespace-nowrap">{dayPickedCount}개 선택</span>
                    )}
                    <span className="ml-auto text-gray-300 flex-shrink-0">
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                  </span>
                  <DayOccupancyStrip
                    group={group}
                    isFull={(s) => confirmedOf(s.id) >= s.capacity}
                  />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-50 px-3 py-2 space-y-1">
                  {group.slots.map((s) => {
                    const status = SLOT_STATUS[s.status]
                    const booked = confirmedOf(s.id)
                    return (
                      <div key={s.id} className="flex items-center gap-2 py-1">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                        <button type="button" onClick={() => setEditSlot(s)} className="flex-1 text-left min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {s.startTime}~{s.endTime}
                            <span className="ml-1.5 font-semibold text-gray-500">{programName(s.programId)}</span>
                            {s.ruleId && <span className="ml-1 text-[10px] font-bold text-indigo-400">자동</span>}
                            {!s.isPublic && <span className="ml-1 text-[10px] text-gray-400">비공개</span>}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {userNames[s.educatorId]?.name ?? '강사 미지정'} · {booked}/{s.capacity}명
                          </p>
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${status?.color}`}>
                          {status?.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">조건에 맞는 슬롯이 없습니다.</p>
        )}
      </div>

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
  const [prebookProgram, setPrebookProgram] = useState(null) // 접수제 슬롯 준비 대상

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

            {/* 접수제 운영은 상품 축 — 오픈기간(접수 창구)과 슬롯 준비가 한 카드에서 세트로 */}
            {program.requiresOpenPeriod && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-gray-400">예약 오픈기간</p>
                <OpenPeriodEditor program={program} />
                <div className="rounded-xl bg-gray-50 p-3 flex items-center gap-2">
                  <p className="flex-1 text-[11px] text-gray-500">
                    접수기간에 풀 슬롯을 <b>작성중</b>으로 준비하고, 검토 후 타임테이블
                    메뉴의 슬롯 목록에서 접수 시작에 맞춰 일괄 공개하세요.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPrebookProgram(program)}
                    className="flex-shrink-0 px-3 h-8 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    <Plus size={12} /> 슬롯 준비
                  </button>
                </div>
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

      {prebookProgram && (
        <TimetableWizard
          intent="prebook"
          lockProgramId={prebookProgram.id}
          onClose={() => setPrebookProgram(null)}
        />
      )}
    </div>
  )
}

// 관리자 본인 슬롯 — 관리자 스코프 fetch(전 강사)를 본인 id로 걸러 강사와 같은 화면
function MySlotsMenu() {
  const { currentUser } = useAuth()
  const { config } = useBooking()
  // 관리자는 프로그램 배정과 무관하게 전체 활성 프로그램으로 지정 예약 가능
  const programs = useMemo(() => config.programs.filter((p) => p.active), [config.programs])
  return <MySlotsPanel educatorId={currentUser?.id} programs={programs} isAdmin />
}

export default function AdminBookingView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawMenu = searchParams.get('menu')
  const menu = MENUS.some((m) => m.key === rawMenu) ? rawMenu : 'ops'
  const selectMenu = (key) => setSearchParams({ menu: key }, { replace: true })

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-6 gap-1 rounded-xl bg-gray-100 p-1 flex-1">
          {MENUS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => selectMenu(m.key)}
              className={`h-10 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center whitespace-nowrap ${
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
      {menu === 'myslots' && <MySlotsMenu />}
      {menu === 'reservations' && <ReservationSearch />}
      {menu === 'timetable' && <TimetableMenu />}
      {menu === 'programs' && <ProgramsMenu />}
      {menu === 'audit' && <AuditLogList />}
    </div>
  )
}
