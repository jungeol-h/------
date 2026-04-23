import { useState } from 'react'
import { X, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const RISK_LABELS = {
  normal: { label: '정상', color: 'text-green-600 bg-green-100' },
  warning: { label: '주의', color: 'text-yellow-600 bg-yellow-100' },
  danger: { label: '위험', color: 'text-red-600 bg-red-100' },
}

const EMOTION_COLOR = { '좋음': 'text-green-600', '보통': 'text-yellow-600', '힘듦': 'text-red-600' }

const WEEKLY_MOCK_BY_STUDENT = {
  s1: [{ day: '월', min: 60 }, { day: '화', min: 90 }, { day: '수', min: 45 }, { day: '목', min: 100 }, { day: '금', min: 75 }],
  s2: [{ day: '월', min: 80 }, { day: '화', min: 110 }, { day: '수', min: 60 }, { day: '목', min: 130 }, { day: '금', min: 95 }],
  s3: [{ day: '월', min: 30 }, { day: '화', min: 20 }, { day: '수', min: 45 }, { day: '목', min: 15 }, { day: '금', min: 30 }],
  s4: [{ day: '월', min: 70 }, { day: '화', min: 85 }, { day: '수', min: 60 }, { day: '목', min: 90 }, { day: '금', min: 80 }],
  s5: [{ day: '월', min: 20 }, { day: '화', min: 10 }, { day: '수', min: 0 }, { day: '목', min: 15 }, { day: '금', min: 5 }],
}

function StudentDetailModal({ student, data, onClose }) {
  const mindHistory = data.mindRecords.filter(r => r.studentId === student.id).slice(-7)
  const chartData = WEEKLY_MOCK_BY_STUDENT[student.id] || []
  const risk = RISK_LABELS[student.riskLevel] || RISK_LABELS.normal
  const tasks = data.tasks.filter(t => t.studentId === student.id)
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalMin = data.learningRecords.filter(r => r.studentId === student.id).reduce((s, r) => s + r.duration, 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{student.avatar}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-lg">{student.name}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${risk.color}`}>{risk.label}</span>
                </div>
                <p className="text-xs text-gray-400">{student.school} · {student.grade}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
          </div>

          {/* 핵심 지표 */}
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

          {/* 주간 학습 차트 */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-2">이번 주 학습시간 (분)</h4>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v}분`, '학습시간']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                />
                <Line
                  type="monotone" dataKey="min" stroke="#6366f1" strokeWidth={2.5}
                  dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 마인드 기록 */}
          {mindHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">최근 마인드 기록</h4>
              <div className="space-y-2">
                {mindHistory.slice().reverse().map(m => (
                  <div key={m.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">{m.date}</span>
                    <span className={`font-semibold ${EMOTION_COLOR[m.emotion] || ''}`}>{m.emotion}</span>
                    <span className="text-gray-400 text-xs">동기 {m.motivation} / 자신감 {m.confidence}</span>
                    {m.memo && <span className="text-xs text-gray-500 truncate">"{m.memo}"</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StudentListTab() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const [selected, setSelected] = useState(null)

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
          const chartData = WEEKLY_MOCK_BY_STUDENT[s.id] || []
          const hasAlert = data.alerts.some(a => a.studentId === s.id && !a.resolved)

          return (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{s.avatar}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{s.name}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${risk.color}`}>{risk.label}</span>
                    {hasAlert && <span className="text-xs">🚨</span>}
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
                    type="monotone" dataKey="min"
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
                  <p className={`text-sm font-bold ${EMOTION_COLOR[lastMind?.emotion] || 'text-gray-500'}`}>
                    {lastMind?.emotion || '미입력'}
                  </p>
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

      {selected && (
        <StudentDetailModal
          student={selected}
          data={data}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
