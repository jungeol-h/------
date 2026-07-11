import { useCallback, useMemo } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import QuizResultsTable from '../../components/admin/QuizResultsTable.jsx'
import QuizSetManagement from '../../components/admin/QuizSetManagement.jsx'
import RefreshButton from '../../components/RefreshButton.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { buildFilename, nowDateTime } from '../../pdf/utils/formatters.js'
import { authorOf } from '../../pdf/config/meta.js'
import { hasPendingGrading } from '../../utils/quizGrading.js'
import { instructorQuizSubject } from '../../utils/quizSubjects.js'

export default function QuizMonitorTab() {
  const { data, updateQuizAttemptGrading } = useData()
  const { currentUser } = useAuth()

  // 강사는 자기 과목 회차·응시만 (관리자는 전체)
  const mySubject = instructorQuizSubject(currentUser)
  const scopedSets = useMemo(
    () => (mySubject ? data.quizSets.filter((s) => s.subject === mySubject) : data.quizSets),
    [data.quizSets, mySubject]
  )
  const scopedAttempts = useMemo(() => {
    if (!mySubject) return data.quizAttempts
    const setIds = new Set(scopedSets.map((s) => s.id))
    return data.quizAttempts.filter((a) => setIds.has(a.quizSetId))
  }, [data.quizAttempts, scopedSets, mySubject])

  // 회차별 응시자 수 / 미응시자 수 / 평균 — 간단 요약 카드
  const summaries = useMemo(() => {
    return scopedSets.map((set) => {
      const eligible = data.students.filter((s) => s.grade === set.grade)
      const attempts = scopedAttempts.filter((a) => a.quizSetId === set.id)
      const submittedIds = new Set(attempts.map((a) => a.studentId))
      const submittedCount = attempts.length
      const eligibleCount = eligible.length
      const missingCount = eligible.filter((s) => !submittedIds.has(s.id)).length
      const pendingCount = attempts.filter(hasPendingGrading).length
      const avgPct = attempts.length > 0
        ? Math.round(attempts.reduce((sum, a) => sum + (a.total > 0 ? a.score / a.total : 0), 0) / attempts.length * 100)
        : 0
      return { set, eligibleCount, submittedCount, missingCount, pendingCount, avgPct }
    })
  }, [scopedSets, data.students, scopedAttempts])

  const buildPdf = useCallback(async () => {
    const filename = buildFilename('확인평가보고서', mySubject ?? '전체')
    const { default: QuizReport } = await import('../../pdf/reports/QuizReport.jsx')
    return {
      element: (
        <QuizReport
          summaries={summaries}
          attempts={scopedAttempts}
          students={data.students}
          quizSets={scopedSets}
          period={`조회일 ${nowDateTime().slice(0, 10)}`}
          generatedAt={nowDateTime()}
          author={authorOf(currentUser)}
        />
      ),
      filename,
    }
  }, [summaries, scopedAttempts, data.students, scopedSets, currentUser, mySubject])

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="text-emerald-600" />
          <h2 className="text-base font-bold text-gray-800">
            {mySubject ? `${mySubject} 확인평가 모니터링` : '확인평가 모니터링'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <DownloadPdfButton
            buildDocument={buildPdf}
            label="확인평가 보고서"
            disabled={summaries.length === 0}
          />
        </div>
      </div>

      {summaries.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-gray-400">
          아직 등록된 회차가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {summaries.map(({ set, eligibleCount, submittedCount, missingCount, pendingCount, avgPct }) => (
            <div key={set.id} className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-[11px] font-bold text-emerald-600">{set.subject} · {set.grade} · {set.round}회</p>
              <p className="text-sm font-semibold text-gray-800 leading-snug mt-0.5">{set.title}</p>
              <div className="flex items-end gap-2 mt-3">
                <span className="text-2xl font-bold text-gray-800">{submittedCount}</span>
                <span className="text-xs text-gray-400 pb-1">/ {eligibleCount}명 응시</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                <span>미응시 {missingCount}</span>
                <span>평균 {avgPct}%</span>
              </div>
              {pendingCount > 0 && (
                <p className="text-[11px] text-amber-600 font-semibold mt-1">미채점 {pendingCount}건</p>
              )}
            </div>
          ))}
        </div>
      )}

      <QuizSetManagement />

      <QuizResultsTable
        attempts={scopedAttempts}
        students={data.students}
        quizSets={scopedSets}
        quizQuestions={data.quizQuestions}
        onUpdateGrading={updateQuizAttemptGrading}
      />
    </div>
  )
}
