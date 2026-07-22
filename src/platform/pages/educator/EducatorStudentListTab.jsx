import { useState, useMemo } from 'react'
import { User, AlertCircle, Search, MonitorSmartphone } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { getMindStatus } from '../../context/selectors/riskDetection.js'
import { actualMinutes } from '../../context/selectors/learningRecords.js'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

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

// 교과강사/컨설턴트 학생 열람 탭 — 전체 활성 학생 대상(배정 필터 없음).
export default function EducatorStudentListTab() {
  const { currentUser } = useAuth()
  const { data, getWeeklyLearning } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const students = useMemo(() => {
    const active = data.students.filter((s) => s.status !== 'inactive')
    const q = query.trim()
    if (!q) return active
    return active.filter((s) => s.name?.includes(q))
  }, [data.students, query])

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">전체 학생 ({students.length}명)</h2>
        <button
          onClick={() => navigate(`/${currentUser.role}/kiosk`)}
          className="px-3 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-all flex-shrink-0"
        >
          <MonitorSmartphone size={15} />
          키오스크 열기
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름으로 검색"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div className="space-y-3">
        {students.map((s) => {
          const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
          const lastMind = data.mindRecords.filter((r) => r.studentId === s.id).slice(-1)[0]
          const records = data.learningRecords.filter((r) => r.studentId === s.id)
          const totalMin = records.reduce((sum, r) => sum + actualMinutes(r), 0)
          const chartData = getWeeklyLearning(s.id)
          const hasAlert = getMindStatus(data.mindRecords.filter((r) => r.studentId === s.id)) !== null

          return (
            <div
              key={s.id}
              onClick={() => navigate(`/${currentUser.role}/student/${s.id}`)}
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
        {students.length === 0 && (
          <div className="text-center text-gray-400 py-12">학생이 없습니다.</div>
        )}
      </div>
    </div>
  )
}
