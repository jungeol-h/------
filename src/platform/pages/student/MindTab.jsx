import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

const EMOTIONS = [
  { value: '좋음', emoji: '😊', label: '좋음', color: 'border-green-400 bg-green-50' },
  { value: '보통', emoji: '😐', label: '보통', color: 'border-yellow-400 bg-yellow-50' },
  { value: '힘듦', emoji: '😓', label: '힘듦', color: 'border-red-400 bg-red-50' },
]

export default function MindTab() {
  const { currentUser } = useAuth()
  const { data, addMindRecord } = useData()

  const [emotion, setEmotion] = useState('')
  const [motivation, setMotivation] = useState(3)
  const [confidence, setConfidence] = useState(3)
  const [memo, setMemo] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const myRecords = data.mindRecords
    .filter(r => r.studentId === currentUser?.id)
    .slice()
    .reverse()
    .slice(0, 5)

  const handleSubmit = () => {
    if (!emotion) return
    addMindRecord(currentUser.id, { emotion, motivation, confidence, memo })
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2000)
    setEmotion('')
    setMotivation(3)
    setConfidence(3)
    setMemo('')
  }

  return (
    <div className="py-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">오늘 마음은 어때요?</h2>
        <p className="text-sm text-gray-500 mt-0.5">솔직하게 기록해 주세요 💚</p>
      </div>

      {/* 감정 선택 */}
      <div className="grid grid-cols-3 gap-3">
        {EMOTIONS.map(({ value, emoji, label, color }) => (
          <button
            key={value}
            onClick={() => setEmotion(value)}
            className={`flex flex-col items-center py-4 rounded-2xl border-2 transition-all ${
              emotion === value ? color + ' scale-105 shadow-md' : 'border-gray-200 bg-white'
            }`}
          >
            <span className="text-3xl">{emoji}</span>
            <span className="text-sm font-semibold mt-1 text-gray-700">{label}</span>
          </button>
        ))}
      </div>

      {/* 동기 슬라이더 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">학습 동기</span>
            <span className="font-bold text-blue-600">{motivation}점</span>
          </div>
          <input
            type="range" min="1" max="5" value={motivation}
            onChange={e => setMotivation(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>전혀 없음</span><span>매우 높음</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">자신감</span>
            <span className="font-bold text-indigo-600">{confidence}점</span>
          </div>
          <input
            type="range" min="1" max="5" value={confidence}
            onChange={e => setConfidence(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>전혀 없음</span><span>매우 높음</span>
          </div>
        </div>
      </div>

      {/* 메모 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <label className="text-sm font-medium text-gray-700">한마디 (선택)</label>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="오늘 기분을 자유롭게 적어보세요..."
          rows={3}
          className="w-full mt-2 text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!emotion}
        className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
          emotion
            ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95 shadow-md'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {submitted ? '✅ 저장됐어요!' : '마인드 저장하기'}
      </button>

      {/* 최근 기록 */}
      {myRecords.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-3">최근 기록</h3>
          <div className="space-y-2">
            {myRecords.map(r => {
              const em = EMOTIONS.find(e => e.value === r.emotion)
              return (
                <div key={r.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                  <span className="text-2xl">{em?.emoji || '❓'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold text-gray-800">{r.emotion}</span>
                      <span className="text-xs text-gray-400">{r.date}</span>
                    </div>
                    <span className="text-xs text-gray-500">동기 {r.motivation}점 · 자신감 {r.confidence}점</span>
                    {r.memo && <p className="text-xs text-gray-500 mt-0.5">"{r.memo}"</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
