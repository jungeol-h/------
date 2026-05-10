import { User, AlertCircle } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useNavigate } from 'react-router-dom'

const ROLE_LABELS = { student: '학생', manager: '학습매니저', admin: '관리자' }
const RISK_LABELS = {
  normal:  { label: '정상', color: 'text-green-600 bg-green-100' },
  warning: { label: '주의', color: 'text-yellow-600 bg-yellow-100' },
  danger:  { label: '위험', color: 'text-red-600 bg-red-100' },
}

export default function UserManagementTab() {
  const { data } = useData()
  const navigate = useNavigate()

  const managers = data.educators.filter(e => e.role === 'manager')

  return (
    <div className="py-6 space-y-6">
      <h2 className="text-lg font-bold text-gray-900">사용자 관리</h2>

      {/* ── 학생 목록 ── */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 mb-3">학생 ({data.students.length}명)</h3>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs text-gray-400 font-semibold px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span>이름 · 학교</span>
            <span className="w-14 text-center">담당</span>
            <span className="w-10 text-center">위험도</span>
            <span className="w-12 text-right">지수</span>
          </div>
          {data.students.map(s => {
            const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
            const hasAlert = data.alerts.some(a => a.studentId === s.id && !a.resolved)
            const mgr = managers.find(m =>
              data.assignments.some(a => a.studentId === s.id && a.educatorId === m.id)
            )
            return (
              <div
                key={s.id}
                onClick={() => navigate(`/admin/student/${s.id}`)}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center px-3 py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm text-gray-800 truncate">{s.name}</span>
                      {hasAlert && <AlertCircle size={11} className="text-red-500 flex-shrink-0" />}
                    </div>
                    <span className="text-xs text-gray-400 truncate">{s.school} · {s.grade}</span>
                  </div>
                </div>
                <span className="w-14 text-center text-xs text-gray-500 truncate px-1">
                  {mgr ? mgr.name : <span className="text-orange-400">미배정</span>}
                </span>
                <span className={`w-10 text-center text-xs font-semibold px-1 py-0.5 rounded-full ${risk.color}`}>
                  {risk.label}
                </span>
                <span className="w-12 text-right text-sm font-bold text-blue-600">{s.selfIndex}점</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 교육자 목록 ── */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 mb-3">교육자 ({data.educators.length}명)</h3>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] text-xs text-gray-400 font-semibold px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span>이름</span>
            <span className="w-20 text-center">역할</span>
            <span className="w-14 text-right">담당</span>
          </div>
          {data.educators.map(e => {
            const assignedCount = data.assignments.filter(a => a.educatorId === e.id).length
            return (
              <div key={e.id} className="grid grid-cols-[1fr_auto_auto] items-center px-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-gray-400" />
                  </div>
                  <span className="font-semibold text-sm text-gray-800">{e.name}</span>
                </div>
                <span className="w-20 text-center text-xs text-gray-500">{ROLE_LABELS[e.role] || e.role}</span>
                <span className="w-14 text-right text-sm font-bold text-emerald-600">
                  {e.role === 'manager' ? `${assignedCount}명` : '-'}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
