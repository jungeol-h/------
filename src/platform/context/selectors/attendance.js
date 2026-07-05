// [Read] 출결 현황 종합 — data를 인자로 받는 순수함수
//
// 시각 "판정"(지각/조퇴/결석 확정)은 서버(RPC·pg_cron)가 한다. 여기서는
// 이미 판정된 기록과 시간표를 화면용으로 분류·정리만 한다. now 파라미터의
// 용도는 "예정 시간이 지났는데 아직 기록이 없는 학생" 강조 표시뿐이다.

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

// 학생 1명의 오늘 출결 상태 분류. record/schedule은 오늘 것만 넘긴다.
//  - checked_out   하원 완료 (정상)
//  - early_leave   조퇴 (하원했으나 예정보다 이름)
//  - present/late  등원 중
//  - absent        무단 결석 확정 (cron) 또는 수동 결석
//  - not_arrived   예정 시간 경과했는데 미등원 (강조 대상)
//  - waiting       예정 시간 전
//  - no_schedule   오늘 등원 예정 없음
export function classifyToday({ record, schedule, now }) {
  if (record) {
    if (record.checkOutAt) {
      return record.checkoutStatus === 'early_leave' ? 'early_leave' : 'checked_out'
    }
    if (record.checkInAt) return record.status === 'late' ? 'late' : 'present'
    if (record.status === 'absent') return 'absent'
  }
  if (!schedule) return 'no_schedule'

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const arrivalMin = timeToMinutes(schedule.arrivalTime)
  if (arrivalMin == null) return 'no_schedule'
  return nowMin > arrivalMin ? 'not_arrived' : 'waiting'
}

// 담당 학생들의 오늘 현황판. 반환: { [상태]: [{ student, record, schedule }] }
export function getTodayAttendanceBoard(data, { educatorId, now = new Date() }) {
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  const dow = now.getDay()

  const myStudentIds = new Set(
    data.assignments.filter((a) => a.educatorId === educatorId).map((a) => a.studentId)
  )
  const students = data.students.filter((s) => myStudentIds.has(s.id))

  const recordByStudent = new Map(
    data.attendanceRecords.filter((r) => r.date === todayStr).map((r) => [r.studentId, r])
  )
  const scheduleByStudent = new Map(
    data.attendanceSchedules.filter((s) => s.dayOfWeek === dow).map((s) => [s.studentId, s])
  )

  const board = {
    not_arrived: [], absent: [], late: [], present: [],
    early_leave: [], checked_out: [], waiting: [], no_schedule: [],
  }
  students.forEach((student) => {
    const record = recordByStudent.get(student.id) ?? null
    const schedule = scheduleByStudent.get(student.id) ?? null
    const status = classifyToday({ record, schedule, now })
    board[status].push({ student, record, schedule })
  })
  return board
}

// 미해결 출결 알림 (학생 이름 결합, 최신순)
export function getUnresolvedAttendanceNotifications(data, { educatorId }) {
  const myStudentIds = new Set(
    data.assignments.filter((a) => a.educatorId === educatorId).map((a) => a.studentId)
  )
  const nameById = new Map(data.students.map((s) => [s.id, s.name]))
  return data.attendanceNotifications
    .filter((n) => !n.resolved && myStudentIds.has(n.studentId))
    .map((n) => ({ ...n, studentName: nameById.get(n.studentId) ?? '' }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}
