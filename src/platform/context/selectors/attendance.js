// [Read] 출결 현황 종합 — data를 인자로 받는 순수함수
//
// 시각 "판정"(지각/조퇴/결석 확정)은 서버(RPC·pg_cron)가 한다. 여기서는
// 이미 판정된 기록과 시간표를 화면용으로 분류·정리만 한다. now 파라미터의
// 용도는 "예정 시간이 지났는데 아직 기록이 없는 학생" 강조 표시뿐이다.
//
// "예정" 기준은 센터 이용시간 등록명단(registrations)이 1순위다 — 클라이언트
// 확정(2026-07-19): 출결은 학생이 등록한 센터 이용시간 기준. registrations가
// 없을 때(로드 실패·마이그레이션 미적용)만 attendance_schedules로 대체한다.
// 휴무기간(centerClosures)에 드는 날짜는 예정 자체를 만들지 않는다 —
// 등록 학생도 no_schedule이 되고, 실등원 기록만 그대로 표시된다 (2026-08).

import { toDateStr } from '../../utils/dateUtils.js'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// 'HH:MM' → 분. 파싱 불가면 null.
export function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

// 한 학생의 요일별 시간표를 0(일)~6(토) 7칸 배열로. 없는 요일은 null.
export function getWeeklySchedule(data, studentId) {
  const week = Array(7).fill(null)
  data.attendanceSchedules
    .filter((s) => s.studentId === studentId)
    .forEach((s) => {
      if (s.dayOfWeek >= 0 && s.dayOfWeek <= 6) week[s.dayOfWeek] = s
    })
  return week
}

export function dayLabel(dayOfWeek) {
  return DAY_LABELS[dayOfWeek] ?? ''
}

// 하루 2회 이상 등원(재등원) 여부 — events 로그에 'in' 이벤트가 2개 이상이면 true.
// events가 없는(구 기록·마이그레이션 미적용) 레코드는 false.
export function isReentry(record) {
  if (!record?.events || !Array.isArray(record.events)) return false
  return record.events.filter((e) => e?.type === 'in').length >= 2
}

// 학생 1명의 날짜별 출결 상태 분류. record/schedule은 해당 날짜 것만 넘긴다.
//  - checked_out   하원 완료 (정상)
//  - early_leave   조퇴 (하원했으나 예정보다 이름)
//  - present/late  등원 중
//  - absent        무단 결석 확정 (cron) 또는 수동 결석
//  - not_arrived   예정 시간 경과했는데 미등원 — 지난 날짜는 기록 없는 예정자 전부
//  - waiting       예정 시간 전 (미래 날짜 포함)
//  - no_schedule   해당 날짜 등원 예정 없음
export function classifyForDate({ record, schedule, dateStr, now }) {
  if (record) {
    if (record.checkOutAt) {
      return record.checkoutStatus === 'early_leave' ? 'early_leave' : 'checked_out'
    }
    if (record.checkInAt) return record.status === 'late' ? 'late' : 'present'
    if (record.status === 'absent') return 'absent'
  }
  if (!schedule) return 'no_schedule'
  const arrivalMin = timeToMinutes(schedule.arrivalTime)
  if (arrivalMin == null) return 'no_schedule'

  const today = toDateStr(now)
  if (dateStr < today) return 'not_arrived'
  if (dateStr > today) return 'waiting'
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin > arrivalMin ? 'not_arrived' : 'waiting'
}

// 오늘 기준 분류 (classifyForDate의 오늘 특수화 — 기존 호출부 호환용)
export function classifyToday({ record, schedule, now }) {
  return classifyForDate({ record, schedule, dateStr: toDateStr(now), now })
}

// dateStr이 시작일~종료일(포함)에 드는 첫 휴무기간. 없으면 null.
export function findClosureFor(closures, dateStr) {
  if (!closures || closures.length === 0) return null
  return closures.find((c) => c.startDate <= dateStr && dateStr <= c.endDate) ?? null
}

// 담당 학생들의 날짜별 현황판. 반환: { [상태]: [{ student, record, schedule }] }
// all=true(관리자)면 배정과 무관하게 전체 active 학생을 대상으로 한다.
// registrations(센터 이용시간 등록)가 있으면 그 요일 등록을 예정으로 삼는다 —
// 한 학생의 여러 시간 블록은 첫 시작~마지막 종료로 합친 pseudo-schedule이 된다.
// registrations가 null이면 attendance_schedules(등·하원 시간표)로 대체.
export function getDailyAttendanceBoard(data, {
  educatorId, all = false, dateStr, registrations = null, closures = null, now = new Date(),
}) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()

  const myStudentIds = new Set(
    data.assignments.filter((a) => a.educatorId === educatorId).map((a) => a.studentId)
  )
  const students = all
    ? data.students.filter((s) => (s.status ?? 'active') === 'active')
    : data.students.filter((s) => myStudentIds.has(s.id) && (s.status ?? 'active') === 'active')

  const recordByStudent = new Map(
    data.attendanceRecords.filter((r) => r.date === dateStr).map((r) => [r.studentId, r])
  )

  // 휴무일은 예정을 만들지 않는다(빈 Map) — 기록 없는 학생은 no_schedule로 빠진다
  const scheduleByStudent = new Map()
  const isClosed = findClosureFor(closures, dateStr) != null
  if (!isClosed && registrations) {
    for (const r of registrations) {
      if (r.dayOfWeek !== dow) continue
      const cur = scheduleByStudent.get(r.studentId)
      if (!cur) {
        scheduleByStudent.set(r.studentId, { arrivalTime: r.startTime, departureTime: r.endTime })
      } else {
        if (r.startTime < cur.arrivalTime) cur.arrivalTime = r.startTime
        if (r.endTime > cur.departureTime) cur.departureTime = r.endTime
      }
    }
  } else if (!isClosed) {
    data.attendanceSchedules
      .filter((s) => s.dayOfWeek === dow)
      .forEach((s) => scheduleByStudent.set(s.studentId, s))
  }

  const board = {
    not_arrived: [], absent: [], late: [], present: [],
    early_leave: [], checked_out: [], waiting: [], no_schedule: [],
  }
  students.forEach((student) => {
    const record = recordByStudent.get(student.id) ?? null
    const schedule = scheduleByStudent.get(student.id) ?? null
    const status = classifyForDate({ record, schedule, dateStr, now })
    board[status].push({ student, record, schedule })
  })
  return board
}

// 오늘 현황판 (getDailyAttendanceBoard의 오늘 특수화 — 시간표 기준, 기존 호출부 호환용)
export function getTodayAttendanceBoard(data, { educatorId, all = false, now = new Date() }) {
  return getDailyAttendanceBoard(data, { educatorId, all, dateStr: toDateStr(now), now })
}

// 미해결 출결 알림 (학생 이름 결합, 최신순)
// all=true(관리자)면 배정과 무관하게 전체 알림을 반환한다.
export function getUnresolvedAttendanceNotifications(data, { educatorId, all = false }) {
  const myStudentIds = new Set(
    data.assignments.filter((a) => a.educatorId === educatorId).map((a) => a.studentId)
  )
  const nameById = new Map(data.students.map((s) => [s.id, s.name]))
  return data.attendanceNotifications
    .filter((n) => !n.resolved && (all || myStudentIds.has(n.studentId)))
    .map((n) => ({ ...n, studentName: nameById.get(n.studentId) ?? '' }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}
