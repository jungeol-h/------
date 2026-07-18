// 출결 상태 표시 메타 — classifyToday(selectors/attendance.js)의 상태 키와 1:1.
// 상태색은 항상 라벨과 함께 쓴다(색 단독 식별 금지). 컴포넌트 파일과 분리해
// react-refresh(fast refresh) 제약을 지킨다.

export const ATTENDANCE_STATUS_META = {
  not_arrived: { label: '미등원', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
  absent: { label: '결석', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
  late: { label: '지각', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700' },
  present: { label: '등원', dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  early_leave: { label: '조퇴', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700' },
  checked_out: { label: '하원', dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-700' },
  waiting: { label: '등원 전', dot: 'bg-gray-300', chip: 'bg-gray-100 text-gray-500' },
  no_schedule: { label: '예정 없음', dot: 'bg-gray-200', chip: 'bg-gray-100 text-gray-400' },
}

// 표시·정렬 순서 — 조치가 필요한 상태(미등원·결석)를 앞에
export const ATTENDANCE_STATUS_ORDER = [
  'not_arrived', 'absent', 'late', 'present', 'early_leave', 'checked_out', 'waiting', 'no_schedule',
]
