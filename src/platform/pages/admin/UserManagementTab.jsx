import { useState } from 'react'
import { User, X } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const ROLE_LABELS = { student: '학생', teacher: '강사', manager: '학습매니저', admin: '관리자' }
const RISK_LABELS = {
  normal: { label: '정상', color: 'text-green-600 bg-green-100' },
  warning: { label: '주의', color: 'text-yellow-600 bg-yellow-100' },
  danger: { label: '위험', color: 'text-red-600 bg-red-100' },
}

function mindScoreColor(total) {
  if (total === null || total === undefined) return 'text-gray-400'
  if (total > 3) return 'text-blue-600'
  if (total < -3) return 'text-red-600'
  return 'text-gray-600'
}

function mindScoreLabel(total) {
  if (total === null || total === undefined) return '미입력'
  return total > 0 ? `+${total}` : String(total)
}

function StudentDetailModal({ student, data, getWeeklyLearning, onClose }) {
  const mindHistory = data.mindRecords.filter((r) => r.studentId === student.id).slice(-7)
  const chartData = getWeeklyLearning(student.id)
  const risk = RISK_LABELS[student.riskLevel] || RISK_LABELS.normal
  const tasks = data.tasks.filter((t) => t.studentId === student.id)
  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const totalMin = data.learningRecords
    .filter((r) => r.studentId === student.id)
    .reduce((s, r) => s + r.duration, 0)
  const managerIds = data.assignments.filter((a) => a.studentId === student.id).map((a) => a.educatorId)
  const managers = data.educators.filter((e) => managerIds.includes(e.id) && e.role === 'manager')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <User size={24} className="text-gray-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-lg">{student.name}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${risk.color}`}>{risk.label}</span>
                </div>
                <p className="text-xs text-gray-400">{student.school} · {student.grade}</p>
                {managers.length > 0 && (
                  <p className="text-xs text-blue-500 mt-0.5">담당: {managers.map((m) => m.name).join(', ')}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{student.selfIndex}</p>
              <p className="text-xs text-gray-500 mt-0.5">자기주도지수</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-indigo-600">{totalMin}분</p>
              <p className="text-xs text-gray-500 mt-0.5">총 학습시간</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{doneTasks}/{tasks.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">과제 완료</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-2">최근 7일 학습시간 (분)</h4>
            {chartData.some((d) => d.minutes > 0) ? (
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [`${v}분`, '학습시간']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  />
                  <Line type="monotone" dataKey="minutes" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">최근 7일 학습 기록 없음</p>
            )}
          </div>

          {mindHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">최근 마인드 기록</h4>
              <div className="space-y-2">
                {mindHistory.slice().reverse().map((m) => {
                  const total = (m.mood ?? 0) + (m.motivation ?? 0) + (m.confidence ?? 0)
                  return (
                    <div key={m.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{m.date}</span>
                      <span className={`font-semibold text-sm ${mindScoreColor(total)}`}>합계 {mindScoreLabel(total)}</span>
                      <span className="text-gray-400 text-xs">기분 {m.mood ?? 0} / 동기 {m.motivation ?? 0} / 자신감 {m.confidence ?? 0}</span>
                      {m.memo && <span className="text-xs text-gray-500 truncate">"{m.memo}"</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function UserManagementTab() {
  const { data, getWeeklyLearning } = useData()
  const [tab, setTab] = useState('mapping') // mapping | students | educators
  const [selectedStudent, setSelectedStudent] = useState(null)

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
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><User size={14} className="text-gray-400" /></div>
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
                    <User size={14} className="text-orange-400" />
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
            const mgrs = data.educators.filter(e => managerIds.includes(e.id) && e.role === 'manager')
            return (
              <div
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className="bg-white rounded-2xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><User size={18} className="text-gray-400" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${risk.color}`}>{risk.label}</span>
                    </div>
                    <p className="text-xs text-gray-400">{s.school} · {s.grade}</p>
                    {mgrs.length > 0 && (
                      <p className="text-xs text-blue-500 mt-0.5">담당: {mgrs.map(m => m.name).join(', ')}</p>
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

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          data={data}
          getWeeklyLearning={getWeeklyLearning}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}
