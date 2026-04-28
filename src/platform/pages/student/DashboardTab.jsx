import { Trophy, Clock, AlertCircle, CheckCircle2, Circle, Sun, Cloud, CloudRain, Cloudy } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function getMoodWeather(mindRecord) {
  if (!mindRecord) return { Icon: Cloud, color: 'text-gray-300', label: '미입력' }
  const total = (mindRecord.mood ?? 0) + (mindRecord.motivation ?? 0) + (mindRecord.confidence ?? 0)
  if (total > 3) return { Icon: Sun, color: 'text-yellow-400', label: '맑음' }
  if (total >= 0) return { Icon: Cloud, color: 'text-blue-300', label: '흐림' }
  if (total >= -2) return { Icon: CloudRain, color: 'text-blue-500', label: '비' }
  return { Icon: Cloudy, color: 'text-gray-400', label: '흐린 날' }
}

export default function DashboardTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  const student = data.students.find(s => s.id === currentUser?.id)
  const myRecords = data.learningRecords.filter(r => r.studentId === currentUser?.id)
  const myTasks = data.tasks.filter(t => t.studentId === currentUser?.id)
  const todayMind = data.mindRecords.filter(r => r.studentId === currentUser?.id).slice(-1)[0]
  const pendingTasks = myTasks.filter(t => t.status === 'pending').length
  const doneTasks = myTasks.filter(t => t.status === 'done').length

  // 오늘 과목별 학습 시간
  const today = new Date().toISOString().slice(0, 10)
  const todayRecords = myRecords.filter(r => r.date === today)
  const subjectMap = {}
  todayRecords.forEach(r => { subjectMap[r.subject] = (subjectMap[r.subject] || 0) + r.duration })
  const subjectData = Object.entries(subjectMap).map(([subject, duration]) => ({ subject, duration }))
  const todayTotalMin = subjectData.reduce((sum, d) => sum + d.duration, 0)

  const { Icon: WeatherIcon, color: weatherColor, label: weatherLabel } = getMoodWeather(todayMind)

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
          <div className={`flex justify-center mb-1 ${weatherColor}`}>
            <WeatherIcon size={22} />
          </div>
          <p className="text-xs text-gray-500">오늘 마인드</p>
          <p className="text-sm font-semibold text-gray-800">{weatherLabel}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="flex justify-center mb-1 text-indigo-400">
            <Clock size={22} />
          </div>
          <p className="text-xs text-gray-500">오늘 학습</p>
          <p className="text-sm font-semibold text-gray-800">{todayTotalMin}분</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className={`flex justify-center mb-1 ${pendingTasks > 0 ? 'text-red-400' : 'text-orange-400'}`}>
            <AlertCircle size={22} />
          </div>
          <p className="text-xs text-gray-500">미완료 과제</p>
          <p className={`text-sm font-semibold ${pendingTasks > 0 ? 'text-red-600' : 'text-gray-800'}`}>{pendingTasks}개</p>
        </div>
      </div>

      {/* 오늘 과목별 학습 차트 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-3">오늘 과목별 학습</h3>
        {subjectData.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">오늘 학습 기록이 없어요</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(80, subjectData.length * 36)}>
            <BarChart data={subjectData} layout="vertical" margin={{ top: 0, right: 30, left: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="분" />
              <YAxis type="category" dataKey="subject" tick={{ fontSize: 11, fill: '#4b5563' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                formatter={(v) => [`${v}분`, '학습시간']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                {subjectData.map((_, i) => (
                  <Cell key={i} fill={['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'][i % 6]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
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
          <div key={t.id} className={`flex items-center gap-2 mt-2 text-sm rounded-lg px-2 py-1.5 ${
            t.status === 'pending' ? 'bg-red-50' : ''
          }`}>
            {t.status === 'done'
              ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
              : <Circle size={16} className="text-red-300 flex-shrink-0" />
            }
            <span className={t.status === 'done' ? 'text-gray-400 line-through' : 'text-red-700 font-medium'}>{t.title}</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
              t.status === 'pending' ? 'bg-red-100 text-red-600' : 'text-gray-400'
            }`}>{t.dueDate}</span>
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
