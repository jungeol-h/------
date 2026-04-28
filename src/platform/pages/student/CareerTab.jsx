import { useState } from 'react'
import { ChevronRight, ChevronLeft, RotateCcw, History } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

// ─── 계열 정의 ────────────────────────────────────────────────
const CATEGORIES = {
  HUMANITIES:   { label: '인문', desc: '글, 말, 책, 역사, 철학, 언어', color: 'bg-amber-50 border-amber-300 text-amber-800', dot: 'bg-amber-400' },
  SOCIAL:       { label: '사회', desc: '사람, 법, 경제, 사회 문제, 행정, 경영', color: 'bg-blue-50 border-blue-300 text-blue-800', dot: 'bg-blue-400' },
  ENGINEERING:  { label: '공학', desc: '기계, 로봇, 컴퓨터, 건축, 설계, 기술', color: 'bg-indigo-50 border-indigo-300 text-indigo-800', dot: 'bg-indigo-400' },
  NATURAL:      { label: '자연', desc: '생명, 지구, 환경, 물질, 우주, 실험', color: 'bg-green-50 border-green-300 text-green-800', dot: 'bg-green-400' },
  HEALTH:       { label: '보건', desc: '건강, 치료, 간호, 재활, 생명 돌봄', color: 'bg-red-50 border-red-300 text-red-800', dot: 'bg-red-400' },
  EDUCATION:    { label: '교육', desc: '가르침, 설명, 성장, 상담, 학습 지원', color: 'bg-teal-50 border-teal-300 text-teal-800', dot: 'bg-teal-400' },
  ARTS_SPORTS:  { label: '예체능', desc: '미술, 음악, 체육, 디자인, 영상, 공연', color: 'bg-pink-50 border-pink-300 text-pink-800', dot: 'bg-pink-400' },
}

// ─── Step 1: 동사 목록 (34개, 각 계열 가중치 포함) ─────────────
const VERBS = [
  { id: 'v01', label: '만들기',  scores: { ENGINEERING: 2, ARTS_SPORTS: 2 } },
  { id: 'v02', label: '고치기',  scores: { ENGINEERING: 2 } },
  { id: 'v03', label: '조립하기', scores: { ENGINEERING: 3 } },
  { id: 'v04', label: '설계하기', scores: { ENGINEERING: 3, SOCIAL: 1 } },
  { id: 'v05', label: '꾸미기',  scores: { ARTS_SPORTS: 3 } },
  { id: 'v06', label: '그리기',  scores: { ARTS_SPORTS: 3, HUMANITIES: 1 } },
  { id: 'v07', label: '쓰기',    scores: { HUMANITIES: 3, SOCIAL: 1, EDUCATION: 1, ARTS_SPORTS: 1 } },
  { id: 'v08', label: '말하기',  scores: { SOCIAL: 2, EDUCATION: 2 } },
  { id: 'v09', label: '설명하기', scores: { EDUCATION: 3, HUMANITIES: 1 } },
  { id: 'v10', label: '가르치기', scores: { EDUCATION: 3 } },
  { id: 'v11', label: '돕기',    scores: { SOCIAL: 2, HEALTH: 2, EDUCATION: 2 } },
  { id: 'v12', label: '돌보기',  scores: { HEALTH: 3, EDUCATION: 1 } },
  { id: 'v13', label: '치료하기', scores: { HEALTH: 3 } },
  { id: 'v14', label: '관찰하기', scores: { NATURAL: 3, HEALTH: 1 } },
  { id: 'v15', label: '실험하기', scores: { NATURAL: 3, ENGINEERING: 1 } },
  { id: 'v16', label: '조사하기', scores: { SOCIAL: 2, HUMANITIES: 2, NATURAL: 1 } },
  { id: 'v17', label: '분석하기', scores: { ENGINEERING: 2, SOCIAL: 2, NATURAL: 1 } },
  { id: 'v18', label: '계산하기', scores: { ENGINEERING: 2, NATURAL: 2 } },
  { id: 'v19', label: '비교하기', scores: { HUMANITIES: 2, SOCIAL: 2 } },
  { id: 'v20', label: '판단하기', scores: { SOCIAL: 2, HUMANITIES: 2 } },
  { id: 'v21', label: '정리하기', scores: { SOCIAL: 2, EDUCATION: 1 } },
  { id: 'v22', label: '기록하기', scores: { HUMANITIES: 2, SOCIAL: 1 } },
  { id: 'v23', label: '계획하기', scores: { SOCIAL: 2, ENGINEERING: 1 } },
  { id: 'v24', label: '기획하기', scores: { SOCIAL: 3, ARTS_SPORTS: 1 } },
  { id: 'v25', label: '설득하기', scores: { SOCIAL: 3, HUMANITIES: 1 } },
  { id: 'v26', label: '발표하기', scores: { SOCIAL: 2, EDUCATION: 2, ARTS_SPORTS: 1 } },
  { id: 'v27', label: '표현하기', scores: { ARTS_SPORTS: 3, HUMANITIES: 2 } },
  { id: 'v28', label: '운동하기', scores: { ARTS_SPORTS: 2, HEALTH: 2 } },
  { id: 'v29', label: '촬영하기', scores: { ARTS_SPORTS: 3 } },
  { id: 'v30', label: '편집하기', scores: { ARTS_SPORTS: 3, ENGINEERING: 1 } },
  { id: 'v31', label: '관리하기', scores: { SOCIAL: 2, ENGINEERING: 1 } },
  { id: 'v32', label: '운영하기', scores: { SOCIAL: 3 } },
  { id: 'v33', label: '안내하기', scores: { SOCIAL: 2, EDUCATION: 2 } },
  { id: 'v34', label: '상담하기', scores: { EDUCATION: 3, HEALTH: 2, SOCIAL: 1 } },
]

