import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

const INTEREST_QUESTIONS = [
  { id: 'q1', text: '새로운 것을 만들고 발명하는 걸 좋아한다', category: '공학/기술' },
  { id: 'q2', text: '수학 문제를 풀 때 흥미를 느낀다', category: '이학/수학' },
  { id: 'q3', text: '다른 사람을 가르치거나 돕는 게 보람 있다', category: '교육/사회' },
  { id: 'q4', text: '그림·음악·글쓰기 같은 창작 활동이 즐겁다', category: '예술/문화' },
  { id: 'q5', text: '사람들 앞에서 발표하거나 설득하는 게 자신 있다', category: '경영/리더십' },
  { id: 'q6', text: '동물, 식물, 자연환경에 관심이 많다', category: '생명/환경' },
]

const CAREER_PROFILES = {
  '공학/기술': { emoji: '⚙️', title: '엔지니어형', desc: '문제를 분석하고 시스템을 구축하는 능력이 뛰어납니다. 소프트웨어·기계·전자 분야가 잘 맞아요.', careers: ['소프트웨어 개발자', '기계공학자', '전기전자공학자', 'AI 연구원'] },
  '이학/수학': { emoji: '🔬', title: '탐구형', desc: '논리적 사고와 분석력이 강점입니다. 연구·통계·데이터 분야에서 빛을 발해요.', careers: ['수학자', '데이터 과학자', '물리학자', '통계 분석가'] },
  '교육/사회': { emoji: '🌱', title: '사회기여형', desc: '사람을 돕고 사회에 기여하는 데서 동기를 얻습니다. 교육·상담·복지 분야가 맞아요.', careers: ['교사', '상담사', '사회복지사', '간호사'] },
  '예술/문화': { emoji: '🎨', title: '창의예술형', desc: '창의적 표현과 감수성이 풍부합니다. 예술·디자인·미디어 분야에서 역량을 발휘해요.', careers: ['디자이너', '작가', '영상 크리에이터', '음악가'] },
  '경영/리더십': { emoji: '🚀', title: '리더십형', desc: '소통 능력과 추진력이 강점입니다. 경영·기획·창업 분야에 강점이 있어요.', careers: ['경영 컨설턴트', '창업가', '마케터', '프로젝트 매니저'] },
  '생명/환경': { emoji: '🌿', title: '자연탐구형', desc: '생명과 환경에 대한 관심이 높습니다. 의료·생명공학·환경 분야가 잘 맞아요.', careers: ['의사', '생명공학자', '환경공학자', '수의사'] },
}

const REPORT_STAGES = ['주제선택', '자료수집', '개요작성', '초고쓰기', '첨삭1', '고쳐쓰기', '첨삭2', '완성']
const CURRENT_STAGE = 3

function ReportProgress() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-gray-800">진로 탐구 보고서 진행률</h4>
        <span className="text-sm font-bold text-violet-600">{CURRENT_STAGE}/8 단계</span>
      </div>
      <div className="flex gap-1 mb-2">
        {REPORT_STAGES.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-full ${i < CURRENT_STAGE ? 'bg-violet-500' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <div className="flex gap-1">
        {REPORT_STAGES.map((stage, i) => (
          <div key={i} className="flex-1 text-center">
            <p className={`text-[9px] leading-tight ${i < CURRENT_STAGE ? 'text-violet-600 font-semibold' : 'text-gray-400'}`}>{stage}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const ACTIVITY_RECORDS = [
  { date: '2026-04-15', title: '이공계 진로 탐색 세미나', badge: '강연' },
  { date: '2026-04-10', title: '자기소개서 기초 특강', badge: '특강' },
  { date: '2026-03-28', title: '직업 가치관 검사 실시', badge: '검사' },
]

export default function CareerTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  const student = data.students.find(s => s.id === currentUser?.id)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [step, setStep] = useState('intro') // intro | survey | result

  const toggle = (qid, category) => {
    setAnswers(prev => ({ ...prev, [qid]: prev[qid] ? null : category }))
  }

  const handleSubmit = () => {
    const counts = {}
    Object.values(answers).forEach(cat => {
      if (cat) counts[cat] = (counts[cat] || 0) + 1
    })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    setResult(top ? CAREER_PROFILES[top[0]] : CAREER_PROFILES['이학/수학'])
    setStep('result')
  }

  const answeredCount = Object.values(answers).filter(Boolean).length

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">진로 설계</h2>

      {step === 'intro' && (
        <>
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-xl font-bold">진로 흥미 탐색</h3>
            <p className="text-sm opacity-80 mt-1 mb-4">6개 질문으로 나에게 맞는 진로 유형을 찾아보세요</p>
            <button
              onClick={() => setStep('survey')}
              className="w-full py-3 bg-white text-violet-600 rounded-xl font-bold hover:bg-violet-50 active:scale-95 transition-all"
            >
              탐색 시작하기 →
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-3">진로 활동 기록</h4>
            <div className="space-y-2">
              {ACTIVITY_RECORDS.map((act, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-semibold">{act.badge}</span>
                  <span className="flex-1 text-sm text-gray-700">{act.title}</span>
                  <span className="text-xs text-gray-400">{act.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 진로 탐구 보고서 진행률 */}
          <ReportProgress />
        </>
      )}

      {step === 'survey' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">해당하는 항목을 모두 선택하세요 ({answeredCount}/6)</p>
          {INTEREST_QUESTIONS.map(q => {
            const selected = !!answers[q.id]
            return (
              <button
                key={q.id}
                onClick={() => toggle(q.id, q.category)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                  selected
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                    selected ? 'border-violet-500 bg-violet-500 text-white' : 'border-gray-300'
                  }`}>
                    {selected ? '✓' : ''}
                  </span>
                  <div>
                    <p className={`font-semibold text-sm ${selected ? 'text-violet-800' : 'text-gray-800'}`}>{q.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{q.category}</p>
                  </div>
                </div>
              </button>
            )
          })}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('intro')}
              className="px-5 py-3 rounded-xl text-gray-500 bg-gray-100 font-semibold text-sm"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={answeredCount === 0}
              className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
            >
              결과 확인하기
            </button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg text-center">
            <div className="text-5xl mb-3">{result.emoji}</div>
            <p className="text-sm opacity-80">{student?.name} 학생의 진로 유형</p>
            <h3 className="text-2xl font-bold mt-1">{result.title}</h3>
            <p className="text-sm opacity-80 mt-3 leading-relaxed">{result.desc}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-3">추천 직업군</h4>
            <div className="grid grid-cols-2 gap-2">
              {result.careers.map((c, i) => (
                <div key={i} className="bg-violet-50 rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 text-center">
                  {c}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-3">진로 활동 기록</h4>
            <div className="space-y-2">
              {ACTIVITY_RECORDS.map((act, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-semibold">{act.badge}</span>
                  <span className="flex-1 text-sm text-gray-700">{act.title}</span>
                  <span className="text-xs text-gray-400">{act.date}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setStep('intro'); setAnswers({}); setResult(null) }}
            className="w-full py-3 rounded-xl border-2 border-violet-200 text-violet-600 font-bold text-sm active:scale-95 transition-all"
          >
            다시 탐색하기
          </button>
        </div>
      )}
    </div>
  )
}
