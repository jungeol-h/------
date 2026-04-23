import { useState } from 'react'
import { useData } from '../../context/DataContext.jsx'

const ROLE_LABELS = { student: '학생', teacher: '강사', manager: '학습매니저', admin: '관리자' }
const RISK_LABELS = {
  normal: { label: '정상', color: 'text-green-600 bg-green-100' },
  warning: { label: '주의', color: 'text-yellow-600 bg-yellow-100' },
  danger: { label: '위험', color: 'text-red-600 bg-red-100' },
}

export default function UserManagementTab() {
  const { data } = useData()
  const [tab, setTab] = useState('mapping') // mapping | students | educators

  const managers = data.educators.filter(e => e.role === 'manager')

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">사용자 관리</h2>

      {/* 서브 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'mapping', label: '배정 현황' },
          { key: 'students', label: `학생 (${data.students.length})` },
          { key: 'educators', label: `교육자 (${data.educators.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* M:N 배정 현황 */}
      {tab === 'mapping' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">학습매니저별 담당 학생 배정 현황</p>
          {managers.map(mgr => {
            const assignedIds = data.assignments.filter(a => a.educatorId === mgr.id).map(a => a.studentId)
            const assigned = data.students.filter(s => assignedIds.includes(s.id))
            return (
              <div key={mgr.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-lg">👤</div>
                  <div>
                    <p className="font-bold text-gray-800">{mgr.name}</p>
                    <p className="text-xs text-gray-400">학습매니저 · 담당 {assigned.length}명</p>
                  </div>
                </div>
                <div className="space-y-2 pl-1">
                  {assigned.length === 0 ? (
                    <p className="text-xs text-gray-400">배정된 학생이 없습니다</p>
                  ) : assigned.map(s => {
                    const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
                    const hasAlert = data.alerts.some(a => a.studentId === s.id && a.managerId === mgr.id && !a.resolved)
                    return (
                      <div key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                        <span className="text-xl">{s.avatar}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-800">{s.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${risk.color}`}>{risk.label}</span>
                            {hasAlert && <span className="text-xs">🚨</span>}
                          </div>
                          <span className="text-xs text-gray-400">{s.school} · {s.grade}</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{s.selfIndex}점</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* 미배정 학생 */}
          {(() => {
            const allAssigned = new Set(data.assignments.map(a => a.studentId))
            const unassigned = data.students.filter(s => !allAssigned.has(s.id))
            if (unassigned.length === 0) return null
            return (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-orange-700 mb-2">⚠️ 미배정 학생 ({unassigned.length}명)</p>
                {unassigned.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm text-orange-700">
                    <span>{s.avatar}</span>
                    <span>{s.name}</span>
                    <span className="text-xs opacity-70">{s.school} · {s.grade}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* 학생 목록 */}
      {tab === 'students' && (
        <div className="space-y-2">
          {data.students.map(s => {
            const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
            const managerIds = data.assignments.filter(a => a.studentId === s.id).map(a => a.educatorId)
            const managers = data.educators.filter(e => managerIds.includes(e.id) && e.role === 'manager')
            return (
              <div key={s.id} className="bg-white rounded-2xl p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.avatar}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${risk.color}`}>{risk.label}</span>
                    </div>
                    <p className="text-xs text-gray-400">{s.school} · {s.grade}</p>
                    {managers.length > 0 && (
                      <p className="text-xs text-blue-500 mt-0.5">담당: {managers.map(m => m.name).join(', ')}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-blue-600">{s.selfIndex}점</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 교육자 목록 */}
      {tab === 'educators' && (
        <div className="space-y-2">
          {data.educators.map(e => {
            const assignedCount = data.assignments.filter(a => a.educatorId === e.id).length
            return (
              <div key={e.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg">👤</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{e.name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[e.role] || e.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">{assignedCount}명</p>
                  <p className="text-xs text-gray-400">담당</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
