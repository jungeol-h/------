// [Read] 학생 1명의 출결 누적 통계 — data를 인자로 받는 순수함수
//
// 판정(present/late/absent, early_leave)은 이미 서버가 확정한 값이다.
// 여기서는 그 값을 세고, 화면·PDF용으로 날짜 내림차순 정리만 한다.
// present/late/absent는 status 기준, earlyLeave는 checkoutStatus 기준으로
// 서로 독립 집계한다(지각이면서 조퇴한 날은 late·earlyLeave 양쪽에 카운트).

export function getAttendanceSummary(data, studentId) {
  const records = (data?.attendanceRecords ?? []).filter(
    (r) => r.studentId === studentId
  )

  const counts = { present: 0, late: 0, earlyLeave: 0, absent: 0 }
  records.forEach((r) => {
    if (r.status === 'present') counts.present += 1
    else if (r.status === 'late') counts.late += 1
    else if (r.status === 'absent') counts.absent += 1
    if (r.checkoutStatus === 'early_leave') counts.earlyLeave += 1
  })

  const sorted = records
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((r) => ({
      id: r.id,
      date: r.date,
      status: r.status,
      checkoutStatus: r.checkoutStatus ?? null,
      checkInAt: r.checkInAt ?? null,
      checkOutAt: r.checkOutAt ?? null,
    }))

  return { counts, records: sorted }
}
