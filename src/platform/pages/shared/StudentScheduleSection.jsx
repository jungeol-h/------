// 학생 상세 '이용시간' 탭 — 센터 이용시간 등록 현황 + 예약 현황.
// "명단에서 클릭하면 첫 화면이 센터 이용시간 등록 상황이어야" 클라이언트 요청(2026-08).
// booking·centerHours 격리 모듈을 읽기 전용 lazy fetch (useTodayCenterSchedule 선례) —
// 어느 한쪽이 실패해도 그 카드만 에러로 표시하고 탭 전체는 깨지지 않는다.

import { useEffect, useState } from 'react'
import { Clock, CalendarCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { fetchStudentCenterHours, isMigrationMissing } from '../../centerHours/centerHoursApi.js'
import { fetchReservations, fetchBookingNameMaps } from '../../booking/bookingApi.js'
import { reservationDisplayStatus } from '../../booking/bookingStatus.js'
import { CENTER_WEEK_ORDER, CENTER_DAY_LABEL } from '../../data/centerHours.js'
import { educatorDisplayName } from '../../utils/educatorName.js'
import { todayStr } from '../../utils/dateUtils.js'

const PAST_PAGE = 20

// 상태 key → 배지 색 (bookingStatus.reservationDisplayStatus의 key 기준)
const STATUS_BADGE = {
  waiting: 'bg-blue-100 text-blue-700',
  attended: 'bg-emerald-100 text-emerald-700',
  absent: 'bg-red-100 text-red-600',
  attendance_pending: 'bg-red-100 text-red-600',
}
const STATUS_BADGE_DEFAULT = 'bg-gray-100 text-gray-500' // 취소류·변경완료

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}

// 1시간 단위 등록 행들 → 요일별 연속 구간 병합.
// 반환: [{ day, ranges: [{ start, end }] }] (월~일 순, 등록 있는 요일만)
function mergeByDay(rows) {
  const byDay = new Map()
  for (const r of rows) {
    if (!byDay.has(r.dayOfWeek)) byDay.set(r.dayOfWeek, [])
    byDay.get(r.dayOfWeek).push(r)
  }
  return CENTER_WEEK_ORDER.filter((d) => byDay.has(d)).map((day) => {
    const units = byDay.get(day).slice().sort((a, b) => (a.startTime < b.startTime ? -1 : 1))
    const ranges = []
    for (const u of units) {
      const last = ranges[ranges.length - 1]
      if (last && last.end === u.startTime) last.end = u.endTime
      else ranges.push({ start: u.startTime, end: u.endTime })
    }
    return { day, ranges }
  })
}

// 주간 총 등록 시간(분) — 단위 행 합산
const weeklyMinutes = (rows) =>
  rows.reduce((sum, r) => sum + (toMinutes(r.endTime) - toMinutes(r.startTime)), 0)

function weeklyTotalLabel(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `주 ${m}분`
  return m === 0 ? `주 ${h}시간` : `주 ${h}시간 ${m}분`
}

// 'YYYY-MM-DD' → 'M/D(요일)' — 로컬 파싱(dateUtils 규약: UTC 절단 금지)
function dateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getMonth() + 1}/${d.getDate()}(${CENTER_DAY_LABEL[d.getDay()]})`
}

// ─── 카드 1: 센터 이용시간 등록 현황 ──────────────────────────
function CenterHoursCard({ state, onRetry }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
          <Clock size={15} className="text-indigo-500" /> 센터 이용시간 등록 현황
        </h4>
        {!state.loading && !state.error && !state.migrationMissing && state.rows.length > 0 && (
          <span className="text-xs font-bold text-indigo-600">
            {weeklyTotalLabel(weeklyMinutes(state.rows))}
          </span>
        )}
      </div>

      {state.loading ? (
        <p className="text-sm text-gray-300 text-center py-4">이용시간 데이터 불러오는 중...</p>
      ) : state.migrationMissing ? (
        <p className="text-sm text-gray-400 text-center py-4">
          센터 이용시간 기능이 아직 준비되지 않았습니다. (DB 마이그레이션 미적용)
        </p>
      ) : state.error ? (
        <p className="text-sm text-gray-400 text-center py-4">
          센터 이용시간 데이터를 불러오지 못했습니다.
          <button onClick={onRetry} className="ml-2 text-indigo-500 font-bold">다시 시도</button>
        </p>
      ) : state.rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">등록된 센터 이용시간이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {mergeByDay(state.rows).map(({ day, ranges }) => (
            <div key={day} className="flex items-start gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {CENTER_DAY_LABEL[day]}
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ranges.map((r) => (
                  <span
                    key={r.start}
                    className="text-xs font-semibold text-gray-700 bg-gray-100 rounded-full px-2.5 py-0.5"
                  >
                    {r.start}~{r.end}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 카드 2: 예약 현황 ────────────────────────────────────────
function ReservationRow({ item }) {
  const badge = STATUS_BADGE[item.status.key] ?? STATUS_BADGE_DEFAULT
  return (
    <div className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">
          {dateLabel(item.date)} <span className="text-gray-500 font-normal">{item.startTime}</span>
        </p>
        <p className="text-xs text-gray-400 truncate">
          {[item.programName, item.subjectName, item.educatorName].filter(Boolean).join(' · ')}
        </p>
      </div>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge}`}>
        {item.status.label}
      </span>
    </div>
  )
}