// ─── Step 2: 활동 목록 (각 계열 3점) ─────────────────────────
const ACTIVITIES = [
  { id: 'a01', label: '글 쓰기',         category: 'HUMANITIES' },
  { id: 'a02', label: '책 읽기',         category: 'HUMANITIES' },
  { id: 'a03', label: '역사 조사하기',    category: 'HUMANITIES' },
  { id: 'a04', label: '사회 문제 조사하기', category: 'SOCIAL' },
  { id: 'a05', label: '뉴스 분석하기',    category: 'SOCIAL' },
  { id: 'a06', label: '행사 기획하기',    category: 'SOCIAL' },
  { id: 'a07', label: '기계 만들기',     category: 'ENGINEERING' },
  { id: 'a08', label: '로봇 조립하기',   category: 'ENGINEERING' },
  { id: 'a09', label: '프로그램 만들기', category: 'ENGINEERING' },
  { id: 'a10', label: '동물 관찰하기',   category: 'NATURAL' },
  { id: 'a11', label: '물질 실험하기',   category: 'NATURAL' },
  { id: 'a12', label: '환경 조사하기',   category: 'NATURAL' },
  { id: 'a13', label: '환자 돕기',       category: 'HEALTH' },
  { id: 'a14', label: '건강 관리하기',   category: 'HEALTH' },
  { id: 'a15', label: '재활 돕기',       category: 'HEALTH' },
  { id: 'a16', label: '친구 가르치기',   category: 'EDUCATION' },
  { id: 'a17', label: '쉽게 설명하기',   category: 'EDUCATION' },
  { id: 'a18', label: '고민 상담하기',   category: 'EDUCATION' },
  { id: 'a19', label: '그림 그리기',     category: 'ARTS_SPORTS' },
  { id: 'a20', label: '영상 촬영하기',   category: 'ARTS_SPORTS' },
  { id: 'a21', label: '음악 연주하기',   category: 'ARTS_SPORTS' },
]

