// 강사(instructor·consultant·manager) 예약관리 화면 — 내부 4메뉴(?menu= 딥링크,
// WorkRecordsTab 선례): 내 슬롯 · 예약현황 · 상담기록 · 그룹상담.
// 강사는 자신의 슬롯만 본다(BookingContext가 educator_id로 스코프 fetch).
// '예약현황'(구 출결)은 관리자 예약현황(ReservationSearch)을 그대로 재사용해
// 출결·변경·취소를 강사가 직접 처리한다 — 2026-08-31 클라이언트 요청. 참석 처리
// 후 상담기록 연결·그룹 전원 참석은 AttendanceProcessModal에 내장.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useBooking } from '../BookingContext.jsx'
import { addDaysStr, todayStrKst } from '../bookingRules.js'
import { todayStr } from '../../utils/dateUtils.js'
import { recordState, RECORD_STATE } from '../bookingStatus.js'
import BookingNotificationsBell from '../components/BookingNotificationsBell.jsx'
import SlotEditorModal from '../components/SlotEditorModal.jsx'
import MySlotsPanel from '../components/MySlotsPanel.jsx'
import RecordFormModal from '../components/RecordFormModal.jsx'
import GroupAssignModal from '../components/GroupAssignModal.jsx'
import ReservationSearch from '../components/ReservationSearch.jsx'

const MENUS = [
  { key: 'slots', label: '내 슬롯' },
  { key: 'attendance', label: '예약현황' },
  { key: 'records', label: '상담기록' },
  { key: 'group', label: '그룹상담' },
]

export default function EducatorBookingView({ isAdmin = false }) {
  const { currentUser } = useAuth()
  const booking = useBooking()
  const { config, slots, reservations, records, userNames } = booking
  const [searchParams, setSearchParams] = useSearchParams()

  const rawMenu = searchParams.get('menu')
  const menu = MENUS.some((m) => m.key === rawMenu) ? rawMenu : 'slots'
  const selectMenu = (key) => setSearchParams({ menu: key }, { replace: true })

  const [editSlot, setEditSlot] = useState(null)
  const [recordTarget, setRecordTarget] = useState(null)
  const [groupModal, setGroupModal] = useState(null) // { program, existingSlot? }
  // 미처리 배너 '미처리 건 보기' — 증가할 때마다 ReservationSearch를 미처리 필터로 리마운트
  const [pendingFocus, setPendingFocus] = useState(0)

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

  // ─── 예약현황 (구 출결) ─────────────────────────────────────
  // 목록·필터·출결/변경/취소·상담기록 연결은 전부 ReservationSearch 재사용.
  // 미처리 배너의 '미처리 건 보기'는 fetch 범위(과거 60일) 전체를 미처리 필터로 연다.
  const renderReservations = () => (
    <div className="space-y-3">
      {pendingAttendance.length > 0 && (
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-600">
          출결 미처리 {pendingAttendance.length}건 —{' '}
          {pendingAttendance.slice(0, 3).map((r) => `${r.slot.date} ${studentName(r.studentId)}`).join(', ')}
          {pendingAttendance.length > 3 && ' 외'}
          <button
            type="button"
            className="ml-2 font-bold underline"
            onClick={() => setPendingFocus((n) => n + 1)}
          >
            미처리 건 보기
          </button>
        </div>
      )}
      <ReservationSearch
        key={`res-${pendingFocus}`}
        canProxy={false}
        showEducatorFilter={false}
        initialFilters={pendingFocus > 0
          ? { from: addDaysStr(todayStr(), -60), to: todayStr(), status: 'confirmed', attendance: 'pending' }
          : undefined}
      />
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
      {menu === 'attendance' && renderReservations()}
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
