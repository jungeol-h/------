// 월간 종합 보고서 출력 모달 — 관리자 통계 섹션에서 오픈.
// 컨설팅·수업은 컨텍스트 전량(data.counselingRecords/lessonReports)으로 집계하고,
// 출결은 관리자 fetch 윈도(60일) 제한 때문에 해당 월을 supabase에서 직접 조회한다
// (AttendanceExcelModal과 같은 이유·패턴).
import { useEffect, useMemo, useState } from 'react'
import { Loader, AlertCircle } from 'lucide-react'
import ModalShell from '../common/ModalShell.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { todayStr } from '../../utils/dateUtils.js'
import { buildFilename, nowDateTime } from '../../pdf/utils/formatters.js'
import { authorOf } from '../../pdf/config/meta.js'
import {
  buildMonthlyCounselingStats,
  buildMonthlyLessonStats,
  buildAttendanceUsage,
} from '../../context/selectors/monthlyOperationsReport.js'

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-full'

export default function MonthlyOperationsReportModal({ onClose }) {
  const { data } = useData()
  const { currentUser } = useAuth()

  // 초기 월: 컨설팅·수업 기록의 최신 날짜가 속한 달 — 월초에 열어도 0건 보고서가 되지 않게.
  const [month, setMonth] = useState(() => {
    let latest = ''
    for (const r of [...(data.counselingRecords ?? []), ...(data.lessonReports ?? [])]) {
      if (r.date && r.date > latest) latest = r.date
    }
    return latest ? latest.slice(0, 7) : todayStr().slice(0, 7)
  })

  const [attRows, setAttRows] = useState(null)
  const [attLoading, setAttLoading] = useState(false)
  const [attError, setAttError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!month) return
    let cancelled = false
    setAttLoading(true)
    setAttError(false)
    setAttRows(null)
    const [y, m] = month.split('-').map(Number)
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    // 말일은 실제 달력 기준으로 계산 — '2026-02-31' 같은 date 리터럴은 Postgres 에러
    const last = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    supabase
      .from('attendance_records')
      .select('status, check_in_at, check_out_at, events')
      .gte('date', first)
      .lte('date', last)
      .then(({ data: rows, error }) => {
        if (cancelled) return
        if (error) {
          setAttError(true)
        } else {
          setAttRows(
            (rows ?? []).map((r) => ({
              status: r.status,
              checkInAt: r.check_in_at,
              checkOutAt: r.check_out_at,
              events: r.events,
            })),
          )
        }
        setAttLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [month, retryKey])

  const counseling = useMemo(
    () => buildMonthlyCounselingStats(data.counselingRecords, data.educators, month),
    [data.counselingRecords, data.educators, month],
  )
  const lessons = useMemo(
    () => buildMonthlyLessonStats(data.lessonReports, data.educators, month),
    [data.lessonReports, data.educators, month],
  )
  const attendance = useMemo(
    () => (attRows ? buildAttendanceUsage(attRows) : null),
    [attRows],
  )

  const canBuild = !!month && !attLoading && !attError && !!attendance

  return (
    <ModalShell title="월간 종합 보고서" onClose={onClose}>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">대상 월</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="text-sm">
        {attLoading ? (
          <span className="inline-flex items-center gap-1.5 text-gray-400">
            <Loader size={14} className="animate-spin" /> 출결 기록 불러오는 중...
          </span>
        ) : attError ? (
          <span className="inline-flex items-center gap-1.5 text-red-500">
            <AlertCircle size={14} /> 출결을 불러오지 못했습니다.
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="text-blue-600 font-semibold"
            >
              다시 시도
            </button>
          </span>
        ) : (
          <span className="text-gray-600">
            컨설팅 <span className="font-bold">{counseling.totals.sessions}</span>건 ·
            수업 <span className="font-bold">{lessons.totals.sessions}</span>건 ·
            출석 연인원 <span className="font-bold">{attendance?.presentCount ?? '-'}</span>명
          </span>
        )}
      </div>

      <div className="flex justify-end">
        <DownloadPdfButton
          label="보고서 PDF"
          disabled={!canBuild}
          buildDocument={async () => {
            const { default: MonthlyOperationsReport } = await import(
              '../../pdf/reports/MonthlyOperationsReport.jsx'
            )
            const [y, m] = month.split('-').map(Number)
            return {
              element: (
                <MonthlyOperationsReport
                  period={`${y}년 ${m}월`}
                  generatedAt={nowDateTime()}
                  author={authorOf(currentUser)}
                  counseling={counseling}
                  lessons={lessons}
                  attendance={attendance}
                />
              ),
              filename: buildFilename('월간종합보고서', month),
            }
          }}
        />
      </div>
    </ModalShell>
  )
}
