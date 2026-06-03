import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { COUNSELING_TYPE_LABELS } from '../../data/counselingTypes.js'
import CounselingFormModal from '../../components/counseling/CounselingFormModal.jsx'

export default function CounselingTab() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const [showForm, setShowForm] = useState(false)

  // 관리자는 전체 상담 기록 열람·작성
  const records = data.counselingRecords
    .slice()
    .reverse()

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">상담 기록</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
        >
          <Plus size={16} /> 새 상담
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center text-gray-400 py-16">상담 기록이 없어요 💬</div>
      ) : (
        <div className="space-y-3">
          {records.map(r => {
            const student = data.students.find(s => s.id === r.studentId)
            const author = data.educators.find(e => e.id === r.educatorId)
            return (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{student?.name || '학생'}</span>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{COUNSELING_TYPE_LABELS[r.type] || r.type}</span>
                  </div>
                  <span className="text-xs text-gray-400">{r.date}</span>
                </div>
                <p className="text-sm text-gray-600">{r.comment}</p>
                {author && (
                  <p className="text-xs text-gray-400 mt-2">작성: {author.name}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <CounselingFormModal
          students={data.students}
          authorId={currentUser?.id}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
