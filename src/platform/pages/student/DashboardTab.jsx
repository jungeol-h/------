import { Trophy, Clock, BookOpen, AlertCircle, CheckCircle2, Circle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const EMOTION_COLOR = { '좋음': 'text-green-500', '보통': 'text-yellow-500', '힘듦': 'text-red-500' }

const WEEKLY_MOCK = [
  { day: '월', min: 60 }, { day: '화', min: 90 }, { day: '수', min: 45 },
  { day: '목', min: 120 }, { day: '금', min: 75 }, { day: '토', min: 30 }, { day: '일', min: 0 },
]

export default function DashboardTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  const student = data.students.find(s => s.id === currentUser?.id)
  const myRecords = data.learningRecords.filter(r => r.studentId === currentUser?.id)
  const myTasks = data.tasks.filter(t => t.studentId === currentUser?.id)
  const todayMind = data.mindRecords.filter(r => r.studentId === currentUser?.id).slice(-1)[0]
  const todayLearning = myRecords.reduce((sum, r) => sum + r.duration, 0)
  const pendingTasks = myTasks.filter(t => t.status === 'pending').length
  const doneTasks = myTasks.filter(t => t.status === 'done').length

  const weeklyData = WEEKLY_MOCK.map((d, i) => {
    if (i < myRecords.length) return { ...d, min: myRecords[myRecords.length - 1 - i]?.duration || d.min }
    return d
  })

  return (
    <div className="py-6 space-y-4">
      {/* 환영 배너 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80">안녕하세요</p>
        <h2 className="text-xl font-bold mt-0.5">{student?.name || currentUser?.name} 학생</h2>
        <p className="text-sm opacity-70 mt-1">{student?.school} · {student?.grade}</p>
      </div>

      {/* 자기주도지수 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">자기주도지수</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{student?.selfIndex ?? '--'}</p>
          </div>
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
            <Trophy size={28} className="text-yellow-500" />
          </div>
        </div>
        <div className="mt-3 bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${student?.selfIndex ?? 0}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">목표: 100점</p>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className={`flex justify-center mb-1 ${EMOTION_COLOR[todayMind?.emotion] || 'text-gray-300'}`}>
            <BookOpen size={22} />
          </div>
          <p className="text-xs text-gray-500">오늘 마인드</p>
          <p className="text-sm font-semibold text-gray-800">{todayMind?.emotion || '미입력'}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="flex justify-center mb-1 text-indigo-400">
            <Clock size={22} />
          </div>
          <p className="text-xs text-gray-500">오늘 학습</p>
          <p className="text-sm font-semibold text-gray-800">{todayLearning}분</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="flex justify-center mb-1 text-orange-400">
            <AlertCircle size={22} />
          </div>
          <p className="text-xs text-gray-500">미완료 과제</p>
          <p className="text-sm font-semibold text-gray-800">{pendingTasks}개</p>
        </div>
      </div>

      {/* 주간 학습 차트 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-3">이번 주 학습 기록</h3>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => [`${v}분`, '학습시간']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
            <Bar dataKey="min" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 과제 현황 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-3">과제 현황</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            {myTasks.length > 0 && (
              <div
                className="bg-green-400 h-3 rounded-full transition-all"
                style={{ width: `${(doneTasks / myTasks.length) * 100}%` }}
              />
            )}
          </div>
          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
            {doneTasks} / {myTasks.length} 완료
          </span>
        </div>
        {myTasks.slice(0, 3).map(t => (
          <div key={t.id} className="flex items-center gap-2 mt-2 text-sm">
            {t.status === 'done'
              ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
              : <Circle size={16} className="text-gray-300 flex-shrink-0" />
            }
            <span className={t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'}>{t.title}</span>
            <span className="ml-auto text-xs text-gray-400">{t.dueDate}</span>
          </div>
        ))}
      </div>

      {/* 날짜 */}
      <p className="text-center text-xs text-gray-400">
        {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </p>
    </div>
  )
}
