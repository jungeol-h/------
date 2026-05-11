import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, CheckSquare, Square, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import SaveErrorBox from '../../components/common/SaveErrorBox.jsx'
import { questions, DOMAIN_LABELS } from '../../data/questions.js'
import { STAGE_META, STAGE_ORDER } from '../../data/stageFeedbackLibrary.js'
import {
  calcDomainScores,
  calcStageScores,
  calcStageGrades,
  getStageStatus,
  getStateType,
  buildCoachingReport,
  selectTasks,
  getTypeName,
  scoreToGrade,
} from '../../utils/learningDiagnosisEngine.js'

const LIKERT = ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다']
const RESULT_TABS = ['요약', '코칭 리포트', '실행 과제']

const GRADE_COLOR = { A: 'text-indigo-600', B: 'text-violet-600', C: 'text-purple-500', D: 'text-orange-500', E: 'text-red-500' }
const GRADE_BG    = { A: 'bg-indigo-100 text-indigo-700', B: 'bg-violet-100 text-violet-700', C: 'bg-purple-100 text-purple-700', D: 'bg-orange-100 text-orange-700', E: 'bg-red-100 text-red-700' }

export default function LearningDiagnosisTab() {
  const { currentUser } = useAuth()
  const { data, saveLearningDiagnosisResult } = useData()

  const studentId = currentUser?.id || 's1'
  const prevResult = data.learningDiagnosisResults?.find(r => r.studentId === studentId) || null

  // step: 'intro' | number(0~29) | 'result'
  const [step, setStep] = useState(prevResult ? 'result' : 'intro')
  const [answers, setAnswers] = useState(prevResult?.answers || Array(30).fill(0))
  const [resultTab, setResultTab] = useState(0)
  const [checkedTasks, setCheckedTasks] = useState({})
  const [saveError, setSaveError] = useState(null)

  // 진단 결과 계산 (메모이제이션)
  const result = useMemo(() => {
    const src = prevResult && step === 'result' && answers.every(a => a === 0) ? prevResult.answers : answers
    if (src.every(a => a === 0) && step !== 'result') return null
    const domainScores  = calcDomainScores(src)
    const stageScores   = calcStageScores(domainScores)
    const stageGrades   = calcStageGrades(stageScores)
    const stageStatus   = getStageStatus(stageGrades)
    const stateTypes    = getStateType(stageGrades)
    const coaching      = buildCoachingReport(stageGrades, stageStatus)
    const tasks         = selectTasks(stageGrades)
    const typeName      = getTypeName(stageGrades)
    return { domainScores, stageScores, stageGrades, stageStatus, stateTypes, coaching, tasks, typeName }
  }, [answers, step, prevResult])

  // ── 설문 시작 ──────────────────────────────────────────────────
  function handleStart() {
    setAnswers(Array(30).fill(0))
    setCheckedTasks({})
    setStep(0)
  }

  function handleAnswer(value) {
    const next = [...answers]
    next[step] = value
    setAnswers(next)
  }

  async function handleNext() {
    if (answers[step] === 0) return
    if (step < 29) {
      setStep(step + 1)
    } else {
      // 완료 → 결과 저장
      const domainScores  = calcDomainScores(answers)
      const stageScores   = calcStageScores(domainScores)
      const stageGrades   = calcStageGrades(stageScores)
      const stateTypes    = getStateType(stageGrades)
      const typeName      = getTypeName(stageGrades)
      try {
        setSaveError(null)
        await saveLearningDiagnosisResult(studentId, {
          answers: [...answers],
          domainScores,
          stageScores,
          stageGrades,
          stateTypes,
          typeName,
        })
      } catch (e) {
        setSaveError(e)
        return
      }
      setStep('result')
      setResultTab(0)
    }
  }

  function handlePrev() {
    if (step > 0) setStep(step - 1)
  }

  function handleReset() {
    setStep('intro')
    setAnswers(Array(30).fill(0))
    setCheckedTasks({})
  }

  function toggleTask(idx) {
    setCheckedTasks(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  // ── 소개 화면 ──────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <div className="py-6 space-y-5 px-1">
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-5 text-center">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Activity size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">학습진단</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            30개 문항으로 학습 역량의 4단계를 진단하고<br />맞춤 코칭 리포트를 받아보세요
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 space-y-3 border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">진단 구성</p>
          {STAGE_ORDER.map(stage => (
            <div key={stage} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_META[stage].color }} />
              <span className="text-sm font-medium text-gray-700 w-12">{STAGE_META[stage].label}</span>
              <span className="text-xs text-gray-400">
                {STAGE_META[stage].domains.map(d => DOMAIN_LABELS[d]).join(' + ')}
              </span>
            </div>
          ))}
        </div>

        {prevResult && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            이전 학습진단 결과가 있습니다. 아래 버튼을 누르면 다시 진단합니다.
          </div>
        )}

        <div className="space-y-2">
          {prevResult && (
            <button
              onClick={() => setStep('result')}
              className="w-full py-3 rounded-xl border border-indigo-300 text-indigo-600 font-semibold text-sm"
            >
              이전 결과 보기
            </button>
          )}
          <button
            onClick={handleStart}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
          >
            {prevResult ? '다시 진단하기' : '학습진단 시작하기'}
          </button>
        </div>
      </div>
    )
  }

  // ── 설문 화면 ──────────────────────────────────────────────────
  if (typeof step === 'number') {
    const q = questions[step]
    const progress = ((step + 1) / 30) * 100
    const domainLabel = DOMAIN_LABELS[q.domain] || q.domain

    return (
      <div className="py-4 space-y-4 px-1">
        {/* 진행 표시 */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{step + 1} / 30</span>
            <span>{domainLabel}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 문항 */}
        <div className="bg-white rounded-2xl p-5 min-h-[100px] flex items-center border border-gray-100">
          <p className="text-sm font-medium text-gray-800 leading-relaxed">{q.text}</p>
        </div>

        {/* 리커트 선택 */}
        <div className="space-y-2">
          {LIKERT.map((label, i) => {
            const val = i + 1
            const selected = answers[step] === val
            return (
              <button
                key={val}
                onClick={() => handleAnswer(val)}
                className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                  selected
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
                }`}
              >
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 ${
                  selected ? 'border-white bg-white text-indigo-600' : 'border-gray-300'
                }`}>
                  {val}
                </span>
                {label}
              </button>
            )
          })}
        </div>

        <SaveErrorBox error={saveError} userId={studentId} />

        {/* 이전/다음 */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handlePrev}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 disabled:opacity-30"
          >
            <ChevronLeft size={16} /> 이전
          </button>
          <button
            onClick={handleNext}
            disabled={answers[step] === 0}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            {step < 29 ? '다음' : '결과 보기'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  // ── 결과 화면 ──────────────────────────────────────────────────
  if (step === 'result' && result) {
    const { domainScores, stageScores, stageGrades, stageStatus, stateTypes, coaching, tasks, typeName } = result

    const chartData = STAGE_ORDER.map(s => ({
      name: STAGE_META[s].label,
      score: stageScores[s],
      color: STAGE_META[s].color,
    }))

    const domainChartData = Object.entries(domainScores).map(([d, score]) => ({
      name: DOMAIN_LABELS[d],
      score,
      grade: scoreToGrade(score),
    }))

    return (
      <div className="py-4 space-y-4 px-1">
        {/* 유형 헤더 */}
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white">
          <p className="text-xs opacity-75 mb-1">학습 유형</p>
          <h2 className="text-xl font-bold mb-2">{typeName}</h2>
          <div className="flex flex-wrap gap-1.5">
            {stateTypes.map(t => (
              <span key={t} className="text-xs bg-white/20 rounded-full px-2.5 py-0.5">{t}</span>
            ))}
          </div>
        </div>

        {/* 결과 탭 */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {RESULT_TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setResultTab(i)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                resultTab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 탭1: 요약 */}
        {resultTab === 0 && (
          <div className="space-y-4">
            {/* 4단계 바 차트 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3">학습 단계 점수</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v) => [`${v}점`, '점수']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* 단계별 등급 */}
              <div className="grid grid-cols-4 gap-2 mt-3">
                {STAGE_ORDER.map(s => (
                  <div key={s} className="text-center">
                    <p className="text-xs text-gray-400">{STAGE_META[s].label}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_BG[stageGrades[s]]}`}>
                      {stageGrades[s]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 강점/약점 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-indigo-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-indigo-600 mb-2">강점 단계</p>
                <div className="space-y-1">
                  {stageStatus.strongStages.map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_META[s].color }} />
                      <span className="text-xs text-gray-700">{STAGE_META[s].label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-orange-600 mb-2">보완 필요</p>
                <div className="space-y-1">
                  {stageStatus.weakStages.length > 0 ? stageStatus.weakStages.map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_META[s].color }} />
                      <span className="text-xs text-gray-700">{STAGE_META[s].label}</span>
                    </div>
                  )) : <p className="text-xs text-gray-400">없음</p>}
                </div>
              </div>
            </div>

            {/* 6개 영역 점수 */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3">영역별 점수</p>
              <div className="space-y-2.5">
                {domainChartData.map(({ name, score, grade }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-16 flex-shrink-0">{name}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-6 text-right ${GRADE_COLOR[grade]}`}>{grade}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 탭2: 코칭 리포트 */}
        {resultTab === 1 && (
          <div className="space-y-3">
            {[
              { label: '① 현재 상태', text: coaching.currentState, bg: 'bg-slate-50 border-slate-200' },
              { label: '② 강점',      text: coaching.strength,     bg: 'bg-indigo-50 border-indigo-200' },
              { label: '③ 문제 원인', text: coaching.problemCause, bg: 'bg-orange-50 border-orange-200' },
              { label: '④ 개선 방향', text: coaching.improvement,  bg: 'bg-green-50 border-green-200' },
            ].map(({ label, text, bg }) => (
              <div key={label} className={`rounded-xl p-4 border ${bg}`}>
                <p className="text-xs font-bold text-gray-500 mb-1.5">{label}</p>
                <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        )}

        {/* 탭3: 실행 과제 */}
        {resultTab === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">아래 과제를 완료하면 체크해보세요</p>
            {tasks.map((item, idx) => (
              <button
                key={idx}
                onClick={() => toggleTask(idx)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  checkedTasks[idx]
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                {checkedTasks[idx]
                  ? <CheckSquare size={20} className="text-indigo-600 flex-shrink-0" />
                  : <Square size={20} className="text-gray-300 flex-shrink-0" />
                }
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${GRADE_BG[stageGrades[item.stage]] || 'bg-gray-100 text-gray-500'}`}>
                    {item.label}
                  </span>
                  <span className={`text-sm font-medium ${checkedTasks[idx] ? 'text-indigo-700 line-through' : 'text-gray-800'}`}>
                    {item.task}
                  </span>
                </div>
              </button>
            ))}
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">
                {Object.values(checkedTasks).filter(Boolean).length} / {tasks.length} 완료
              </p>
            </div>
          </div>
        )}

        {/* 다시 진단 버튼 */}
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm text-gray-500"
        >
          <RotateCcw size={14} /> 다시 진단하기
        </button>
      </div>
    )
  }

  return null
}
