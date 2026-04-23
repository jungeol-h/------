import { useData } from '../../context/DataContext.jsx'

const ROLE_LABELS = { student: '학생', teacher: '강사', manager: '학습매니저', admin: '관리자' }

export default function UserManagementTab() {
  const { data } = useData()

  return (
    <div className="py-6 space-y-5">
      <h2 className="text-lg font-bold text-gray-900">사용자 관리</h2>

      {/* 학생 목록 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">학생 ({data.students.length}명)</h3>
        <div className="space-y-2">
          {data.students.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
              <span className="text-xl">{s.avatar}</span>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                <p className="text-xs text-gray-400">{s.school} · {s.grade}</p>
              </div>
              <span className="text-sm font-bold text-blue-600">{s.selfIndex}점</span>
            </div>
          ))}
        </div>
      </div>

      {/* 교육자 목록 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">교육자 ({data.educators.length}명)</h3>
        <div className="space-y-2">
          {data.educators.map(e => {
            const assignedCount = data.assignments.filter(a => a.educatorId === e.id).length
            return (
              <div key={e.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                <span className="text-xl">👤</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{e.name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[e.role] || e.role}</p>
                </div>
                <span className="text-xs text-gray-500">담당 {assignedCount}명</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
