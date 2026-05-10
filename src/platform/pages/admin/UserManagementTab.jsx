import { User, AlertCircle } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useNavigate } from 'react-router-dom'

const ROLE_LABELS = { student: '학생', teacher: '강사', manager: '학습매니저', admin: '관리자' }
const RISK_LABELS = {
  normal:  { label: '정상', color: 'text-green-600 bg-green-100' },
  warning: { label: '주의', color: 'text-yellow-600 bg-yellow-100' },
  danger:  { label: '위험', color: 'text-red-600 bg-red-100' },
}

export default function UserManagementTab() {
  const { data } = useData()
  const navigate = useNavigate()

  const managers = data.educators.filter(e => e.role === 'manager')
  const allAssignedIds = new Set(data.assignments.map(a => a.studentId))
  const unassigned = data.students.filter(s => !allAssignedIds.has(s.id))

  return (
    <div className="py-6 space-y-6">
      <h2 className="text-lg font-bold text-gray-900">사용자 관리</h2>

      {/* ── 매니저별 담당 학생 ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">매니저별 담당 학생</h3>
        {managers.map(mgr => {
          const assignedIds = data.assignments.filter(a => a.educatorId === mgr.id).map(a => a.studentId)
          const assigned = data.students.filter(s => assignedIds.includes(s.id))
          return (
            <div key={mgr.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 매니저 헤더 */}
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border-b border-emerald-100">
                <div className="w-8 h-8 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-emerald-700" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{mgr.name}</p>
                  <p className="text-xs text-emerald-600">학습매니저 · 담당 {assigned.length}명</p>
                </div>
              </div>
              {/* 담당 학생 목록 */}
              {assigned.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3">배정된 학생이 없습니다</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {assigned.map(s => {
                    const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
                    const hasAlert = data.alerts.some(a => a.studentId === s.id && !a.resolved)
                    return (
                      <div
                        key={s.id}
                        onClick={() => navigate(`/admin/student/${s.id}`)}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <User size={13} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-gray-800">{s.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${risk.color}`}>{risk.label}</span>
                            {hasAlert && <AlertCircle size={12} className="text-red-500 flex-shrink-0" />}
                          </div>
                          <span className="text-xs text-gray-400">{s.school} · {s.grade}</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600 flex-shrink-0">{s.selfIndex}점</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* 미배정 학생 */}
        {unassigned.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-orange-700 mb-2">미배정 학생 ({unassigned.length}명)</p>
            <div className="space-y-1">
              {unassigned.map(s => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/admin/student/${s.id}`)}
                  className="flex items-center gap-2 text-sm text-orange-700 cursor-pointer"
                >
                  <User size={13} className="text-orange-400 flex-shrink-0" />
                  <span>{s.name}</span>
                  <span className="text-xs opacity-70">{s.school} · {s.grade}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── 교육자 목록 ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
          교육자 ({data.educators.length}명)
        </h3>
        <div className="space-y-2">
          {data.educators.map(e => {
            const assignedCount = data.assignments.filter(a => a.educatorId === e.id).length
            return (
              <div key={e.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{e.name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[e.role] || e.role}</p>
                </div>
                {e.role === 'manager' && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">{assignedCount}명</p>
                    <p className="text-xs text-gray-400">담당</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