// ─── Step 4: 계열별 세부 분야 ─────────────────────────────────
const FIELDS = {
  HUMANITIES: [
    { field: '언어와 문학', majors: ['국어국문학과', '영어영문학과', '철학과'], jobs: ['작가', '번역가', '기자', '출판 편집자'], activities: ['독서 토론', '글쓰기 캠프', '철학 탐구'] },
    { field: '역사와 문화', majors: ['역사학과', '문화인류학과', '고고학과'], jobs: ['역사 교사', '문화재 연구원', '박물관 큐레이터'], activities: ['박물관 탐방', '역사 탐구 보고서'] },
  ],
  SOCIAL: [
    { field: '법과 정치', majors: ['법학과', '정치외교학과', '행정학과'], jobs: ['변호사', '외교관', '공무원', '정치인'], activities: ['모의재판', '청소년 의회'] },
    { field: '경제와 경영', majors: ['경제학과', '경영학과', '회계학과'], jobs: ['경영 컨설턴트', '회계사', '마케터'], activities: ['창업 시뮬레이션', '주식 투자 체험'] },
  ],
  ENGINEERING: [
    { field: '컴퓨터와 AI', majors: ['컴퓨터공학과', '인공지능학과', '소프트웨어학과'], jobs: ['소프트웨어 개발자', 'AI 엔지니어', '데이터 분석가'], activities: ['코딩 기초', '앱 만들기'] },
    { field: '기계와 로봇', majors: ['기계공학과', '로봇공학과', '자동차공학과'], jobs: ['로봇 개발자', '자동차 엔지니어', '항공우주 기술자'], activities: ['로봇 조립', '3D 프린팅'] },
    { field: '건축과 공간', majors: ['건축학과', '도시공학과', '실내디자인학과'], jobs: ['건축가', '도시계획가', '인테리어 디자이너'], activities: ['건축 모형 만들기', '공간 디자인'] },
  ],
  NATURAL: [
    { field: '생명과학', majors: ['생명과학과', '생물학과', '유전공학과'], jobs: ['생명공학 연구원', '유전자 분석가', '생물교사'], activities: ['현미경 관찰', '생명과학 탐구'] },
    { field: '환경과 지구', majors: ['환경공학과', '지구과학과', '해양학과'], jobs: ['환경공학자', '기상 연구원', '해양 과학자'], activities: ['환경 조사', '탄소 발자국 계산'] },
  ],
  HEALTH: [
    { field: '의료와 간호', majors: ['의학과', '간호학과', '약학과'], jobs: ['의사', '간호사', '약사'], activities: ['응급처치 체험', '건강 캠페인'] },
    { field: '재활과 돌봄', majors: ['물리치료학과', '작업치료학과', '사회복지학과'], jobs: ['물리치료사', '사회복지사', '보건교사'], activities: ['복지관 봉사활동', '재활 체험'] },
  ],
  EDUCATION: [
    { field: '교육과 상담', majors: ['교육학과', '상담심리학과', '유아교육학과'], jobs: ['교사', '학교 상담사', '교육 콘텐츠 개발자'], activities: ['교육 봉사', '멘토링 프로그램'] },
    { field: '특수·평생교육', majors: ['특수교육학과', '평생교육학과'], jobs: ['특수교사', '사회교육사', '학습 코치'], activities: ['장애 인식 캠페인', '학습법 탐구'] },
  ],
  ARTS_SPORTS: [
    { field: '미술과 디자인', majors: ['미술학과', '시각디자인학과', '산업디자인학과'], jobs: ['디자이너', '화가', 'UX 디자이너'], activities: ['미술 전시 탐방', '포트폴리오 제작'] },
    { field: '음악과 공연', majors: ['음악학과', '연극영화학과', '무용학과'], jobs: ['음악가', '배우', '안무가'], activities: ['공연 관람', '악기 배우기'] },
    { field: '영상과 미디어', majors: ['영상학과', '미디어커뮤니케이션학과'], jobs: ['영상 PD', 'YouTuber', '영화 감독'], activities: ['단편 영상 제작', '편집 실습'] },
  ],
}

// ─── 점수 계산 ────────────────────────────────────────────────
function calcScores(selectedVerbs, selectedActivities) {
  const scores = {}
  Object.keys(CATEGORIES).forEach(k => { scores[k] = 0 })

  selectedVerbs.forEach(id => {
    const verb = VERBS.find(v => v.id === id)
    if (!verb) return
    Object.entries(verb.scores).forEach(([cat, pts]) => { scores[cat] = (scores[cat] || 0) + pts })
  })
  selectedActivities.forEach(id => {
    const act = ACTIVITIES.find(a => a.id === id)
    if (!act) return
    scores[act.category] = (scores[act.category] || 0) + 3
  })
  return scores
}

function topCategories(scores, n = 3) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0)
    .slice(0, n)
    .map(([k]) => k)
}

function getTypeName(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (sorted[0][1] === 0) return '탐색 필요형'
  const diff12 = sorted[0][1] - (sorted[1]?.[1] ?? 0)
  const diff23 = (sorted[1]?.[1] ?? 0) - (sorted[2]?.[1] ?? 0)
  if (diff12 >= 5) return `${CATEGORIES[sorted[0][0]].label} 중심형`
  if (diff12 <= 4 && diff23 >= 3) return `${CATEGORIES[sorted[0][0]].label}·${CATEGORIES[sorted[1][0]].label} 융합형`
  return '다방면 탐색형'
}

