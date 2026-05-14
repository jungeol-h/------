import { useMemo } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import QuizResultsTable from '../../components/admin/QuizResultsTable.jsx'
import QuizSetManagement from '../../components/admin/QuizSetManagement.jsx'

export default function QuizMonitorTab() {
  const { data } = useData()

  // 회차별 응시자 수 / 미응시자 수 / 평균 — 간단 요약 카드
  const summaries = useMemo(() => {
    return data.quizSets.map((set) => {
      const eligible = data.students.filter((s) => s.grade === set.grade)
      const attempts = data.quizAttempts.filter((a) => a.quizSetId === set.id)
      const submittedIds = new Set(attempts.map((a) => a.studentId))
      const submittedCount = attempts.length
      const eligibleCount = eligible.length
      const missingCount = eligible.filter((s) => !submittedIds.has(s.id)).length
      const avgPct = attempts.length > 0
        ? Math.round(attempts.reduce((sum, a) => sum + (a.total > 0 ? a.score / a.total : 0), 0) / attempts.length * 100)
        : 0
      return { set, eligibleCount, submittedCount, missingCount, avgPct }
    })
  }, [data.quizSets, data.students, data.quizAttempts])

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={20} className="text-emerald-600" />
        <h2 className="text-base font-bold text-gray-800">확인평가 모니터링</h2>
      </div>

      {summaries.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-gray-400">
          아직 등록된 회차가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {summaries.map(({ set, eligibleCount, submittedCount, missingCount, avgPct }) => (
            <div key={set.id} className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-[11px] font-bold text-emerald-600">{set.grade} · {set.round}회</p>
              <p className="text-sm font-semibold text-gray-800 leading-snug mt-0.5">{set.title}</p>
              <div className="flex items-end gap-2 mt-3">
                <span className="text-2xl font-bold text-gray-800">{submittedCount}</span>
                <span className="text-xs text-gray-400 pb-1">/ {eligibleCount}명 응시</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                <span>미응시 {missingCount}</span>
                <span>평균 {avgPct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <QuizSetManagement />

      <QuizResultsTable
        attempts={data.quizAttempts}
        students={data.students}
        quizSets={data.quizSets}
        quizQuestions={data.quizQuestions}
      />
    </div>
  )
}
