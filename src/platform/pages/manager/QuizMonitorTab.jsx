import { ClipboardCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import QuizResultsTable from '../../components/admin/QuizResultsTable.jsx'

export default function QuizMonitorTab() {
  const { data } = useData()

  // 매니저 fetch가 이미 담당 학생 응시만 가져와서 별도 필터 불필요
  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={20} className="text-emerald-600" />
        <h2 className="text-base font-bold text-gray-800">담당 학생 확인평가</h2>
      </div>

      <QuizResultsTable
        attempts={data.quizAttempts}
        students={data.students}
        quizSets={data.quizSets}
        quizQuestions={data.quizQuestions}
        emptyMessage="담당 학생의 응시 이력이 아직 없습니다."
      />
    </div>
  )
}
