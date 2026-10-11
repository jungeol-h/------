// 상담보고 저장 직전 중복 경고 — 같은 학생·같은 강사·같은 날짜로 예약현황(booking_records)에서
// 이미 작성된 상담기록이 있는 학생을 찾는다. 예약현황 쪽은 booking/bookingStatus.js의
// findCoveringCounseling이 반대 방향(상담보고 → 예약)을 막는다.
// records: data.counselingRecords (source === 'booking' 이 예약 유래 행)
export function findBookingDuplicates(records, studentIds, authorId, date) {
  const dup = new Set(
    (records ?? [])
      .filter((r) => r.source === 'booking' && r.educatorId === authorId && r.date === date)
      .map((r) => r.studentId),
  )
  return studentIds.filter((id) => dup.has(id))
}

// 경고 문구 — 확인(true)이면 그래도 저장
export function confirmBookingDuplicate(dupIds, nameOf, date) {
  if (dupIds.length === 0) return true
  const names = dupIds.map((id) => nameOf(id) ?? id).join(', ')
  return window.confirm(
    `예약현황에서 이미 작성된 상담기록이 있습니다 — ${names} (${date}).\n`
    + '같은 상담이면 저장하지 말고 기존 기록을 확인해 주세요. 그래도 저장할까요?',
  )
}
