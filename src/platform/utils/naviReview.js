// 나비 후기 순수 로직 — 검증·정규화·관리자 열람용 필터/그룹핑 (UI·DB 무관, 단위 테스트 대상).

// 후기를 쓸 수 있는 역할 (viewer·manager·admin 제외)
export const NAVI_REVIEW_ROLES = ['student', 'parent', 'instructor', 'consultant']

// 관리자 필터 칩 — 강사·컨설턴트는 '강사' 하나로 묶는다 (클라이언트 요청 표기)
export const NAVI_ROLE_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'student', label: '학생' },
  { key: 'parent', label: '학부모' },
  { key: 'educator', label: '강사' },
]

export const NAVI_ROLE_LABELS = {
  student: '학생', parent: '학부모', instructor: '강사', consultant: '컨설턴트',
}

// 단일 텍스트 섹션 4종 (폼·관리자 열람 공용 — 표시 순서 = 클라이언트 양식 순서 2~5)
export const NAVI_TEXT_SECTIONS = [
  { key: 'toDirector', label: '센터장에게 하고 싶은 말' },
  { key: 'toSelf', label: '나비 센터에 참여한 자신에게 하고 싶은 말' },
  { key: 'mostHelpful', label: '가장 도움이 되었던 점' },
  { key: 'mostRegret', label: '가장 아쉬운 점' },
]

const trim = (v) => (typeof v === 'string' ? v.trim() : '')

// 폼 입력 → 저장용 정규화. 내용이 빈 강사 후기는 버리고, 중복 강사는 첫 건만 남긴다.
export function normalizeNaviReview(input) {
  const seen = new Set()
  const instructorReviews = []
  for (const r of input?.instructorReviews ?? []) {
    const content = trim(r?.content)
    if (!r?.educatorId || !content || seen.has(r.educatorId)) continue
    seen.add(r.educatorId)
    instructorReviews.push({ educatorId: r.educatorId, educatorName: r.educatorName ?? '', content })
  }
  return {
    instructorReviews,
    toDirector: trim(input?.toDirector),
    toSelf: trim(input?.toSelf),
    mostHelpful: trim(input?.mostHelpful),
    mostRegret: trim(input?.mostRegret),
  }
}

// 최소 한 칸은 채워야 제출 가능 (빈 후기 저장 방지)
export function hasNaviReviewContent(input) {
  const n = normalizeNaviReview(input)
  return n.instructorReviews.length > 0 || NAVI_TEXT_SECTIONS.some((s) => n[s.key] !== '')
}

// 선택 가능한 강사 목록: 교과강사·컨설턴트, 본인 제외, 퇴직·비활성 제외, 이름순
export function pickableEducators(users, selfId) {
  return (users ?? [])
    .filter((u) => (u.role === 'instructor' || u.role === 'consultant')
      && u.id !== selfId
      && (u.status ?? 'active') === 'active')
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'))
}

// 관리자 역할 필터 — 'educator'는 instructor + consultant
export function filterNaviReviewsByRole(reviews, filterKey) {
  if (filterKey === 'all' || !filterKey) return reviews
  if (filterKey === 'educator') return reviews.filter((r) => r.authorRole === 'instructor' || r.authorRole === 'consultant')
  return reviews.filter((r) => r.authorRole === filterKey)
}

// 강사별 모아보기 — instructorReviews를 강사 단위로 뒤집는다.
// 반환: [{ educatorId, educatorName, items: [{ reviewId, authorName, authorRole, content, updatedAt }] }]
// 후기 많은 강사 순 → 이름순. 같은 강사 이름 스냅샷이 달라도 id 기준으로 합치고 최신 이름을 쓴다.
export function groupNaviReviewsByEducator(reviews) {
  const map = new Map()
  for (const review of reviews ?? []) {
    for (const ir of review.instructorReviews ?? []) {
      if (!ir?.educatorId || !trim(ir.content)) continue
      if (!map.has(ir.educatorId)) {
        map.set(ir.educatorId, { educatorId: ir.educatorId, educatorName: ir.educatorName ?? '', items: [] })
      }
      map.get(ir.educatorId).items.push({
        reviewId: review.id,
        authorName: review.authorName,
        authorRole: review.authorRole,
        content: ir.content,
        updatedAt: review.updatedAt,
      })
    }
  }
  return [...map.values()].sort((a, b) =>
    b.items.length - a.items.length || a.educatorName.localeCompare(b.educatorName, 'ko'))
}
