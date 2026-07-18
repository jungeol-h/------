// 학생·학부모 공용 예약 화면 — 예약 대상은 항상 학생(student prop)이며,
// 학부모가 써도 제한은 학생 기준으로 통합 적용된다 (명세 3.2·7.1).
// 사전 검증(bookingRules)과 RPC가 같은 코드 체계 → 어느 쪽에서 거절돼도 동일 안내문.

import { useMemo, useState } from 'react'
import { CalendarPlus, ListChecks } from 'lucide-react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { useBooking } from '../BookingContext.jsx'
import { validateReserve, validateChange, deadlineOk, isTargetGroup, changeDeadlineLabel } from '../bookingRules.js'
import { bookingMessage, immediateLockWarning } from '../bookingMessages.js'
import BookingNotificationsBell from '../components/BookingNotificationsBell.jsx'
import MyReservationList from '../components/MyReservationList.jsx'
import WeeklySlotPicker from '../components/WeeklySlotPicker.jsx'

export default function StudentBookingView({ student }) {
  const booking = useBooking()
  const { config, slots, reservations, slotCounts, userNames, reserve, change } = booking

  const [tab, setTab] = useState('book') // 'book' | 'mine'
  const [programId, setProgramId] = useState(null)
  const [subjectId, setSubjectId] = useState(null)
  const [educatorId, setEducatorId] = useState(null) // 담당 강사 필터 (명세 21.1)
  const [chooser, setChooser] = useState(null) // 같은 시간 복수 강사 선택 시트
  const [confirmSlot, setConfirmSlot] = useState(null)
  const [withNext, setWithNext] = useState(false) // 연속 2블록 예약 (명세 4.2)
  const [changing, setChanging] = useState(null) // 변경 중인 기존 예약
  const [failCode, setFailCode] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const myReservations = useMemo(
    () => reservations.filter((r) => r.studentId === student.id),
    [reservations, student.id],
  )

  // 내 그룹 대상 프로그램만 노출 (명세 확정 결정 2)
  const visiblePrograms = useMemo(
    () => config.programs.filter((p) => p.active && isTargetGroup(student.groups, p)),
    [config.programs, student.groups],
  )
  const program = visiblePrograms.find((p) => p.id === programId) ?? null
  const subjects = useMemo(
    () => (program?.usesSubject
      ? config.subjects.filter((s) => s.programId === program.id && s.active)
      : []),
    [config.subjects, program],
  )

  // 선택된 프로그램(·교과)의 공개 슬롯 → 날짜 목록·날짜별 슬롯
  const programSlots = useMemo(() => {
    if (!program) return []
    return slots.filter((s) =>
      s.programId === program.id &&
      s.status === 'open' && s.isPublic &&
      (!program.usesSubject || !subjectId || s.subjectId === subjectId) &&
      s.date >= todayStr(),
    )
  }, [slots, program, subjectId])

  // 담당 강사 선택지 (명세 21.1) — 선택된 프로그램의 공개 슬롯에 등장하는 강사
  const educatorOptions = useMemo(
    () => [...new Set(programSlots.map((s) => s.educatorId).filter(Boolean))],
    [programSlots],
  )
  const filteredSlots = useMemo(
    () => (educatorId ? programSlots.filter((s) => s.educatorId === educatorId) : programSlots),
    [programSlots, educatorId],
  )

  // 연속 2블록 후보 — 같은 강사·교과의 바로 다음 블록 (연속 허용 프로그램만, 명세 4.2)
  const nextSlot = useMemo(() => {
    if (!confirmSlot || !program?.allowConsecutive || program.dailyLimit < 2 || changing) return null
    const cand = programSlots.find((s) =>
      s.date === confirmSlot.date &&
      s.startTime === confirmSlot.endTime &&
      (s.educatorId ?? null) === (confirmSlot.educatorId ?? null) &&
      (s.subjectId ?? null) === (confirmSlot.subjectId ?? null))
    if (!cand) return null
    if ((slotCounts[cand.id] ?? 0) >= cand.capacity) return null
    if (myReservations.some((r) => r.slotId === cand.id && r.status === 'confirmed')) return null
    return cand
  }, [confirmSlot, program, changing, programSlots, slotCounts, myReservations])

  const ruleCtx = (slot) => ({
    program, slot,
    daySlots: programSlots.filter((s) => s.date === slot.date),
    openPeriods: config.openPeriods,
    studentGroups: student.groups ?? [],
    reservations: myReservations,
    slotCounts,
  })

  const submitReserve = async () => {
    if (!confirmSlot || busy) return
    setBusy(true)
    try {
      const result = changing
        ? await change({ reservationId: changing.id, newSlotId: confirmSlot.id })
        : await reserve({ slotId: confirmSlot.id, studentId: student.id })
      if (result?.ok) {
        // 연속 2블록 선택 시 다음 블록도 이어서 예약 (실패해도 첫 블록은 유지 — 안내만)
        if (withNext && nextSlot) {
          const second = await reserve({ slotId: nextSlot.id, studentId: student.id })
          if (!second?.ok) {
            setNotice(`첫 블록만 예약되었습니다 — 연속 블록(${nextSlot.startTime}~${nextSlot.endTime})은 예약하지 못했습니다: ${bookingMessage(second?.code, { program })}`)
          } else {
            setNotice(null)
          }
        } else {
          setNotice(null)
        }
        setConfirmSlot(null)
        setWithNext(false)
        setChanging(null)
        setFailCode(null)
        setTab('mine')
      } else {
        setFailCode(result?.code ?? 'ERROR')
      }
    } finally {
      setBusy(false)
    }
  }

  const startChange = (reservation) => {
    setChanging(reservation)
    setProgramId(reservation.programId)
    setSubjectId(reservation.slot?.subjectId ?? null)
    setFailCode(null)
    setTab('book')
  }

  const pickSlot = (slot) => {
    setFailCode(null)
    setNotice(null)
    setWithNext(false)
    setChooser(null)
    const check = changing
      ? validateChange({
          oldProgram: config.programs.find((p) => p.id === changing.programId) ?? program,
          oldSlot: changing.slot,
          reservationId: changing.id,
          ...ruleCtx(slot),
        })
      : validateReserve(ruleCtx(slot))
    if (!check.ok) {
      setFailCode(check.code)
      return
    }
    setConfirmSlot(slot)
  }

  const subjectName = (id) => config.subjects.find((s) => s.id === id)?.name ?? ''
  const educatorName = (id) => userNames[id]?.name ?? ''

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 flex-1 max-w-[260px]">
          {[['book', '예약하기', CalendarPlus], ['mine', '내 예약', ListChecks]].map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
                tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        <BookingNotificationsBell />
      </div>

      {changing && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 flex items-center justify-between">
          <span>
            변경할 새 시간을 선택하세요 — 기존:{' '}
            {changing.slot ? `${changing.slot.date} ${changing.slot.startTime}` : ''}
          </span>
          <button type="button" className="font-bold" onClick={() => setChanging(null)}>취소</button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-600 flex items-start justify-between gap-2">
          <span>{notice}</span>
          <button type="button" className="font-bold flex-shrink-0" onClick={() => setNotice(null)}>닫기</button>
        </div>
      )}

      {tab === 'mine' ? (
        <MyReservationList
          reservations={myReservations}
          programs={config.programs}
          subjects={config.subjects}
          userNames={userNames}
          onStartChange={startChange}
        />
      ) : (
        <>
          {/* 프로그램 선택 */}
          <div className="space-y-2">
            {visiblePrograms.length === 0 && (
              <p className="py-10 text-center text-sm text-gray-400">현재 예약 가능한 프로그램이 없습니다.</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {visiblePrograms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setProgramId(p.id); setSubjectId(null); setEducatorId(null); setFailCode(null) }}
                  className={`px-3 h-9 rounded-full text-xs font-bold border ${
                    program?.id === p.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {subjects.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubjectId(subjectId === s.id ? null : s.id)}
                    className={`px-3 h-8 rounded-full text-xs font-bold border ${
                      subjectId === s.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {/* 담당 강사 선택 (명세 21.1) — 강사가 2명 이상일 때만 노출 */}
            {program && educatorOptions.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setEducatorId(null)}
                  className={`px-3 h-8 rounded-full text-xs font-bold border ${
                    educatorId === null
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  전체 강사
                </button>
                {educatorOptions.map((eid) => (
                  <button
                    key={eid}
                    type="button"
                    onClick={() => setEducatorId(educatorId === eid ? null : eid)}
                    className={`px-3 h-8 rounded-full text-xs font-bold border ${
                      educatorId === eid
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {educatorName(eid) || eid}
                  </button>
                ))}
              </div>
            )}
          </div>

          {failCode && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600">
              {bookingMessage(failCode, { program, subjectName: subjectName(subjectId) })}
            </div>
          )}

          {/* 주간 타임테이블 — 셀 한 번 탭으로 예약 (되는시간식 그리드) */}
          {program && (
            filteredSlots.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">
                예약 가능한 일정이 아직 공개되지 않았습니다.
              </p>
            ) : (
              <WeeklySlotPicker
                slots={filteredSlots}
                slotCounts={slotCounts}
                myReservations={myReservations}
                onPick={pickSlot}
                onPickMany={setChooser}
              />
            )
          )}
        </>
      )}

      {/* 같은 시간 복수 강사 — 강사 선택 시트 */}
      {chooser && (
        <ModalShell title="선생님 선택" onClose={() => setChooser(null)}>
          <p className="text-xs text-gray-500">
            {chooser[0].date} {chooser[0].startTime}~{chooser[0].endTime} — 같은 시간에 여러 선생님이 있습니다.
          </p>
          <div className="space-y-1.5">
            {chooser.map((slot) => {
              const remaining = slot.capacity - (slotCounts[slot.id] ?? 0)
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => pickSlot(slot)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 flex items-center justify-between text-left"
                >
                  <span className="text-sm font-bold text-gray-900">
                    {educatorName(slot.educatorId) || '담당 미정'}
                    {slot.subjectId && (
                      <span className="ml-1.5 text-[11px] font-semibold text-emerald-600">{subjectName(slot.subjectId)}</span>
                    )}
                    {slot.capacity > 1 && (
                      <span className="ml-1.5 text-[10px] font-bold text-purple-500">그룹</span>
                    )}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">잔여 {remaining}</span>
                </button>
              )
            })}
          </div>
        </ModalShell>
      )}

      {/* 예약 확정 모달 */}
      {confirmSlot && program && (
        <ModalShell title={changing ? '예약 변경 확인' : '예약 확인'} onClose={() => setConfirmSlot(null)}>
          <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-1">
            <p className="font-bold text-gray-900">{program.name}
              {confirmSlot.subjectId && ` · ${subjectName(confirmSlot.subjectId)}`}
            </p>
            <p className="text-gray-600">
              {confirmSlot.date} {confirmSlot.startTime} ~ {withNext && nextSlot ? nextSlot.endTime : confirmSlot.endTime}
              {withNext && nextSlot && <span className="ml-1 text-xs text-blue-600">(연속 2블록)</span>}
            </p>
            <p className="text-gray-600">담당: {educatorName(confirmSlot.educatorId) || '미정'}</p>
            <p className="text-gray-600">학생: {student.name}</p>
            {deadlineOk(program, confirmSlot) && (
              <p className="text-gray-500 text-xs">온라인 변경·취소: {changeDeadlineLabel(program, confirmSlot)}</p>
            )}
          </div>
          {nextSlot && (
            <label className="flex items-center gap-2 text-sm text-gray-700 rounded-xl bg-blue-50 p-3">
              <input type="checkbox" checked={withNext} onChange={(e) => setWithNext(e.target.checked)} />
              다음 블록까지 연속 예약 ({confirmSlot.startTime}~{nextSlot.endTime}, 총 {program.slotMinutes * 2}분)
            </label>
          )}
          {!deadlineOk(program, confirmSlot) && (
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-600">
              {immediateLockWarning(program)}
            </div>
          )}
          {failCode && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600">
              {bookingMessage(failCode, { program, subjectName: subjectName(confirmSlot.subjectId) })}
            </div>
          )}
          <button
            type="button"
            onClick={submitReserve}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
          >
            {busy ? '처리 중...' : changing ? '이 시간으로 변경' : '예약 확정'}
          </button>
        </ModalShell>
      )}
    </div>
  )
}
