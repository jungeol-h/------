// 나비 후기 fetch 헬퍼 — 역할별 fetcher가 공유한다.
//
// 테이블(navi_reviews)이 아직 DB에 없어도 앱이 흔들리면 안 된다(SQL은 Studio 수동 적용).
// 그래서 collectRows로 _fetchErrors 배너를 띄우지 않고, 에러면 조용히 []로 강등한다.
// (배너는 그대로 보이고 저장 시에만 오류가 표시된다 — 클라이언트 요청 '배너는 항상'.)

import { supabase } from '../../lib/supabase.js'
import { fetchAllRows } from '../../lib/fetchAllPages.js'
import { toNaviReview } from '../../lib/supabaseHelpers.js'

// userId 지정 = 본인 1건(학생·학부모·강사), 생략 = 전체(관리자)
export async function fetchNaviReviews(userId = null) {
  try {
    const res = userId
      ? await supabase.from('navi_reviews').select('*').eq('user_id', userId).limit(1)
      : await fetchAllRows(() => supabase.from('navi_reviews').select('*').order('id'))
    if (res?.error) return []
    return (res?.data ?? []).map(toNaviReview)
  } catch {
    return []
  }
}

// 후기 폼의 강사 선택 목록 — 학생·학부모 fetch에는 직원 명단이 없어 폼이 열릴 때 가볍게 조회.
// 필요한 컬럼만(id,name,role,status) — 연락처·비밀번호 계열은 가져오지 않는다.
export async function fetchNaviEducators() {
  const { data, error } = await supabase
    .from('users')
    .select('id,name,role,status')
    .in('role', ['instructor', 'consultant'])
  if (error) throw error
  return data ?? []
}
