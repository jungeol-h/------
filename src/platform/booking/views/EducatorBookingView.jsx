// 강사(instructor·consultant·manager) 예약관리 화면 — 내부 4메뉴(?menu= 딥링크,
// WorkRecordsTab 선례): 내 슬롯 · 출결 · 상담기록 · 그룹상담.
// 강사는 자신의 슬롯만 본다(BookingContext가 educator_id로 스코프 fetch).

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useBooking } from '../BookingContext.jsx'
import { addDaysStr, todayStrKst } from '../bookingRules.js'
import { todayStr } from '../../utils/dateUtils.js'
import {
  SLOT_STATUS, ATTENDANCE_STATUS, ATTENDANCE_CHOICES,
  reservationDisplayStatus, recordState, RECORD_STATE, attendanceDeadlinePassed,
} from '../bookingStatus.js'
import { bookingMessage } from '../bookingMessages.js'
import BookingNotificationsBell from '../components/BookingNotificationsBell.jsx'
import SlotEditorModal from '../components/SlotEditorModal.jsx'
import TimetableWizard from '../components/TimetableWizard.jsx'
import AvailabilityRulesSection from '../components/AvailabilityRulesSection.jsx'
import RecordFormModal from '../components/RecordFormModal.jsx'
import GroupAssignModal from '../components/GroupAssignModal.jsx'

const MENUS = [
  { key: 'slots', label: '내 슬롯' },
  { key: 'attendance', label: '출결' },
  { key: 'records', label: '상담기록' },
  { key: 'group', label: '그룹상담' },
]

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function dowOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAY[new Date(y, m - 1, d).getDay()]
}

