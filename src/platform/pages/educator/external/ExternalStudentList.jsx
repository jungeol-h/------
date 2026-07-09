import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, CheckCircle2 } from 'lucide-react'

// 외생 학생 목록: 학교별 groupBy 아코디언 + 진행률 + 이름 검색.
// 학생 클릭 → onSelect(student). 상담기록 있으면 완료 뱃지.
export default function ExternalStudentList({ students, records, onSelect }) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState({}) // { school: true }

  // 학생별 기록 보유 여부
  const doneSet = useMemo(() => {
    const set = new Set()
    for (const r of records) set.add(r.programStudentId)
    return set
  }, [records])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => (s.name ?? '').toLowerCase().includes(q))
  }, [students, query])

  const groups = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      const school = s.school || '학교 미지정'
      if (!map.has(school)) map.set(school, [])
      map.get(school).push(s)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [filtered])

  const total = students.length
  const done = students.filter((s) => doneSet.has(s.id)).length

  const toggle = (school) =>
    setCollapsed((prev) => ({ ...prev, [school]: !prev[school] }))

  return (
    <div className="space-y-3">
      {/* 진행률 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">상담 진행률</span>
          <span className="text-sm font-bold text-emerald-600">
            {done} / {total}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학생 이름 검색"
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* 학교별 아코디언 */}
      {groups.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">학생이 없습니다.</p>
      ) : (
        groups.map(([school, list]) => {
          const isCollapsed = !!collapsed[school]
          const schoolDone = list.filter((s) => doneSet.has(s.id)).length
          return (
            <div key={school} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggle(school)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  {school}
                </span>
                <span className="text-xs text-gray-400">
                  {schoolDone} / {list.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="divide-y divide-gray-100">
                  {list.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                    >
                      <span className="text-sm text-gray-800">
                        {s.name}
                        {s.grade && <span className="text-gray-400 ml-2">{s.grade}</span>}
                      </span>
                      {doneSet.has(s.id) && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle2 size={14} /> 상담완료
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
