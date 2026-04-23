import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

export default function LearningTab() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const records = data.learningRecords.filter(r => r.studentId === currentUser?.id).slice().reverse()

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">학습 기록</h2>
      {records.length === 0 ? (
        <div className="text-center text-gray-400 py-16">아직 학습 기록이 없어요 📖</div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-lg">📚</div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-800">{r.subject}</span>
                  <span className="text-xs text-gray-400">{r.date}</span>
                </div>
                <span className="text-sm text-gray-500">{r.duration}분 · 집중도 {r.focus}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
