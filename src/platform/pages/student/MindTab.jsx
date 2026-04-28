import { useState } from 'react'
import { Check, BookHeart, NotebookPen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

function scoreColor(total) {
  if (total > 3) return 'text-blue-600'
  if (total < -3) return 'text-red-600'
  return 'text-gray-600'
}

function scoreLabel(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

const SLIDERS = [
  { key: 'mood', label: '기분', accent: 'accent-rose-500' },
  { key: 'motivation', label: '학습 동기', accent: 'accent-blue-500' },
  { key: 'confidence', label: '자신감', accent: 'accent-indigo-500' },
]

export default function MindTab() {
  const { currentUser } = useAuth()
  const { data, addMindRecord, addDiaryRecord } = useData()

  const [subView, setSubView] = useState('mind')

  // 마음 기록 상태
  const [scores, setScores] = useState({ mood: 0, motivation: 0, confidence: 0 })
  const [memo, setMemo] = useState('')
  const [mindSubmitted, setMindSubmitted] = useState(false)

  // 일기 상태
  const [praise, setPraise] = useState('')
  const [reflection, setReflection] = useState('')
  const [resolution, setResolution] = useState('')
  const [diarySubmitted, setDiarySubmitted] = useState(false)

  const myRecords = data.mindRecords
    .filter(r => r.studentId === currentUser?.id)
    .slice()
    .reverse()
    .slice(0, 5)

  const handleMindSubmit = () => {
    addMindRecord(currentUser.id, { ...scores, memo })
    setMindSubmitted(true)
    setTimeout(() => setMindSubmitted(false), 2000)
    setScores({ mood: 0, motivation: 0, confidence: 0 })
    setMemo('')
  }

  const handleDiarySubmit = () => {
    addDiaryRecord(currentUser.id, { praise, reflection, resolution })
    setDiarySubmitted(true)
    setTimeout(() => setDiarySubmitted(false), 2000)
    setPraise('')
    setReflection('')
    setResolution('')
  }

  return (
    <div className="py-6 space-y-5">
      {/* 서브뷰 토글 */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
        <button
          onClick={() => setSubView('mind')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            subView === 'mind' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500'
          }`}
        >
          <BookHeart size={16} />
          마음 기록
        </button>
        <button
          onClick={() => setSubView('diary')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            subView === 'diary' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500'
          }`}
        >
          <NotebookPen size={16} />
          오늘의 일기
        </button>
      </div>

      {subView === 'mind' ? (
        <>
          <div>
            <h2 className="text-lg font-bold text-gray-900">마인드 체크</h2>
            <p className="text-sm text-gray-500 mt-0.5">솔직하게 기록해 주세요</p>
          </div>

          {/* 슬라이더 3개 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-5">
            {SLIDERS.map(({ key, label, accent }) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700">{label}</span>
                  <span className={`font-bold text-base ${scores[key] > 0 ? 'text-blue-600' : scores[key] < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {scoreLabel(scores[key])}점
                  </span>
                </div>
                <input
                  type="range" min="-5" max="5" step="1"
                  value={scores[key]}
                  onChange={e => setScores(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  className={`w-full ${accent}`}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>매우 낮음</span><span>매우 높음</span>
                </div>
              </div>
            ))}
          </div>

          {/* 합산 미리보기 */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">오늘의 마음 점수</span>
            <span className={`text-lg font-bold ${scoreColor(scores.mood + scores.motivation + scores.confidence)}`}>
              {scoreLabel(scores.mood + scores.motivation + scores.confidence)}점 / 15점
            </span>
          </div>

          {/* 메모 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="text-sm font-medium text-gray-700">제 얘기 좀 들어주세요. (선택)</label>
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
            onClick={handleMindSubmit}
            className="w-full py-4 rounded-2xl font-bold text-base bg-blue-500 text-white hover:bg-blue-600 active:scale-95 shadow-md transition-all flex items-center justify-center gap-2"
          >
            {mindSubmitted ? <><Check size={18} /> 저장됐어요!</> : '마인드 저장하기'}
          </button>

          {/* 최근 기록 */}
          {myRecords.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">최근 기록</h3>
              <div className="space-y-2">
                {myRecords.map(r => {
                  const total = (r.mood ?? 0) + (r.motivation ?? 0) + (r.confidence ?? 0)
                  return (
                    <div key={r.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        total > 3 ? 'bg-blue-50' : total < -3 ? 'bg-red-50' : 'bg-gray-50'
                      }`}>
                        <span className={`text-sm font-bold ${scoreColor(total)}`}>{scoreLabel(total)}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className={`text-sm font-semibold ${scoreColor(total)}`}>합계 {scoreLabel(total)}점</span>
                          <span className="text-xs text-gray-400">{r.date}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          기분 {scoreLabel(r.mood ?? 0)} · 동기 {scoreLabel(r.motivation ?? 0)} · 자신감 {scoreLabel(r.confidence ?? 0)}
                        </span>
                        {r.memo && <p className="text-xs text-gray-500 mt-0.5">"{r.memo}"</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-bold text-gray-900">오늘의 일기</h2>
            <p className="text-sm text-gray-500 mt-0.5">하루를 세 줄로 돌아봐요</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div>
              <label className="text-sm font-semibold text-green-600">오늘 내가 칭찬할 점</label>
              <textarea
                value={praise}
                onChange={e => setPraise(e.target.value)}
                placeholder="오늘 잘한 것, 뿌듯한 것을 적어보세요"
                rows={2}
                className="w-full mt-2 text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-orange-500">반성할 점</label>
              <textarea
                value={reflection}
                onChange={e => setReflection(e.target.value)}
                placeholder="아쉬웠던 것, 더 잘할 수 있었던 것을 적어보세요"
                rows={2}
                className="w-full mt-2 text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-blue-600">내일의 다짐</label>
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                placeholder="내일 꼭 실천할 것을 적어보세요"
                rows={2}
                className="w-full mt-2 text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          <button
            onClick={handleDiarySubmit}
            className="w-full py-4 rounded-2xl font-bold text-base bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 shadow-md transition-all flex items-center justify-center gap-2"
          >
            {diarySubmitted ? <><Check size={18} /> 저장됐어요!</> : '일기 저장하기'}
          </button>

          {/* 오늘 일기 존재 여부 표시 */}
          {(() => {
            const today = new Date().toISOString().slice(0, 10)
            const todayDiary = data.diaryRecords.find(d => d.studentId === currentUser?.id && d.date === today)
            return todayDiary ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                오늘 일기가 저장되어 있어요. 수정하면 덮어써집니다.
              </div>
            ) : null
          })()}
        </>
      )}
    </div>
  )
}
