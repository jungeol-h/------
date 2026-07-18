// 센터 이용시간 등록의 1시간 단위 시각표 — 2026-07 클라이언트 운영 시간표 기준.
// 구글폼의 겹치는 시간블록(attendanceBlocks.js의 M1~SU5) 신청을 대체하는 단위다.
// 주중은 정시 1시간(마지막만 21:00~21:50), 주말은 쉬는시간(14:30~14:45,
// 16:45~17:00)을 건너뛴 1시간 단위. 단위 구성이 바뀌면 이 테이블만 수정한다 —
// DB(center_hour_registrations)는 start/end 시각을 그대로 저장할 뿐이다.
//
// key = day_of_week (0=일 ~ 6=토, JS getDay 규약). 수(3)·목(4)은 미운영.

const WEEKDAY_UNITS = [
  { start: '16:00', end: '17:00' },
  { start: '17:00', end: '18:00' },
  { start: '18:00', end: '19:00' },
  { start: '19:00', end: '20:00' },
  { start: '20:00', end: '21:00' },
  { start: '21:00', end: '21:50' },
]

const WEEKEND_UNITS = [
  { start: '12:30', end: '13:30' },
  { start: '13:30', end: '14:30' },
  { start: '14:45', end: '15:45' },
  { start: '15:45', end: '16:45' },
  { start: '17:00', end: '18:00' },
  { start: '18:00', end: '19:00' },
]

export const CENTER_HOUR_UNITS = {
  1: WEEKDAY_UNITS, // 월
  2: WEEKDAY_UNITS, // 화
  5: WEEKDAY_UNITS, // 금
  6: WEEKEND_UNITS, // 토
  0: WEEKEND_UNITS, // 일
}

// 화면·엑셀의 요일 표시 순서
export const CENTER_DAY_ORDER = [1, 2, 5, 6, 0]

export const CENTER_CAPACITY_DEFAULT = 40

export const unitKey = (day, start) => `${day}#${start}`
export const unitLabel = (u) => `${u.start}~${u.end}`
