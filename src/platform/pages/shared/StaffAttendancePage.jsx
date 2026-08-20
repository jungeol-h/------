// 강사 출근부 — 교직원(센터장·강사·컨설턴트·매니저) 키오스크 출퇴근 기록 월간 표.
// admin·manager 양쪽 대시보드에서 /staff-attendance로 진입 (AttendanceTab 상단 버튼).
//
// 설계: DataContext에 안 실린다 — 외부상담 externalData.js처럼 이 페이지가 진입 시점에
// supabase에서 직접 lazy fetch하고 로컬 state로만 관리한다 (전역 fetcher 격리).
// staff_attendance_records 테이블 미생성(마이그레이션 미적용) 시에도 크래시하지 않고
// 안내 배너만 표시한다.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { toDateStr } from '../../utils/dateUtils.js'

const ROLE_LABEL = {
  admin: '센터장',
  instructor: '강사',
  consultant: '컨설턴트',
  manager: '매니저',
}

// 표 세로 정렬 순서: 센터장 → 강사 → 컨설턴트 → 매니저
const ROLE_ORDER = { admin: 0, instructor: 1, consultant: 2, manager: 3 }

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토']

function monthRange(monthStr) {
  // monthStr: 'YYYY-MM'
  const [y, m] = monthStr.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0) // 해당 월 마지막 날
  return { start: toDateStr(start), end: toDateStr(end) }
}

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// timestamptz → 'HH:MM' (KST)
function hhmmKst(iso) {
  if (!iso) return null
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

// 'YYYY-MM-DD' → 'M/D(요일)'
function dateHeader(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `${m}/${d}(${WEEKDAY_LABEL[dow]})`
}

export default function StaffAttendancePage() {
  const [month, setMonth] = useState(currentMonthStr)
  const [staffList, setStaffList] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (monthStr) => {
    setLoading(true)
    setError(null)
    setMigrationNeeded(false)
    try {
      const { data: staffRows, error: staffErr } = await supabase
        .from('users')
        .select('id, name, role, work_schedule, status')
        .in('role', ['admin', 'manager', 'instructor', 'consultant'])
        .eq('status', 'active')
        .not('id', 'like', 'test-%')
      if (staffErr) throw staffErr

      const { start, end } = monthRange(monthStr)
      const { data: recRows, error: recErr } = await supabase
        .from('staff_attendance_records')
        .select('*')
        .gte('date', start)
        .lte('date', end)
      if (recErr) throw recErr

      setStaffList(staffRows ?? [])
      setRecords(recRows ?? [])
    } catch (e) {
      // 테이블 미생성(마이그레이션 미적용) — 코드/메시지로 구분해 크래시 없이 안내
      if (e?.code === '42P01' || /relation .* does not exist/i.test(e?.message ?? '')) {
        setMigrationNeeded(true)
      } else {
        setError(e)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [load, month])

  // 세로(행)=교직원 정렬: role 순서 → 같은 role 안에서 이름 가나다
  const sortedStaff = useMemo(() => {
    return staffList.slice().sort((a, b) =>
      (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
      a.name.localeCompare(b.name, 'ko'))
  }, [staffList])

  // 가로(열)=기록이 있는 날짜만, 오름차순
  const dateColumns = useMemo(() => {
    const set = new Set(records.map((r) => r.date))
    return [...set].sort()
  }, [records])

  const recordMap = useMemo(() => {
    const map = new Map() // `${staffId}|${date}` -> record
    for (const r of records) map.set(`${r.staff_id}|${r.date}`, r)
    return map
  }, [records])

  return (
    <div className="py-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-gray-900">강사 출근부</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => { if (e.target.value) setMonth(e.target.value) }}
          className="ml-auto border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          aria-label="조회 월 선택"
        />
      </div>

      {migrationNeeded && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            강사 출근부 마이그레이션(scripts/add-staff-attendance.sql)이 아직 적용되지 않았습니다.
          </p>
        </div>
      )}

      {error && !migrationNeeded && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3.5">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-red-700">데이터를 불러오지 못했습니다.</p>
            <button onClick={() => load(month)} className="mt-1 text-xs font-bold text-red-600 underline">
              다시 시도
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="bg-white rounded-2xl shadow-sm p-5 text-center text-sm text-gray-300">
          불러오는 중...
        </p>
      ) : !migrationNeeded && !error && (
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 z-10 bg-white text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">
                  강사명
                </th>
                <th className="sticky left-[88px] z-10 bg-white text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">
                  근무일정
                </th>
                {dateColumns.map((d) => (
                  <th key={d} className="px-3 py-3 font-bold text-gray-500 text-center whitespace-nowrap">
                    {dateHeader(d)}
                  </th>
                ))}
                {dateColumns.length === 0 && (
                  <th className="px-4 py-3 font-medium text-gray-300 text-center">
                    이번 달 기록 없음
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedStaff.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                    {s.name}
                    <span className="ml-1.5 text-[11px] font-bold text-indigo-500 bg-indigo-50 rounded-full px-2 py-0.5">
                      {ROLE_LABEL[s.role] ?? s.role}
                    </span>
                  </td>
                  <td className="sticky left-[88px] z-10 bg-white px-4 py-3 text-gray-500 whitespace-nowrap">
                    {s.work_schedule || '-'}
                  </td>
                  {dateColumns.map((d) => {
                    const rec = recordMap.get(`${s.id}|${d}`)
                    const inTime = hhmmKst(rec?.check_in_at)
                    const outTime = hhmmKst(rec?.check_out_at)
                    return (
                      <td key={d} className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="text-gray-800 font-medium">{inTime ?? '-'}</div>
                        <div className="text-gray-400">{outTime ?? '-'}</div>
                      </td>
                    )
                  })}
                  {dateColumns.length === 0 && <td className="px-4 py-3" />}
                </tr>
              ))}
              {sortedStaff.length === 0 && (
                <tr>
                  <td colSpan={2 + dateColumns.length} className="px-4 py-8 text-center text-gray-300">
                    표시할 교직원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
