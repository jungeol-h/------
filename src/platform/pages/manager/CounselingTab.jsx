import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

export default function CounselingTab() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const records = data.counselingRecords
    .filter(r => r.managerId === currentUser?.id)
    .slice()
    .reverse()

  const TYPE_LABELS = { mind: '마인드', career: '진로', study: '학습' }

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">상담 기록</h2>
      {records.length === 0 ? (
        <div className="text-center text-gray-400 py-16">상담 기록이 없어요 💬</div>
      ) : (
        <div className="space-y-3">
          {records.map(r => {
            const student = data.students.find(s => s.id === r.studentId)
            return (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{student?.name || '학생'}</span>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{TYPE_LABELS[r.type] || r.type}</span>
                  </div>
                  <span className="text-xs text-gray-400">{r.date}</span>
                </div>
                <p className="text-sm text-gray-600">{r.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
