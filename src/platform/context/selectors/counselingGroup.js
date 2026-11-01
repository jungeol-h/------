// [Read] 상담 기록 그룹 파생 — 다중 학생 보고서(fan-out)로 생성된 기록 묶음.
//
// 한 보고서를 여러 학생에게 쓰면 학생별로 counseling_records 행이 생기고 그룹 id는 없다.
// 그래서 내용 동일성(작성자·일자·유형·본문 필드·첨부 path 집합)으로 그룹을 유도해
// 그룹 단위 일괄 수정을 가능하게 한다. 예약 유래(source) 행은 그룹으로 묶지 않는다.

const n = (v) => (v == null ? '' : v)

// 그룹 키 — 같은 키면 같은 보고서에서 파생된 것으로 본다. 예약 유래 행은 null.
export function counselingGroupKey(record) {
  if (!record || record.source) return null
  const paths = (record.attachments ?? []).map((a) => n(a?.path)).sort()
  return JSON.stringify([
    n(record.educatorId), n(record.date), n(record.type), n(record.targetType),
    n(record.startTime), n(record.endTime), n(record.topic), n(record.diagnosis),
    n(record.advice), n(record.followUp), n(record.note), n(record.nextAppointment),
    n(record.comment), paths,
  ])
}

// 같은 그룹의 다른 학생 기록들 — 본인·같은 학생의 중복행 제외, 학생당 1건만.
export function findCounselingGroupSiblings(record, records) {
  const key = counselingGroupKey(record)
  if (key == null) return []
  const seen = new Set([record.studentId])
  const out = []
  for (const r of records ?? []) {
    if (r === record || r.id === record.id) continue
    if (seen.has(r.studentId)) continue
    if (counselingGroupKey(r) !== key) continue
    seen.add(r.studentId)
    out.push(r)
  }
  return out
}

// key -> 그룹 내 서로 다른 학생 수. 배지는 map.get(counselingGroupKey(r))로 읽는다.
export function buildCounselingGroupSizes(records) {
  const students = new Map()
  for (const r of records ?? []) {
    const key = counselingGroupKey(r)
    if (key == null) continue
    if (!students.has(key)) students.set(key, new Set())
    students.get(key).add(r.studentId)
  }
  return new Map([...students].map(([k, set]) => [k, set.size]))
}
