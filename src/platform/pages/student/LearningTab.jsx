import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Save, BarChart3, BookOpen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

const SUBJECTS = ['수학', '영어', '국어', '과학', '사회', '기타']

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function LearningTab() {
  const { currentUser } = useAuth()
  const { data, addLearningRecord } = useData()

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

  const records = data.learningRecords
    .filter(r => r.studentId === currentUser?.id)
    .slice()
    .reverse()

  const totalMinutes = records.reduce((sum, r) => sum + r.duration, 0)

  return (
    <div className="py-6 space-y-5">
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
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <BarChart3 size={24} className="text-blue-500" />
        </div>
        <div>
          <p className="text-xs text-gray-500">총 학습시간</p>
          <p className="text-2xl font-bold text-blue-600">{totalMinutes}<span className="text-sm font-normal text-gray-500">분</span></p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">학습 횟수</p>
          <p className="text-2xl font-bold text-indigo-500">{records.length}<span className="text-sm font-normal text-gray-500">회</span></p>
        </div>
      </div>

      {/* 기록 목록 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">학습 기록</h3>
        {records.length === 0 ? (
          <div className="text-center text-gray-400 py-12">아직 학습 기록이 없어요 📖</div>
        ) : (
          <div className="space-y-3">
            {records.map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BookOpen size={18} className="text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-800">{r.subject}</span>
                    <span className="text-xs text-gray-400">{r.date}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">{r.duration}분</span>
                    <span className="text-gray-300">·</span>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 rounded-full bg-gray-100 w-16">
                        <div
                          className="h-1.5 rounded-full bg-blue-400"
                          style={{ width: `${r.focus}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{r.focus}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
