import { useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { buildFilename, nowDateTime } from '../../pdf/utils/formatters.js'
import { authorOf } from '../../pdf/config/meta.js'

export default function StatisticsTab() {
  const { data } = useData()
  const { currentUser } = useAuth()
  const hasStats = data.monthlyStats.length > 0
  const barRef = useRef(null)
  const lineRef = useRef(null)

  const handleDownloadPdf = useCallback(async () => {
    const periodLabel = hasStats
      ? `${data.monthlyStats[0].month} ~ ${data.monthlyStats[data.monthlyStats.length - 1].month}`
      : '-'
    const identifier = hasStats
      ? `${data.monthlyStats[0].month}-${data.monthlyStats[data.monthlyStats.length - 1].month}`.replace(/월/g, '')
      : ''
    const filename = buildFilename('월간보고서', identifier)

    const [
      { downloadPdf },
      { default: StatisticsReport },
      { captureChart },
    ] = await Promise.all([
      import('../../pdf/utils/downloadPdf.js'),
      import('../../pdf/reports/StatisticsReport.jsx'),
      import('../../pdf/utils/captureChart.js'),
    ])

    const [centerHoursImg, selfIndexImg] = await Promise.all([
      captureChart(barRef.current),
      captureChart(lineRef.current),
    ])

    await downloadPdf(
      <StatisticsReport
        monthlyStats={data.monthlyStats}
        chartImages={{ centerHours: centerHoursImg, selfIndex: selfIndexImg }}
        period={periodLabel}
        generatedAt={nowDateTime()}
        author={authorOf(currentUser)}
      />,
      filename,
    )
  }, [hasStats, data.monthlyStats, currentUser])

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">통계 & 분석</h2>
        <DownloadPdfButton
          onDownload={handleDownloadPdf}
          label="월간 보고서"
          disabled={!hasStats}
        />
      </div>

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
    </div>
  )
}
