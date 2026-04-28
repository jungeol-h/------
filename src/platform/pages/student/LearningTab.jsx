import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Save, ListChecks, ChevronLeft, Plus, Check, X } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

const SUBJECTS = [
  '국어', '영어', '수학', '과학', '사회', '도덕',
  '역사(한국사)', '기술가정', '한문', '정보',
  '교양 독서', '진로 독서', '진로 탐구',
]

const SUBJECT_COLORS = [
  '#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899',
  '#14b8a6','#a855f7','#78716c',
]

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

function TodoScreen({ studentId, onBack }) {
  const { data, addTodoItem, toggleTodo } = useData()
  const today = new Date().toISOString().slice(0, 10)
  const todayItems = data.todoItems.filter(t => t.studentId === studentId && t.date === today)

  const [newSubject, setNewSubject] = useState('수학')
  const [newMin, setNewMin] = useState(30)
  const [adding, setAdding] = useState(false)

  const handleAdd = () => {
    addTodoItem(studentId, { subject: newSubject, plannedMin: newMin })
    setAdding(false)
  }

  const doneCount = todayItems.filter(t => t.done).length

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1 text-gray-500 hover:text-gray-700">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-lg font-bold text-gray-900">오늘의 학습 계획</h2>
        <span className="ml-auto text-sm text-gray-400">{doneCount}/{todayItems.length} 완료</span>
      </div>

      {/* 진행률 바 */}
      {todayItems.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>오늘 달성률</span>
            <span>{todayItems.length > 0 ? Math.round(doneCount / todayItems.length * 100) : 0}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${todayItems.length > 0 ? doneCount / todayItems.length * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* TODO 리스트 */}
      <div className="space-y-2">
        {todayItems.length === 0 && !adding && (
          <div className="text-center text-gray-400 py-10 bg-white rounded-2xl shadow-sm">
            오늘 학습 계획을 추가해보세요
          </div>
        )}
        {todayItems.map(item => (
          <div
            key={item.id}
            onClick={() => toggleTodo(item.id)}
            className={`flex items-center gap-3 p-4 rounded-2xl shadow-sm cursor-pointer transition-all active:scale-[0.98] ${
              item.done ? 'bg-indigo-50' : 'bg-white'
            }`}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              item.done ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'
            }`}>
              {item.done && <Check size={13} className="text-white" strokeWidth={3} />}
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {item.subject}
              </p>
              <p className="text-xs text-gray-400">목표 {item.plannedMin}분</p>
            </div>
          </div>
        ))}
      </div>

      {/* 추가 폼 */}
      {adding ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-bold text-gray-700">과목 선택</p>
          <div className="flex gap-2 flex-wrap">
            {SUBJECTS.map(s => (
              <button
                key={s}
                onClick={() => setNewSubject(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  newSubject === s ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>목표 학습 시간</span>
              <span>{newMin}분</span>
            </div>
            <input
              type="range" min="10" max="120" step="10"
              value={newMin}
              onChange={e => setNewMin(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold active:scale-95"
            >
              추가하기
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold active:scale-95"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-sm font-semibold flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-400 transition-all"
        >
          <Plus size={16} />
          계획 추가
        </button>
      )}
    </div>
  )
}

export default function LearningTab() {
  const { currentUser } = useAuth()
  const { data, addLearningRecord } = useData()

  const [view, setView] = useState('main') // 'main' | 'todo'
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [subject, setSubject] = useState('수학')
  const [focus, setFocus] = useState(80)
  const [saved, setSaved] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const handleSave = () => {
    if (elapsed < 10) return
    const minutes = Math.max(1, Math.round(elapsed / 60))
    addLearningRecord(currentUser.id, { subject, duration: minutes, focus })
    setElapsed(0)
    setRunning(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const records = data.learningRecords.filter(r => r.studentId === currentUser?.id)
  const totalMinutes = records.reduce((sum, r) => sum + r.duration, 0)

  // 과목별 집계 → 파이차트 데이터
  const subjectMap = {}
  records.forEach(r => {
    subjectMap[r.subject] = (subjectMap[r.subject] || 0) + r.duration
  })
  const pieData = Object.entries(subjectMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const today = new Date().toISOString().slice(0, 10)
  const todayTodoCount = data.todoItems?.filter(t => t.studentId === currentUser?.id && t.date === today).length || 0
  const todayTodoDone = data.todoItems?.filter(t => t.studentId === currentUser?.id && t.date === today && t.done).length || 0

  if (view === 'todo') {
    return <TodoScreen studentId={currentUser?.id} onBack={() => setView('main')} />
  }

  return (
    <div className="py-6 space-y-5">
      {/* TODO 리스트 진입 버튼 */}
      <button
        onClick={() => setView('todo')}
        className="w-full bg-indigo-50 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-all"
      >
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <ListChecks size={20} className="text-indigo-600" />
        </div>
        <div className="text-left flex-1">
          <p className="font-bold text-indigo-800 text-sm">오늘의 학습 계획</p>
          <p className="text-xs text-indigo-500 mt-0.5">
            {todayTodoCount === 0 ? '오늘 계획을 세워보세요' : `${todayTodoDone}/${todayTodoCount} 완료`}
          </p>
        </div>
        <span className="text-indigo-400 text-sm">→</span>
      </button>

      {/* 타이머 */}
      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
        <p className="text-sm opacity-80 mb-1">학습 타이머</p>
        <div className="text-5xl font-mono font-bold tracking-widest text-center my-4">
          {formatTime(elapsed)}
        </div>

        {/* 과목 선택 */}
        <div className="flex gap-2 flex-wrap justify-center mb-4">
          {SUBJECTS.map(s => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
                subject === s
                  ? 'bg-white text-indigo-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 집중도 */}
        <div className="mb-4">
          <div className="flex justify-between text-xs opacity-80 mb-1">
            <span>집중도</span>
            <span>{focus}%</span>
          </div>
          <input
            type="range" min="10" max="100" step="10"
            value={focus}
            onChange={e => setFocus(Number(e.target.value))}
            className="w-full accent-white"
          />
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={() => setRunning(r => !r)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
              running ? 'bg-yellow-400 text-yellow-900' : 'bg-white text-indigo-600'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              {running ? <><Pause size={16} /> 일시정지</> : elapsed > 0 ? <><Play size={16} /> 재개</> : <><Play size={16} /> 시작</>}
            </span>
          </button>
          {elapsed >= 10 && (
            <button
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-green-400 text-green-900 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Save size={15} />
              {saved ? '저장됨' : '기록 저장'}
            </button>
          )}
          {elapsed > 0 && (
            <button
              onClick={() => { setElapsed(0); setRunning(false) }}
              className="px-4 py-3 rounded-xl font-bold text-sm bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 누적 통계 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div>
          <p className="text-xs text-gray-500">총 학습시간</p>
          <p className="text-2xl font-bold text-blue-600">{totalMinutes}<span className="text-sm font-normal text-gray-500">분</span></p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">학습 횟수</p>
          <p className="text-2xl font-bold text-indigo-500">{records.length}<span className="text-sm font-normal text-gray-500">회</span></p>
        </div>
      </div>

      {/* 과목별 파이차트 */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">과목별 학습 시간</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={SUBJECT_COLORS[SUBJECTS.indexOf(entry.name) % SUBJECT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v}분`, '학습시간']} />
              <Legend
                formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                iconSize={10}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {pieData.length === 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-gray-400 py-10">
          아직 학습 기록이 없어요
        </div>
      )}
    </div>
  )
}
