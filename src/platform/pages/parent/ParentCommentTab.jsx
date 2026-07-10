import { MessageSquare } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { COUNSELING_TYPE_LABELS, COUNSELING_TARGET_LABELS } from '../../data/counselingTypes.js'
import CounselingRecordBody from '../../components/counseling/CounselingRecordBody.jsx'

const TYPE_COLORS = {
  career_path: 'text-violet-700 bg-violet-100',
  assessment: 'text-cyan-700 bg-cyan-100',
  subject_learning: 'text-blue-700 bg-blue-100',
  self_directed: 'text-emerald-700 bg-emerald-100',
  adjustment: 'text-amber-700 bg-amber-100',
  etc: 'text-gray-600 bg-gray-100',
  // 구 체계 (기존 기록 표시용)
  mind: 'text-pink-700 bg-pink-100',
  career: 'text-violet-700 bg-violet-100',
  study: 'text-blue-700 bg-blue-100',
  habit: 'text-amber-700 bg-amber-100',
}

export default function ParentCommentTab({ child }) {
  const { data } = useData()
  const studentId = child.id

  const educatorName = (id) =>
    data.educators.find((e) => e.id === id)?.name ?? '선생님'

  const records = data.counselingRecords
    .filter((r) => r.studentId === studentId)
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))

  return (
    <div className="py-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{child.name} 코멘트</h2>
        <p className="text-xs text-gray-500 mt-0.5">선생님이 남긴 상담 기록</p>
      </div>

      {records.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center gap-3 text-gray-400">
          <MessageSquare size={36} className="text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">아직 코멘트가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const typeColor = TYPE_COLORS[r.type] ?? TYPE_COLORS.etc
            return (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${typeColor}`}>
                      {COUNSELING_TYPE_LABELS[r.type] || r.type}
                    </span>
                    {r.targetType && r.targetType !== 'student' && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {COUNSELING_TARGET_LABELS[r.targetType] ?? r.targetType} 상담
                      </span>
                    )}
                    <span className="text-xs font-semibold text-gray-500">
                      {educatorName(r.educatorId)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{r.date}</span>
                </div>
                <CounselingRecordBody
                  record={r}
                  fallback={r.comment}
                  className="text-sm text-gray-800 leading-relaxed"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
