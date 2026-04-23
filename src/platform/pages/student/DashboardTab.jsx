import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

export default function DashboardTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  const student = data.students.find(s => s.id === currentUser?.id)
  const myRecords = data.learningRecords.filter(r => r.studentId === currentUser?.id)
  const myTasks = data.tasks.filter(t => t.studentId === currentUser?.id)
  const todayMind = data.mindRecords.filter(r => r.studentId === currentUser?.id).slice(-1)[0]
  const todayLearning = myRecords.reduce((sum, r) => sum + r.duration, 0)
  const pendingTasks = myTasks.filter(t => t.status === 'pending').length

  const EMOTION_EMOJI = { '좋음': '😊', '보통': '😐', '힘듦': '😓' }

  return (
    <div className="py-6 space-y-4">
      {/* 환영 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80">안녕하세요 👋</p>
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
          <div className="text-4xl">🏆</div>
        </div>
        <div className="mt-3 bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${student?.selfIndex ?? 0}%` }}
          />
        </div>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-2xl">{EMOTION_EMOJI[todayMind?.emotion] || '❓'}</p>
          <p className="text-xs text-gray-500 mt-1">오늘 마인드</p>
          <p className="text-sm font-semibold text-gray-800">{todayMind?.emotion || '미입력'}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-indigo-600">{todayLearning}</p>
          <p className="text-xs text-gray-500 mt-1">학습시간</p>
          <p className="text-sm font-semibold text-gray-800">분</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-orange-500">{pendingTasks}</p>
          <p className="text-xs text-gray-500 mt-1">미완료 과제</p>
          <p className="text-sm font-semibold text-gray-800">개</p>
        </div>
      </div>

      {/* 오늘 날짜 */}
      <p className="text-center text-xs text-gray-400">
        {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </p>
    </div>
  )
}