// ─── 보조 컴포넌트 ────────────────────────────────────────────
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
          <div key={i} className={`flex-1 h-2 rounded-full ${i < CURRENT_STAGE ? 'bg-violet-500' : 'bg-gray-200'}`} />
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

function ProgressBar({ step }) {
  const steps = ['동사 선택', '활동 선택', '계열 확인', '결과']
  const cur = { step1: 0, step2: 1, step3: 2, result: 3 }[step] ?? 0
  return (
    <div className="flex items-center gap-1 mb-2">
      {steps.map((s, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className={`h-1.5 w-full rounded-full ${i <= cur ? 'bg-violet-500' : 'bg-gray-200'}`} />
          <span className={`text-[9px] ${i === cur ? 'text-violet-600 font-bold' : 'text-gray-400'}`}>{s}</span>
        </div>
      ))}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function CareerTab() {
  const { currentUser } = useAuth()
  const { data, saveCareerResult } = useData()
  const student = data.students.find(s => s.id === currentUser?.id)

  const savedResult = data.careerResults?.find(r => r.studentId === currentUser?.id) || null

  const [step, setStep] = useState('intro') // intro | step1 | step2 | step3 | result
  const [selectedVerbs, setSelectedVerbs] = useState([])     // string[]
  const [selectedActivities, setSelectedActivities] = useState([]) // string[]
  const [selectedCategories, setSelectedCategories] = useState([]) // string[], up to 2
  const [result, setResult] = useState(null)

  const reset = () => {
    setStep('intro')
    setSelectedVerbs([])
    setSelectedActivities([])
    setSelectedCategories([])
    setResult(null)
  }

  const loadSavedResult = () => {
    if (!savedResult) return
    setSelectedVerbs(savedResult.selectedVerbs)
    setSelectedActivities(savedResult.selectedActivities)
    setSelectedCategories(savedResult.selectedCategories)
    setResult({
      primaryCat: savedResult.primaryCat,
      typeName: savedResult.typeName,
      finalScores: savedResult.finalScores,
      fields: savedResult.fields,
    })
    setStep('result')
  }

  // Step 1: 동사 토글 (최대 5개)
  const toggleVerb = (id) => {
    setSelectedVerbs(prev =>
      prev.includes(id) ? prev.filter(v => v !== id)
      : prev.length < 5 ? [...prev, id] : prev
    )
  }

  // Step 2: 활동 토글 (최대 5개)
  const toggleActivity = (id) => {
    setSelectedActivities(prev =>
      prev.includes(id) ? prev.filter(a => a !== id)
      : prev.length < 5 ? [...prev, id] : prev
    )
  }

  // Step 3: 계열 토글 (최대 2개)
  const toggleCategory = (key) => {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key)
      : prev.length < 2 ? [...prev, key] : prev
    )
  }

  // Step3 → 결과 계산
  const scores = calcScores(selectedVerbs, selectedActivities)
  const top3 = topCategories(scores, 3)

  const handleFinish = () => {
    const finalScores = { ...scores }
    selectedCategories.forEach(k => { finalScores[k] = (finalScores[k] || 0) + 5 })
    const primaryCat = Object.entries(finalScores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ENGINEERING'
    const typeName = getTypeName(finalScores)
    const fields = FIELDS[primaryCat] || []
    const newResult = { primaryCat, typeName, finalScores, fields }
    setResult(newResult)
    saveCareerResult(currentUser.id, {
      selectedVerbs,
      selectedActivities,
      selectedCategories,
      ...newResult,
    })
    setStep('result')
  }

  // ── intro ──────────────────────────────────────────────────
  if (step === 'intro') return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">진로 설계</h2>

      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <p className="text-sm font-semibold opacity-80 mb-1">동사 기반 진로 흥미 탐색</p>
        <h3 className="text-xl font-bold">나에게 맞는 진로를 찾아보세요</h3>
        <p className="text-sm opacity-80 mt-2 mb-1">정답은 없습니다. 내가 더 끌리는 활동을 골라 보세요.</p>
        <p className="text-xs opacity-60 mb-4">약 5~7분 · 4단계</p>
        <button
          onClick={() => setStep('step1')}
          className="w-full py-3 bg-white text-violet-600 rounded-xl font-bold hover:bg-violet-50 active:scale-95 transition-all flex items-center justify-center gap-1"
        >
          탐색 시작하기 <ChevronRight size={16} />
        </button>
        {savedResult && (
          <button
            onClick={loadSavedResult}
            className="w-full py-2.5 bg-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 mt-2"
          >
            <History size={15} />
            이전 결과 보기 ({savedResult.date})
          </button>
        )}
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

      <ReportProgress />
    </div>
  )

  // ── Step 1: 동사 선택 ─────────────────────────────────────
  if (step === 'step1') return (
    <div className="py-6 space-y-4">
      <ProgressBar step="step1" />
      <div>
        <h2 className="text-base font-bold text-gray-900">1단계 — 동사 선택</h2>
        <p className="text-sm text-gray-500 mt-0.5">나는 이런 활동이 좋다. <span className="font-semibold text-violet-600">5개</span>를 고르세요.</p>
        <p className="text-xs text-gray-400 mt-0.5">{selectedVerbs.length}/5 선택됨</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {VERBS.map(v => {
          const sel = selectedVerbs.includes(v.id)
          const maxed = selectedVerbs.length >= 5 && !sel
          return (
            <button
              key={v.id}
              onClick={() => toggleVerb(v.id)}
              disabled={maxed}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all active:scale-95 ${
                sel
                  ? 'bg-violet-500 border-violet-500 text-white shadow-sm'
                  : maxed
                    ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'border-gray-200 text-gray-700 hover:border-violet-300'
              }`}
            >
              {v.label}
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={reset} className="px-5 py-3 rounded-xl text-gray-500 bg-gray-100 font-semibold text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> 취소
        </button>
        <button
          onClick={() => setStep('step2')}
          disabled={selectedVerbs.length < 3}
          className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-1"
        >
          다음 <ChevronRight size={16} />
        </button>
      </div>
      <p className="text-center text-xs text-gray-400">최소 3개 선택해야 다음으로 넘어갑니다</p>
    </div>
  )

  // ── Step 2: 활동 선택 ─────────────────────────────────────
  if (step === 'step2') return (
    <div className="py-6 space-y-4">
      <ProgressBar step="step2" />
      <div>
        <h2 className="text-base font-bold text-gray-900">2단계 — 활동 선택</h2>
        <p className="text-sm text-gray-500 mt-0.5">더 해보고 싶은 활동을 <span className="font-semibold text-violet-600">5개</span> 고르세요.</p>
        <p className="text-xs text-gray-400 mt-0.5">{selectedActivities.length}/5 선택됨</p>
      </div>

      <div className="space-y-2">
        {ACTIVITIES.map(act => {
          const sel = selectedActivities.includes(act.id)
          const maxed = selectedActivities.length >= 5 && !sel
          const cat = CATEGORIES[act.category]
          return (
            <button
              key={act.id}
              onClick={() => toggleActivity(act.id)}
              disabled={maxed}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                sel ? 'border-violet-400 bg-violet-50' : maxed ? 'border-gray-100 opacity-40 cursor-not-allowed' : 'border-gray-100 bg-white'
              }`}
            >
              <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                sel ? 'border-violet-500 bg-violet-500 text-white' : 'border-gray-300'
              }`}>{sel ? '✓' : ''}</span>
              <span className={`flex-1 text-sm font-medium ${sel ? 'text-violet-800' : 'text-gray-800'}`}>{act.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${cat.color} border`}>{cat.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={() => setStep('step1')} className="px-5 py-3 rounded-xl text-gray-500 bg-gray-100 font-semibold text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> 이전
        </button>
        <button
          onClick={() => setStep('step3')}
          disabled={selectedActivities.length < 3}
          className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-1"
        >
          다음 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )

  // ── Step 3: 계열 확인 ─────────────────────────────────────
  if (step === 'step3') return (
    <div className="py-6 space-y-4">
      <ProgressBar step="step3" />
      <div>
        <h2 className="text-base font-bold text-gray-900">3단계 — 관심 계열 확인</h2>
        <p className="text-sm text-gray-500 mt-0.5">알고리즘 추천 결과예요. 나의 관심 계열을 <span className="font-semibold text-violet-600">1~2개</span> 선택하세요.</p>
      </div>

      {/* 추천 상위 3개 강조 */}
      {top3.length > 0 && (
        <div className="bg-violet-50 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-violet-600 mb-1">알고리즘 추천 계열</p>
          <div className="flex gap-2 flex-wrap">
            {top3.map((k, i) => (
              <span key={k} className="text-xs bg-violet-500 text-white px-2 py-1 rounded-full font-bold">
                {i + 1}순위 {CATEGORIES[k].label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 전체 계열 카드 */}
      <div className="space-y-2">
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const sel = selectedCategories.includes(key)
          const maxed = selectedCategories.length >= 2 && !sel
          const catScore = scores[key] || 0
          return (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              disabled={maxed}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                sel ? `${cat.color} border-2` : maxed ? 'border-gray-100 opacity-40 cursor-not-allowed bg-white' : 'border-gray-100 bg-white hover:border-violet-200'
              }`}
            >
              <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                sel ? 'border-violet-500 bg-violet-500 text-white' : 'border-gray-300'
              }`}>{sel ? '✓' : ''}</span>
              <div className="flex-1">
                <p className={`font-bold text-sm ${sel ? '' : 'text-gray-800'}`}>{cat.label} 계열</p>
                <p className="text-xs opacity-70 mt-0.5">{cat.desc}</p>
              </div>
              {catScore > 0 && (
                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-bold text-violet-600">{catScore}점</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={() => setStep('step2')} className="px-5 py-3 rounded-xl text-gray-500 bg-gray-100 font-semibold text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> 이전
        </button>
        <button
          onClick={handleFinish}
          disabled={selectedCategories.length === 0}
          className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
        >
          결과 확인하기
        </button>
      </div>
    </div>
  )

  // ── 결과 ──────────────────────────────────────────────────
  if (step === 'result' && result) {
    const primaryLabel = CATEGORIES[result.primaryCat]?.label || ''
    const sortedScores = Object.entries(result.finalScores)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
    const maxScore = sortedScores[0]?.[1] || 1

    return (
      <div className="py-6 space-y-4">
        <ProgressBar step="result" />

        {/* 유형 헤더 */}
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg text-center">
          <p className="text-sm opacity-80">{student?.name} 학생의 진로 유형</p>
          <h3 className="text-2xl font-bold mt-1">{result.typeName}</h3>
          <p className="text-sm opacity-80 mt-2">
            {selectedCategories.map(k => CATEGORIES[k].label).join('·')} 계열에 관심이 높아요
          </p>
        </div>

        {/* 계열 점수 그래프 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-3">계열별 흥미 점수</h4>
          <div className="space-y-2">
            {sortedScores.map(([key, score]) => {
              const cat = CATEGORIES[key]
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">{cat.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full ${cat.dot}`}
                      style={{ width: `${(score / maxScore) * 100}%`, transition: 'width 0.5s ease' }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-8 text-right">{score}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 세부 분야 추천 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-3">
            <span className="text-violet-600">{primaryLabel} 계열</span> 추천 분야
          </h4>
          <div className="space-y-3">
            {result.fields.map((f, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3">
                <p className="font-semibold text-sm text-gray-800 mb-2">{f.field}</p>
                <div className="space-y-1.5">
                  <div>
                    <span className="text-xs text-violet-600 font-semibold">관련 학과 · </span>
                    <span className="text-xs text-gray-600">{f.majors.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-blue-600 font-semibold">관련 직업 · </span>
                    <span className="text-xs text-gray-600">{f.jobs.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-green-600 font-semibold">추천 활동 · </span>
                    <span className="text-xs text-gray-600">{f.activities.join(', ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 학생용 결과 문구 */}
        <div className="bg-violet-50 rounded-2xl p-4">
          <p className="text-sm text-violet-800 leading-relaxed">
            <span className="font-bold">{student?.name}</span> 학생은{' '}
            <span className="font-bold">{selectedVerbs.slice(0, 3).map(id => VERBS.find(v => v.id === id)?.label).filter(Boolean).join(', ')}</span>{' '}
            활동에 흥미가 높게 나타났습니다.<br />
            특히 <span className="font-bold">{primaryLabel}</span> 계열과 관련된 활동에서 관심이 두드러집니다.<br />
            앞으로 추천 활동을 경험해 보면 자신의 진로 방향을 더 구체적으로 확인할 수 있습니다.
          </p>
        </div>

        <button
          onClick={reset}
          className="w-full py-3 rounded-xl border-2 border-violet-200 text-violet-600 font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-1"
        >
          <RotateCcw size={15} /> 다시 탐색하기
        </button>
      </div>
    )
  }

  return null
}