// 새 예약 가능 슬롯 등록 (명세 3.3 — 강사의 예약 가능 슬롯 등록)
function NewSlotModal({ programs, subjects, educatorId, onClose }) {
  const { createSlot } = useBooking()
  const [form, setForm] = useState({
    programId: programs[0]?.id ?? '',
    subjectId: null,
    date: todayStr(),
    startTime: '16:00',
    capacity: null,
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const program = programs.find((p) => p.id === form.programId)
  const subjectOptions = subjects.filter((s) => s.programId === form.programId && s.active)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async () => {
    if (!program || busy) return
    const [h, m] = form.startTime.split(':').map(Number)
    const total = h * 60 + m + program.slotMinutes
    const endTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    setBusy(true)
    setError(null)
    try {
      await createSlot({
        programId: program.id,
        educatorId,
        subjectId: program.usesSubject ? form.subjectId ?? subjectOptions[0]?.id ?? null : null,
        date: form.date,
        startTime: form.startTime,
        endTime,
        capacity: Number(form.capacity) || program.defaultCapacity,
        status: 'open',
        isPublic: true,
        note: form.note,
      })
      onClose()
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="예약 가능 시간 추가" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 col-span-2">
          프로그램
          <select value={form.programId} onChange={set('programId')} className={`${FIELD} w-full mt-1`}>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {program?.usesSubject && (
          <label className="text-xs text-gray-500 col-span-2">
            교과
            <select value={form.subjectId ?? ''} onChange={set('subjectId')} className={`${FIELD} w-full mt-1`}>
              {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs text-gray-500">
          날짜
          <input type="date" value={form.date} onChange={set('date')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          시작 ({program?.slotMinutes ?? ''}분)
          <input type="time" value={form.startTime} onChange={set('startTime')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          정원 (기본 {program?.defaultCapacity ?? 1})
          <input type="number" min="1" value={form.capacity ?? ''} onChange={set('capacity')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          비고
          <input type="text" value={form.note} onChange={set('note')} className={`${FIELD} w-full mt-1`} />
        </label>
      </div>
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !program}
        className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '저장 중...' : '추가'}
      </button>
    </ModalShell>
  )
}

export default function EducatorBookingView({ isAdmin = false }) {
  const { currentUser } = useAuth()
  const booking = useBooking()
  const { config, slots, reservations, records, userNames, setAttendance } = booking
  const [searchParams, setSearchParams] = useSearchParams()

  const rawMenu = searchParams.get('menu')
  const menu = MENUS.some((m) => m.key === rawMenu) ? rawMenu : 'slots'
  const selectMenu = (key) => setSearchParams({ menu: key }, { replace: true })

  const [weekStart, setWeekStart] = useState(() => {
    // 이번 주 월요일
    const now = new Date()
    const day = now.getDay()
    return addDaysStr(todayStr(), day === 0 ? -6 : 1 - day)
  })
  const [attDate, setAttDate] = useState(todayStr())
  const [editSlot, setEditSlot] = useState(null)
  const [recordTarget, setRecordTarget] = useState(null)
  const [newSlotOpen, setNewSlotOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [groupModal, setGroupModal] = useState(null) // { program, existingSlot? }
  const [attFail, setAttFail] = useState(null)

  const myId = currentUser?.id
  const myProgramIds = useMemo(
    () => new Set(config.educators.filter((e) => e.educatorId === myId && e.active).map((e) => e.programId)),
    [config.educators, myId],
  )
  const myPrograms = useMemo(
    () => config.programs.filter((p) => p.active && (myProgramIds.has(p.id) || isAdmin)),
    [config.programs, myProgramIds, isAdmin],
  )
  const groupPrograms = myPrograms.filter((p) => p.allowGroup)

  const programOf = (id) => config.programs.find((p) => p.id === id)
  const subjectName = (id) => config.subjects.find((s) => s.id === id)?.name ?? ''
  const studentName = (id) => userNames[id]?.name ?? id

  const confirmedOf = (slotId) => reservations.filter((r) => r.slotId === slotId && r.status === 'confirmed')

  // 미처리 배지 카운트
  const today = todayStrKst()
  const pendingAttendance = useMemo(
    () => reservations.filter((r) =>
      r.status === 'confirmed' && r.attendanceStatus === 'pending' && r.slot && r.slot.date < today),
    [reservations, today],
  )
  const recordTargets = useMemo(
    () => reservations
      .filter((r) => r.status === 'confirmed' && r.attendanceStatus === 'attended' && r.slot)
      .sort((a, b) => (a.slot.date < b.slot.date ? 1 : -1)),
    [reservations],
  )
  const unwrittenRecords = recordTargets.filter((r) => {
    const state = recordState(r, records.find((x) => x.reservationId === r.id), r.slot.date)
    return state !== 'done' && state !== 'done_overdue' && state !== 'not_required'
  })

  const badge = (n, danger = false) => n > 0 && (
    <span className={`ml-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] text-white inline-flex items-center justify-center ${danger ? 'bg-red-500' : 'bg-orange-400'}`}>
      {n}
    </span>
  )

  // ─── 내 슬롯 (주간) ─────────────────────────────────────────
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i)),
    [weekStart],
  )
  const weekSlots = useMemo(
    () => slots
      .filter((s) => s.date >= weekDates[0] && s.date <= weekDates[6])
      .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1)),
    [slots, weekDates],
  )

  const renderSlots = () => (
    <div className="space-y-3">
      {/* 선언 패러다임 — 주간 가용시간이 기본, 아래 주간 목록은 파생 결과의 달력 뷰 */}
      <AvailabilityRulesSection educatorId={isAdmin ? null : myId} />

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={() => setWeekStart(addDaysStr(weekStart, -7))} className="p-2 rounded-lg bg-gray-100"><ChevronLeft size={16} /></button>
        <p className="text-sm font-bold text-gray-700">{weekDates[0]} ~ {weekDates[6]}</p>
        <button type="button" onClick={() => setWeekStart(addDaysStr(weekStart, 7))} className="p-2 rounded-lg bg-gray-100"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setNewSlotOpen(true)}
          className="h-10 rounded-xl border border-dashed border-blue-300 text-blue-600 text-xs font-bold flex items-center justify-center gap-1"
        >
          <Plus size={14} /> 시간 하나 추가
        </button>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="h-10 rounded-xl border border-dashed border-indigo-300 text-indigo-600 text-xs font-bold flex items-center justify-center gap-1"
        >
          <CalendarPlus size={14} /> 기간 한정 일괄 생성
        </button>
      </div>
      {weekDates.map((d) => {
        const daySlots = weekSlots.filter((s) => s.date === d)
        if (daySlots.length === 0) return null
        return (
          <div key={d} className="space-y-1.5">
            <h4 className="text-xs font-bold text-gray-400">{d} ({dowOf(d)})</h4>
            {daySlots.map((s) => {
              const booked = confirmedOf(s.id)
              const status = SLOT_STATUS[s.status]
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setEditSlot(s)}
                  className="w-full bg-white rounded-xl shadow-sm p-3 text-left flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {s.startTime}~{s.endTime}
                      <span className="ml-1.5 text-xs font-semibold text-gray-500">{programOf(s.programId)?.name}</span>
                      {s.subjectId && <span className="ml-1 text-xs text-emerald-600">{subjectName(s.subjectId)}</span>}
                      {s.ruleId && <span className="ml-1 text-[10px] font-bold text-indigo-400">자동</span>}
                      {!s.isPublic && <span className="ml-1 text-[10px] text-gray-400">비공개</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {booked.length}/{s.capacity}명
                      {booked.length > 0 && ` · ${booked.map((r) => studentName(r.studentId)).join(', ')}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${status?.color}`}>
                    {status?.label}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
      {weekSlots.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">이번 주 슬롯이 없습니다.</p>
      )}
    </div>
  )

  // ─── 출결 ───────────────────────────────────────────────────
  const attReservations = useMemo(
    () => reservations
      .filter((r) => r.status === 'confirmed' && r.slot?.date === attDate)
      .sort((a, b) => (a.slot.startTime < b.slot.startTime ? -1 : 1)),
    [reservations, attDate],
  )

  // 슬롯 단위 묶음 — 그룹상담은 일괄 출결 버튼 노출 (명세 11.5)
  const attGroups = useMemo(() => {
    const bySlot = new Map()
    for (const r of attReservations) {
      if (!bySlot.has(r.slotId)) bySlot.set(r.slotId, [])
      bySlot.get(r.slotId).push(r)
    }
    return [...bySlot.values()]
  }, [attReservations])

  const markAttendance = async (r, status) => {
    setAttFail(null)
    const result = await setAttendance({ reservationId: r.id, status })
    if (!result?.ok) setAttFail(result?.code ?? 'ERROR')
  }

  // 일괄 출결 후 개별 수정 가능 (명세 11.5)
  const markAllAttendance = async (group, status) => {
    setAttFail(null)
    for (const r of group) {
      const result = await setAttendance({ reservationId: r.id, status })
      if (!result?.ok) {
        setAttFail(result?.code ?? 'ERROR')
        return
      }
    }
  }

  const renderAttendance = () => (
    <div className="space-y-3">
      {pendingAttendance.length > 0 && (
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-600">
          출결 미처리 {pendingAttendance.length}건 —{' '}
          {pendingAttendance.slice(0, 3).map((r) => `${r.slot.date} ${studentName(r.studentId)}`).join(', ')}
          {pendingAttendance.length > 3 && ' 외'}
          <button
            type="button"
            className="ml-2 font-bold underline"
            onClick={() => setAttDate(pendingAttendance[0].slot.date)}
          >
            이동
          </button>
        </div>
      )}
      <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className={`${FIELD} w-full`} />
      {attFail && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(attFail)}</p>}
      {attendanceDeadlinePassed(attDate) && (
        <p className="text-[11px] text-red-500">
          이 날짜의 출결 처리기한(다음 날 자정)이 지났습니다. 지금 입력하면 기한 초과 처리로 기록됩니다.
        </p>
      )}
      {attGroups.map((group) => (
        <div key={group[0].slotId} className="space-y-2">
          {group.length > 1 && (
            <div className="flex items-center justify-between rounded-xl bg-purple-50 px-3 py-2">
              <p className="text-xs font-bold text-purple-600">
                그룹상담 {group[0].slot.startTime}~{group[0].slot.endTime} · {group.length}명
              </p>
              <button
                type="button"
                onClick={() => markAllAttendance(group, 'attended')}
                className="px-2.5 h-8 rounded-lg bg-purple-600 text-white text-[11px] font-bold"
              >
                전원 참석 처리
              </button>
            </div>
          )}
          {group.map((r) => {
            const display = reservationDisplayStatus(r, r.slot)
            return (
              <div key={r.id} className="bg-white rounded-xl shadow-sm p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">
                    {r.slot.startTime}~{r.slot.endTime} {studentName(r.studentId)}
                    <span className="ml-1.5 text-xs font-semibold text-gray-500">{programOf(r.programId)?.name}</span>
                  </p>
                  <span className="text-[11px] font-bold text-gray-500">{display.label}{r.attendanceOverdue ? ' · 기한초과' : ''}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {ATTENDANCE_CHOICES.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => markAttendance(r, key)}
                      className={`px-2 h-8 rounded-lg text-[11px] font-bold border ${
                        r.attendanceStatus === key
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-500 border-gray-200'
                      }`}
                    >
                      {ATTENDANCE_STATUS[key].label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {attReservations.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">이 날짜에 예약이 없습니다.</p>
      )}
    </div>
  )

  // ─── 상담기록 ───────────────────────────────────────────────
  const renderRecords = () => (
    <div className="space-y-2">
      {recordTargets.map((r) => {
        const rec = records.find((x) => x.reservationId === r.id)
        const state = recordState(r, rec, r.slot.date)
        const stateInfo = RECORD_STATE[state]
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => setRecordTarget(r)}
            className="w-full bg-white rounded-xl shadow-sm p-3 text-left flex items-center justify-between gap-2"
          >
            <div>
              <p className="text-sm font-bold text-gray-900">{studentName(r.studentId)}
                <span className="ml-1.5 text-xs font-semibold text-gray-500">{programOf(r.programId)?.name}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{r.slot.date} {r.slot.startTime}~{r.slot.endTime}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${stateInfo?.color}`}>
              {stateInfo?.label}
            </span>
          </button>
        )
      })}
      {recordTargets.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">
          참석 처리된 상담이 없습니다. 출결을 먼저 처리해 주세요.
        </p>
      )}
    </div>
  )

  // ─── 그룹상담 ───────────────────────────────────────────────
  // 그룹 슬롯 판별: allow_group 프로그램 + 정원 2명 이상 (README 해석 결정)
  const groupSlots = slots
    .filter((s) => programOf(s.programId)?.allowGroup && s.capacity > 1)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const renderGroup = () => (
    <div className="space-y-3">
      {groupPrograms.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">
          그룹상담을 지원하는 담당 프로그램이 없습니다.
        </p>
      ) : (
        <>
          {groupPrograms.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setGroupModal({ program: p })}
              className="w-full h-10 rounded-xl border border-dashed border-blue-300 text-blue-600 text-xs font-bold flex items-center justify-center gap-1"
            >
              <Plus size={14} /> {p.name} 그룹 편성
            </button>
          ))}
          {groupSlots.map((s) => {
            const booked = confirmedOf(s.id)
            return (
              <div key={s.id} className="bg-white rounded-xl shadow-sm p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">
                    {s.date} {s.startTime}~{s.endTime}
                    {s.subjectId && <span className="ml-1 text-xs text-emerald-600">{subjectName(s.subjectId)}</span>}
                    {s.note && <span className="ml-1 text-xs text-gray-400">{s.note}</span>}
                  </p>
                  <span className="text-[11px] font-bold text-gray-500">{booked.length}/{s.capacity}명</span>
                </div>
                <p className="text-xs text-gray-500">
                  {booked.length > 0 ? booked.map((r) => studentName(r.studentId)).join(', ') : '배정된 학생 없음'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupModal({ program: programOf(s.programId), existingSlot: s })}
                    className="flex-1 h-8 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold"
                  >
                    학생 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSlot(s)}
                    className="flex-1 h-8 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold"
                  >
                    슬롯 편집
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1 flex-1">
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
              {m.key === 'attendance' && badge(pendingAttendance.length, true)}
              {m.key === 'records' && badge(unwrittenRecords.length)}
            </button>
          ))}
        </div>
        <BookingNotificationsBell />
      </div>

      {menu === 'slots' && renderSlots()}
      {menu === 'attendance' && renderAttendance()}
      {menu === 'records' && renderRecords()}
      {menu === 'group' && renderGroup()}

      {editSlot && (
        <SlotEditorModal
          slot={editSlot}
          program={programOf(editSlot.programId)}
          isAdmin={isAdmin}
          onClose={() => setEditSlot(null)}
        />
      )}
      {recordTarget && (
        <RecordFormModal
          reservation={recordTarget}
          record={records.find((x) => x.reservationId === recordTarget.id)}
          studentName={studentName(recordTarget.studentId)}
          programName={programOf(recordTarget.programId)?.name ?? ''}
          groupMembers={recordTargets
            .filter((x) => x.slotId === recordTarget.slotId && x.id !== recordTarget.id)
            .map((x) => ({
              reservation: x,
              record: records.find((rr) => rr.reservationId === x.id),
              name: studentName(x.studentId),
            }))}
          onClose={() => setRecordTarget(null)}
        />
      )}
      {newSlotOpen && (
        <NewSlotModal
          programs={myPrograms}
          subjects={config.subjects}
          educatorId={myId}
          onClose={() => setNewSlotOpen(false)}
        />
      )}
      {wizardOpen && (
        <TimetableWizard
          lockEducatorId={isAdmin ? null : myId}
          onClose={() => setWizardOpen(false)}
        />
      )}
      {groupModal && (
        <GroupAssignModal
          program={groupModal.program}
          educatorId={myId}
          subjectOptions={config.subjects.filter((s) => s.programId === groupModal.program.id && s.active)}
          existingSlot={groupModal.existingSlot}
          onClose={() => setGroupModal(null)}
        />
      )}
    </div>
  )
}
