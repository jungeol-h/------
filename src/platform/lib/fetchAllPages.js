// PostgREST max-rows(1000) 조용한 잘림 방지용 페이지 이어붙이기 (bookingApi.fetchAllPages와 같은 원리).
// makeQuery는 호출마다 새 쿼리를 만들어야 하며, 고유 컬럼(id) 정렬을 포함해야 페이지 경계가 안 흔들린다.
// 던지지 않고 collectRows가 먹는 { data, error } 모양으로 돌려준다 (Promise.all에 그대로 끼우기 위함).
const PAGE_SIZE = 1000

export async function fetchAllRows(makeQuery) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null }
  }
}