function ReservationsCard({ state, onRetry }) {
  const [pastLimit, setPastLimit] = useState(PAST_PAGE)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h4 className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-3">
        <CalendarCheck size={15} className="text-blue-500" /> 예약 현황
      </h4>

      {state.loading ? (
        <p className="text-sm text-gray-300 text-center py-4">예약 데이터 불러오는 중...</p>
      ) : state.error ? (
        <p className="text-sm text-gray-400 text-center py-4">
          예약 데이터를 불러오지 못했습니다.
          <button onClick={onRetry} className="ml-2 text-indigo-500 font-bold">다시 시도</button>
        </p>
      ) : state.upcoming.length === 0 && state.past.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">예약 이력이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {state.upcoming.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">예정 ({state.upcoming.length})</p>
              {state.upcoming.map((item) => <ReservationRow key={item.id} item={item} />)}
            </div>
          )}
          {state.past.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">지난 예약 ({state.past.length})</p>
              {state.past.slice(0, pastLimit).map((item) => <ReservationRow key={item.id} item={item} />)}
              {state.past.length > pastLimit && (
                <button
                  onClick={() => setPastLimit((n) => n + PAST_PAGE)}
                  className="w-full mt-2 py-2 rounded-xl bg-gray-50 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition"
                >
                  더보기 ({state.past.length - pastLimit}건 남음)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function StudentScheduleSection({ student }) {
  const { data } = useData()
  const [hours, setHours] = useState({ loading: true })
  const [resv, setResv] = useState({ loading: true })
  const [hoursRetry, setHoursRetry] = useState(0)
  const [resvRetry, setResvRetry] = useState(0)
  const studentId = student?.id

  useEffect(() => {
    if (!studentId) return
    let alive = true
    setHours({ loading: true })
    fetchStudentCenterHours(studentId)
      .then((rows) => { if (alive) setHours({ rows }) })
      .catch((err) => {
        if (alive) setHours(isMigrationMissing(err) ? { migrationMissing: true } : { error: true })
      })
    return () => { alive = false }
  }, [studentId, hoursRetry])

  useEffect(() => {
    if (!studentId) return
    let alive = true
    setResv({ loading: true })
    Promise.all([fetchReservations({ studentId }), fetchBookingNameMaps()])
      .then(([rows, { programNames, subjectNames }]) => {
        if (!alive) return
        const today = todayStr()
        const items = rows
          .filter((r) => r.slot)
          .map((r) => {
            const educator = data.educators.find((e) => e.id === r.slot.educatorId)
            return {
              id: r.id,
              date: r.slot.date,
              startTime: r.slot.startTime,
              programName: programNames[r.programId] ?? '상담',
              subjectName: r.slot.subjectId ? (subjectNames[r.slot.subjectId] ?? '') : '',
              educatorName: educatorDisplayName(educator) ?? '담당 미정',
              status: reservationDisplayStatus(r, r.slot),
              isUpcoming: r.status === 'confirmed' && r.slot.date >= today,
            }
          })
        const byTime = (a, b) => (a.date !== b.date
          ? (a.date < b.date ? -1 : 1)
          : (a.startTime < b.startTime ? -1 : 1))
        setResv({
          upcoming: items.filter((i) => i.isUpcoming).sort(byTime),
          past: items.filter((i) => !i.isUpcoming).sort((a, b) => byTime(b, a)),
        })
      })
      .catch(() => { if (alive) setResv({ error: true }) })
    return () => { alive = false }
    // data.educators는 표시명 조회 전용 — 재조회 트리거로 삼지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, resvRetry])

  return (
    <div className="space-y-4">
      <CenterHoursCard state={hours} onRetry={() => setHoursRetry((n) => n + 1)} />
      <ReservationsCard state={resv} onRetry={() => setResvRetry((n) => n + 1)} />
    </div>
  )
}
