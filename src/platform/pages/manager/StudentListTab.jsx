import { useState } from 'react'
import { User, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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


export default function StudentListTab() {
  const { currentUser } = useAuth()
  const { data, getWeeklyLearning } = useData()
  const navigate = useNavigate()

  const myStudentIds = data.assignments
    .filter((a) => a.educatorId === currentUser?.id)
    .map((a) => a.studentId)
  const myStudents = data.students.filter((s) => myStudentIds.includes(s.id))

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">담당 학생 ({myStudents.length}명)</h2>
      <div className="space-y-3">
        {myStudents.map((s) => {
          const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
          const lastMind = data.mindRecords.filter((r) => r.studentId === s.id).slice(-1)[0]
          const records = data.learningRecords.filter((r) => r.studentId === s.id)
          const totalMin = records.reduce((sum, r) => sum + r.duration, 0)
          const chartData = getWeeklyLearning(s.id)
          const hasAlert = data.alerts.some((a) => a.studentId === s.id && !a.resolved)

          return (
            <div
              key={s.id}
              onClick={() => navigate(`/manager/student/${s.id}`)}
              className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <User size={20} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{s.name}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${risk.color}`}>{risk.label}</span>
                    {hasAlert && <AlertCircle size={14} className="text-red-500" />}
                  </div>
                  <p className="text-xs text-gray-400">{s.school} · {s.grade}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">{s.selfIndex}</p>
                  <p className="text-xs text-gray-400">지수</p>
                </div>
              </div>

              {/* 미니 차트 */}
              <ResponsiveContainer width="100%" height={50}>
                <LineChart data={chartData} margin={{ top: 2, right: 4, left: -30, bottom: 0 }}>
                  <Line
                    type="monotone" dataKey="minutes"
                    stroke={s.riskLevel === 'danger' ? '#ef4444' : s.riskLevel === 'warning' ? '#f59e0b' : '#6366f1'}
                    strokeWidth={2} dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-100 text-center">
                <div>
                  <p className="text-sm font-bold text-gray-700">{totalMin}분</p>
                  <p className="text-xs text-gray-400">학습시간</p>
                </div>
                <div>
                  {(() => {
                    const total = lastMind
                      ? (lastMind.mood ?? 0) + (lastMind.motivation ?? 0) + (lastMind.confidence ?? 0)
                      : null
                    return (
                      <>
                        <p className={`text-sm font-bold ${mindScoreColor(total)}`}>{mindScoreLabel(total)}</p>
                        <p className="text-xs text-gray-400">마음 점수</p>
                      </>
                    )
                  })()}
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

      {selected && (
        <StudentDetailModal
          student={selected}
          data={data}
          getWeeklyLearning={getWeeklyLearning}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
