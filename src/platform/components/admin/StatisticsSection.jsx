import { useCallback, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, BarChart2, Printer } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from 'recharts'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import AttendanceExcelModal from '../attendance/AttendanceExcelModal.jsx'
import MonthlyReportModal from '../counseling/MonthlyReportModal.jsx'
import { buildFilename, nowDateTime } from '../../pdf/utils/formatters.js'
import { authorOf } from '../../pdf/config/meta.js'
import { getAttendanceTotals, getAvgLearningMinutes, getCounselingTypeCounts } from '../../context/selectors/adminStats.js'
import { formatMinutes } from '../../pages/student/learningTabLogic.js'

// 통계 섹션 — 구 '통계' 탭 콘텐츠를 관리자 홈 하단에 임베드 (요청: 통계를 홈 맨 아래로).
export default function StatisticsSection() {
  const { data } = useData()
  const { currentUser } = useAuth()
  const hasStats = data.monthlyStats.length > 0
  const barRef = useRef(null)
  const lineRef = useRef(null)
  const [excelOpen, setExcelOpen] = useState(false)
  const [counselingReportOpen, setCounselingReportOpen] = useState(false)

  // 강사별 월간 컨설팅 보고서 — 업무기록>상담보고의 출력과 동일 (강사 선택형).
  // 누적횟수(N회차)가 전체 이력 기준이어야 하므로 counselingRecords 전량을 넘긴다.
  const loadCounselingRecords = useCallback(async () => {
    const studentById = new Map(data.students.map((s) => [s.id, s]))
    return {
      records: data.counselingRecords.map((r) => ({ ...r, fallbackContent: r.comment })),
      getStudent: (id) => studentById.get(id),
    }
  }, [data.counselingRecords, data.students])

  // 확장 통계 — 누적 출결(관리자 fetch 윈도 60일) / 학습시간 평균(30일) / 업무횟수(유형별)
  const attendanceTotals = useMemo(() => getAttendanceTotals(data), [data])
  const avgLearningMin = useMemo(() => getAvgLearningMinutes(data), [data])
  const typeCounts = useMemo(() => getCounselingTypeCounts(data), [data])
  const hasAttendance = attendanceTotals.present + attendanceTotals.late + attendanceTotals.absent > 0

  const buildPdf = useCallback(async () => {
    const periodLabel = hasStats
      ? `${data.monthlyStats[0].month} ~ ${data.monthlyStats[data.monthlyStats.length - 1].month}`
      : '-'
    const identifier = hasStats
      ? `${data.monthlyStats[0].month}-${data.monthlyStats[data.monthlyStats.length - 1].month}`.replace(/월/g, '')
      : ''
    const filename = buildFilename('월간보고서', identifier)

    const [
      { default: StatisticsReport },
      { captureChart },
    ] = await Promise.all([
      import('../../pdf/reports/StatisticsReport.jsx'),
      import('../../pdf/utils/captureChart.js'),
    ])

    const [centerHoursImg, selfIndexImg] = await Promise.all([
      captureChart(barRef.current),
      captureChart(lineRef.current),
    ])

    return {
      element: (
        <StatisticsReport
          monthlyStats={data.monthlyStats}
          chartImages={{ centerHours: centerHoursImg, selfIndex: selfIndexImg }}
          period={periodLabel}
          generatedAt={nowDateTime()}
          author={authorOf(currentUser)}
        />
      ),
      filename,
    }
  }, [hasStats, data.monthlyStats, currentUser])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2 size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-gray-800">통계 & 분석</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExcelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold active:scale-95 transition-all"
          >
            <FileSpreadsheet size={14} />
            출결 엑셀
          </button>
          <button
            onClick={() => setCounselingReportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 active:scale-95 transition-all"
          >
            <Printer size={14} />
            컨설팅 보고서
          </button>
          <DownloadPdfButton
            buildDocument={buildPdf}
            label="월간 보고서"
            disabled={!hasStats}
          />
        </div>
      </div>

      <AttendanceExcelModal open={excelOpen} onClose={() => setExcelOpen(false)} />

      {counselingReportOpen && (
        <MonthlyReportModal
          educators={data.educators.filter((e) =>
            ['admin', 'manager', 'instructor', 'consultant'].includes(e.role) && e.status !== 'inactive',
          )}
          loadRecords={loadCounselingRecords}
          reportLabel="컨설팅보고서"
          onClose={() => setCounselingReportOpen(false)}
        />
      )}

      {/* 누적 출결 (최근 60일) + 학습시간 평균 (최근 30일) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">누적 출결 <span className="text-gray-400">(최근 60일)</span></p>
          {hasAttendance ? (
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-lg font-bold text-blue-600">출석 {attendanceTotals.present + attendanceTotals.late}</span>
              <span className="text-xs text-yellow-600 font-semibold">지각 {attendanceTotals.late}</span>
              <span className="text-xs text-red-500 font-semibold">결석 {attendanceTotals.absent}</span>
              {attendanceTotals.earlyLeave > 0 && (
                <span className="text-xs text-orange-500 font-semibold">조퇴 {attendanceTotals.earlyLeave}</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-1">기록 없음</p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">1인당 학습시간 <span className="text-gray-400">(최근 30일)</span></p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatMinutes(avgLearningMin)}</p>
        </div>
      </div>

      {/* 업무횟수 — 상담(업무보고) 유형별 */}
      {typeCounts.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">업무횟수 (유형별)</h3>
          <ResponsiveContainer width="100%" height={Math.max(120, typeCounts.length * 32)}>
            <BarChart data={typeCounts} layout="vertical" margin={{ top: 0, right: 30, left: 12, bottom: 0 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#4b5563' }} axisLine={false} tickLine={false} width={92} />
              <Tooltip formatter={(v) => [`${v}건`, '업무횟수']} contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {typeCounts.map((entry, i) => (
                  <Cell key={entry.type} fill={['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0891b2', '#db2777'][i % 8]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!hasStats && (
        <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400">
          <p className="text-sm">아직 월간 통계 데이터가 없습니다.</p>
          <p className="text-xs mt-1">베타테스트 운영 후 자동 집계됩니다.</p>
        </div>
      )}

      {/* 월간 센터 이용시간 */}
      {hasStats && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">월간 센터 이용시간 (시간)</h3>
          <div ref={barRef}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.monthlyStats}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 80]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}시간`, '이용시간']} />
                <Bar dataKey="centerHours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 자기주도지수 추이 */}
      {hasStats && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">자기주도지수 추이</h3>
          <div ref={lineRef}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="selfIndex" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  )
}
