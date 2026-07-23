// 관리자 홈 '출결 집계' 섹션 — 그룹별 오늘 출결 현황.
// 그룹 필터 상태는 AdminHomeTab이 useHomeGroupFilter로 한 번만 로드해 props로 내려준다
// (인원 현황 그룹별 보기와 같은 필터 공유). '그룹 설정' 편집 UI는 이 섹션에 유지.

import { useMemo, useState } from 'react'
import { CalendarCheck, SlidersHorizontal, Check, Loader } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { getGroupAttendanceSummary } from '../../context/selectors/attendanceStats.js'
import { GROUP_OPTIONS } from '../../data/groups.js'
import { todayStr } from '../../utils/dateUtils.js'

// groups: null=로딩 중 / toggleGroup·saveGroups·saving: useHomeGroupFilter 반환값
export default function GroupAttendanceSummary({ groups, toggleGroup, saveGroups, saving }) {
  const { data } = useData()

  const [editing, setEditing] = useState(false)

  const summary = useMemo(
    () => getGroupAttendanceSummary(data, { dateStr: todayStr(), groups: groups ?? [] }),
    [data, groups]
  )

  const handleSaveFilter = async () => {
    const ok = await saveGroups()
    if (ok) setEditing(false)
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={16} className="text-indigo-600" />
          <h3 className="text-sm font-bold text-gray-800">그룹별 출결 집계</h3>
          <span className="text-[11px] text-gray-400">오늘</span>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          <SlidersHorizontal size={12} />
          그룹 설정
        </button>
      </div>

      {/* 그룹 선택 편집 */}
      {editing && groups && (
        <div className="mb-3 rounded-xl bg-gray-50 p-3 space-y-2">
          <p className="text-[11px] text-gray-500">홈에 표시할 그룹을 선택하세요. (선택 없으면 전체 그룹)</p>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_OPTIONS.map((g) => {
              const on = groups.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGroup(g)}
                  className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 border transition ${
                    on
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {on && <Check size={12} />}
                  {g}
                </button>
              )
            })}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveFilter}
              disabled={saving}
              className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold active:scale-95 transition-all disabled:opacity-40"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {groups === null ? (
        <div className="flex justify-center py-6 text-gray-300">
          <Loader size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-1 text-center text-[11px] font-bold text-gray-400 pb-1.5 border-b border-gray-100">
            <span className="text-left pl-1">그룹</span>
            <span>대상</span>
            <span className="text-emerald-600">등원</span>
            <span className="text-yellow-600">지각</span>
            <span className="text-red-500">결석</span>
          </div>
          {summary.rows.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">집계할 학생이 없습니다.</p>
          ) : (
            summary.rows.map((row) => (
              <div key={row.group} className="grid grid-cols-5 gap-1 text-center text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-left pl-1 text-xs font-bold text-gray-600 self-center truncate">{row.group}</span>
                <span className="font-semibold text-gray-800">{row.total}</span>
                <span className={`font-semibold ${row.present > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{row.present}</span>
                <span className={`font-semibold ${row.late > 0 ? 'text-yellow-600' : 'text-gray-300'}`}>{row.late}</span>
                <span className={`font-semibold ${row.absent > 0 ? 'text-red-500' : 'text-gray-300'}`}>{row.absent}</span>
              </div>
            ))
          )}
          {summary.rows.length > 1 && (
            <div className="grid grid-cols-5 gap-1 text-center text-sm pt-2 mt-0.5 border-t border-gray-100">
              <span className="text-left pl-1 text-xs font-bold text-gray-800 self-center">전체</span>
              <span className="font-bold text-gray-800">{summary.totals.total}</span>
              <span className="font-bold text-emerald-600">{summary.totals.present}</span>
              <span className="font-bold text-yellow-600">{summary.totals.late}</span>
              <span className="font-bold text-red-500">{summary.totals.absent}</span>
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-2">등원 = 등원·하원·조퇴 포함(오늘 출석) · 미등원/예정없음은 제외 집계</p>
        </>
      )}
    </section>
  )
}
