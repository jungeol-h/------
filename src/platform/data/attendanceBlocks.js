// 자동 출결 등록 시간블록 기호 — 2026-07 클라이언트 운영 시간표 기준.
// 학생별 컨설팅 리포트의 '등록일정' 칸에 attendance_schedules(요일·등원~하원)를
// 블록 기호(M1, T2, SA3 …)로 변환해 표시하는 데 쓴다.
//
// 규칙: 수업 슬롯은 주중 정시부터 50분 단위(16:00~, 17:00~ …), 현재는 블록 1개가
// 슬롯 2개를 차지한다(예: M1 = 16:00~17:50). 블록 구성이 바뀌면 **이 테이블만**
// 수정하면 된다 — 매칭 로직(selectors/studentCounselingReport.js)은 이 정의를 읽는다.
//
// key = attendance_schedules.day_of_week (0=일 ~ 6=토). 수(3)·목(4)은 블록 미운영.

export const ATTENDANCE_BLOCKS = {
  // 월
  1: [
    { code: 'M1', start: '16:00', end: '17:50' },
    { code: 'M2', start: '17:00', end: '18:50' },
    { code: 'M3', start: '18:00', end: '19:50' },
    { code: 'M4', start: '19:00', end: '20:50' },
  ],
  // 화
  2: [
    { code: 'T1', start: '16:00', end: '17:50' },
    { code: 'T2', start: '17:00', end: '18:50' },
    { code: 'T3', start: '18:00', end: '19:50' },
    { code: 'T4', start: '19:00', end: '20:50' },
  ],
  // 금
  5: [
    { code: 'F1', start: '16:00', end: '17:50' },
    { code: 'F2', start: '17:00', end: '18:50' },
    { code: 'F3', start: '18:00', end: '19:50' },
    { code: 'F4', start: '19:00', end: '20:50' },
  ],
  // 토
  6: [
    { code: 'SA1', start: '12:30', end: '14:30' },
    { code: 'SA2', start: '13:30', end: '15:45' },
    { code: 'SA3', start: '14:45', end: '16:45' },
    { code: 'SA4', start: '15:45', end: '18:00' },
    { code: 'SA5', start: '17:00', end: '19:00' },
  ],
  // 일
  0: [
    { code: 'SU1', start: '12:30', end: '14:30' },
    { code: 'SU2', start: '13:30', end: '15:45' },
    { code: 'SU3', start: '14:45', end: '16:45' },
    { code: 'SU4', start: '15:45', end: '18:00' },
    { code: 'SU5', start: '17:00', end: '19:00' },
  ],
}
