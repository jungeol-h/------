import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

const RISK_LABELS = { normal: { label: '정상', color: 'text-green-600 bg-green-100' }, warning: { label: '주의', color: 'text-yellow-600 bg-yellow-100' }, danger: { label: '위험', color: 'text-red-600 bg-red-100' } }

export default function StudentListTab() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const myStudentIds = data.assignments.filter(a => a.educatorId === currentUser?.id).map(a => a.studentId)
  const myStudents = data.students.filter(s => myStudentIds.includes(s.id))

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">담당 학생 ({myStudents.length}명)</h2>
      <div className="space-y-3">
        {myStudents.map(s => {
          const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
          const lastMind = data.mindRecords.filter(r => r.studentId === s.id).slice(-1)[0]
          const records = data.learningRecords.filter(r => r.studentId === s.id)
          const totalMin = records.reduce((sum, r) => sum + r.duration, 0)
          return (
            <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{s.avatar}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{s.name}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${risk.color}`}>{risk.label}</span>
                  </div>
                  <p className="text-xs text-gray-400">{s.school} · {s.grade}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">{s.selfIndex}</p>
                  <p className="text-xs text-gray-400">지수</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
                <div>
                  <p className="text-sm font-bold text-gray-700">{totalMin}분</p>
                  <p className="text-xs text-gray-400">학습시간</p>
                </div>
                <div>
                  <p className="text-sm font-bold">{lastMind?.emotion || '미입력'}</p>
                  <p className="text-xs text-gray-400">마지막 마인드</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700">{lastMind?.date || '-'}</p>
                  <p className="text-xs text-gray-400">기록일</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
