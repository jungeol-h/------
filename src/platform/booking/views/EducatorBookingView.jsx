// 강사(instructor·consultant·manager) 예약관리 화면 — 내부 4메뉴(?menu= 딥링크,
// WorkRecordsTab 선례): 내 슬롯 · 출결 · 상담기록 · 그룹상담.
// 강사는 자신의 슬롯만 본다(BookingContext가 educator_id로 스코프 fetch).

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useBooking } from '../BookingContext.jsx'
import { todayStrKst } from '../bookingRules.js'
import { todayStr } from '../../utils/dateUtils.js'
import {
  ATTENDANCE_STATUS, ATTENDANCE_CHOICES,
  reservationDisplayStatus, recordState, RECORD_STATE, attendanceDeadlinePassed,
} from '../bookingStatus.js'
import { bookingMessage } from '../bookingMessages.js'
import BookingNotificationsBell from '../components/BookingNotificationsBell.jsx'
import SlotEditorModal from '../components/SlotEditorModal.jsx'
import MySlotsPanel from '../components/MySlotsPanel.jsx'
import RecordFormModal from '../components/RecordFormModal.jsx'
import GroupAssignModal from '../components/GroupAssignModal.jsx'

const MENUS = [
  { key: 'slots', label: '내 슬롯' },
  { key: 'attendance', label: '출결' },
  { key: 'records', label: '상담기록' },
  { key: 'group', label: '그룹상담' },
]

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

export default function EducatorBookingView({ isAdmin = false }) {
  const { currentUser } = useAuth()
  const booking = useBooking()
  const { config, slots, reservations, records, userNames, setAttendance } = booking
  const [searchParams, setSearchParams] = useSearchParams()

  const rawMenu = searchParams.get('menu')
  const menu = MENUS.some((m) => m.key === rawMenu) ? rawMenu : 'slots'
  const selectMenu = (key) => setSearchParams({ menu: key }, { replace: true })

  const [attDate, setAttDate] = useState(todayStr())
  const [editSlot, setEditSlot] = useState(null)
  const [recordTarget, setRecordTarget] = useState(null)
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

      {menu === 'slots' && <MySlotsPanel educatorId={myId} programs={myPrograms} isAdmin={isAdmin} />}
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
