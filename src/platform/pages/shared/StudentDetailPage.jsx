import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { User, AlertCircle } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { useData } from '../../context/DataContext.jsx'
import { STAGE_META, STAGE_ORDER } from '../../data/stageFeedbackLibrary.js'
import { DOMAIN_LABELS } from '../../../legacy/data/questions.js'
import {
  calcDomainScores, calcStageScores, calcStageGrades,
  getStageStatus, getStateType, buildCoachingReport, selectTasks, getTypeName, scoreToGrade,
} from '../../utils/diagnosisEngine.js'

const RISK_LABELS = {
  normal:  { label: '정상',  color: 'text-green-600 bg-green-100' },
  warning: { label: '주의',  color: 'text-yellow-600 bg-yellow-100' },
  danger:  { label: '위험',  color: 'text-red-600 bg-red-100' },
}

const GRADE_BG = {
  A: 'bg-indigo-100 text-indigo-700',
  B: 'bg-violet-100 text-violet-700',
  C: 'bg-purple-100 text-purple-700',
  D: 'bg-orange-100 text-orange-700',
  E: 'bg-red-100 text-red-700',
}
const GRADE_COLOR = { A: 'text-indigo-600', B: 'text-violet-600', C: 'text-purple-500', D: 'text-orange-500', E: 'text-red-500' }

const CATEGORIES_LABEL = {
  HUMANITIES: '인문', SOCIAL: '사회', ENGINEERING: '공학',
  NATURAL: '자연', HEALTH: '보건', EDUCATION: '교육', ARTS_SPORTS: '예체능',
}

function mindScoreColor(total) {
  if (total > 3) return 'text-blue-600'
  if (total < -3) return 'text-red-600'
  return 'text-gray-600'
}
function mindScoreLabel(n) { return n > 0 ? `+${n}` : String(n) }

// ─── 탭: 마인드 ───────────────────────────────────────────────
function MindSection({ studentId, data, getWeeklyLearning }) {
  const records = data.mindRecords
    .filter((r) => r.studentId === studentId)
    .slice()
    .sort((a, b) => (b.date > a.date ? 1 : -1))

  const weekChart = getWeeklyLearning(studentId)

  if (records.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">마인드 기록이 없습니다.</p>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="text-sm font-bold text-gray-700 mb-3">최근 7일 학습시간 (분)</h4>
        {weekChart.some((d) => d.minutes > 0) ? (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={weekChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v}분`, '학습시간']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="minutes" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">최근 7일 학습 기록 없음</p>
        )}
      </div>

      <div className="space-y-2">
        {records.map((r) => {
          const total = (r.mood ?? 0) + (r.motivation ?? 0) + (r.confidence ?? 0)
          return (
            <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{r.date}</span>
                <span className={`text-sm font-bold ${mindScoreColor(total)}`}>합계 {mindScoreLabel(total)}점</span>
              </div>
              <p className="text-xs text-gray-500">
                기분 {mindScoreLabel(r.mood ?? 0)} · 동기 {mindScoreLabel(r.motivation ?? 0)} · 자신감 {mindScoreLabel(r.confidence ?? 0)}
              </p>
              {r.memo && <p className="text-xs text-gray-500 mt-1 italic">"{r.memo}"</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 탭: 일기 ─────────────────────────────────────────────────
function DiarySection({ studentId, data }) {
  const records = data.diaryRecords
    .filter((r) => r.studentId === studentId)
    .slice()
    .sort((a, b) => (b.date > a.date ? 1 : -1))

  if (records.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">일기 기록이 없습니다.</p>
  }

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <p className="text-xs text-gray-400 font-semibold">{r.date}</p>
          {r.praise && (
            <div>
              <p className="text-xs font-semibold text-green-600 mb-0.5">칭찬할 점</p>
              <p className="text-sm text-gray-700">{r.praise}</p>
            </div>
          )}
          {r.reflection && (
            <div>
              <p className="text-xs font-semibold text-orange-500 mb-0.5">반성할 점</p>
              <p className="text-sm text-gray-700">{r.reflection}</p>
            </div>
          )}
          {r.resolution && (
            <div>
              <p className="text-xs font-semibold text-blue-600 mb-0.5">내일의 다짐</p>
              <p className="text-sm text-gray-700">{r.resolution}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── 탭: 학습 ─────────────────────────────────────────────────
function LearningSection({ studentId, data }) {
  const records = data.learningRecords
    .filter((r) => r.studentId === studentId)
    .slice()
    .sort((a, b) => (b.date > a.date ? 1 : -1))

  const totalMin = records.reduce((s, r) => s + (r.duration ?? 0), 0)

  // 과목별 합계
  const bySubject = {}
  records.forEach((r) => {
    bySubject[r.subject] = (bySubject[r.subject] ?? 0) + (r.duration ?? 0)
  })
  const subjectData = Object.entries(bySubject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, minutes]) => ({ name, minutes }))

  if (records.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">학습 기록이 없습니다.</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{totalMin}</p>
          <p className="text-xs text-gray-500 mt-0.5">총 학습 (분)</p>
        </div>
        <div className="bg-indigo-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-indigo-600">{records.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">기록 횟수</p>
        </div>
      </div>

      {subjectData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h4 className="text-sm font-bold text-gray-700 mb-3">과목별 학습시간 (분)</h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={subjectData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v}분`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="minutes" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="space-y-2">
        {records.slice(0, 30).map((r) => (
          <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{r.subject}</span>
                <span className="text-xs text-gray-400">{r.date}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-blue-600 font-semibold">{r.duration}분</span>
                <span className="text-xs text-gray-400">집중도 {r.focus}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 탭: 과제 ─────────────────────────────────────────────────
function TaskSection({ studentId, data }) {
  const tasks = data.tasks
    .filter((t) => t.studentId === studentId)
    .slice()
    .sort((a, b) => (b.dueDate > a.dueDate ? 1 : -1))

  const pending = tasks.filter((t) => t.status === 'pending')
  const done = tasks.filter((t) => t.status === 'done')

  if (tasks.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">과제가 없습니다.</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-orange-600">{pending.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">미완료</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-600">{done.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">완료</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-semibold">미완료 과제</p>
          {pending.map((t) => (
            <div key={t.id} className="bg-white rounded-xl p-3 shadow-sm border-l-4 border-orange-400">
              <p className="font-semibold text-sm text-gray-800">{t.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t.subject}{t.assignerName ? ` · 출제: ${t.assignerName}` : ''} · 마감 {t.dueDate}
              </p>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-semibold">완료된 과제</p>
          {done.map((t) => (
            <div key={t.id} className="bg-gray-50 rounded-xl p-3 opacity-60">
              <p className="font-semibold text-sm text-gray-500 line-through">{t.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.subject}{t.assignerName ? ` · ${t.assignerName}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 탭: 학습 진단 ────────────────────────────────────────────
function DiagnosisSection({ studentId, data }) {
  const [resultTab, setResultTab] = useState(0)
  const diagResult = data.diagnosisResults?.find((r) => r.studentId === studentId)

  const result = useMemo(() => {
    if (!diagResult?.answers) return null
    const domainScores  = calcDomainScores(diagResult.answers)
    const stageScores   = calcStageScores(domainScores)
    const stageGrades   = calcStageGrades(stageScores)
    const stageStatus   = getStageStatus(stageGrades)
    const stateTypes    = getStateType(stageGrades)
    const coaching      = buildCoachingReport(stageGrades, stageStatus)
    const tasks         = selectTasks(stageGrades)
    const typeName      = getTypeName(stageGrades)
    return { domainScores, stageScores, stageGrades, stageStatus, stateTypes, coaching, tasks, typeName }
  }, [diagResult])

  if (!result) {
    return <p className="text-sm text-gray-400 py-8 text-center">학습 진단 결과가 없습니다.</p>
  }

  const { domainScores, stageScores, stageGrades, stageStatus, stateTypes, coaching, tasks, typeName } = result

  const chartData = STAGE_ORDER.map((s) => ({
    name: STAGE_META[s].label,
    score: stageScores[s],
    color: STAGE_META[s].color,
  }))

  const domainChartData = Object.entries(domainScores).map(([d, score]) => ({
    name: DOMAIN_LABELS[d],
    score,
    grade: scoreToGrade(score),
  }))

  const TABS = ['요약', '코칭 리포트', '실행 과제']

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-4 text-white">
        <p className="text-xs opacity-75 mb-1">학습 유형</p>
        <h3 className="text-lg font-bold mb-1">{typeName}</h3>
        <div className="flex flex-wrap gap-1.5">
          {stateTypes.map((t) => (
            <span key={t} className="text-xs bg-white/20 rounded-full px-2.5 py-0.5">{t}</span>
          ))}
        </div>
        <p className="text-xs opacity-60 mt-2">진단일: {diagResult.date}</p>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {TABS.map((tab, i) => (
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

      {resultTab === 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-3">학습 단계 점수</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v}점`, '점수']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {STAGE_ORDER.map((s) => (
                <div key={s} className="text-center">
                  <p className="text-xs text-gray-400">{STAGE_META[s].label}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_BG[stageGrades[s]]}`}>
                    {stageGrades[s]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-indigo-600 mb-2">강점 단계</p>
              {stageStatus.strongStages.map((s) => (
                <div key={s} className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_META[s].color }} />
                  <span className="text-xs text-gray-700">{STAGE_META[s].label}</span>
                </div>
              ))}
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-orange-600 mb-2">보완 필요</p>
              {stageStatus.weakStages.length > 0 ? stageStatus.weakStages.map((s) => (
                <div key={s} className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_META[s].color }} />
                  <span className="text-xs text-gray-700">{STAGE_META[s].label}</span>
                </div>
              )) : <p className="text-xs text-gray-400">없음</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-3">영역별 점수</p>
            <div className="space-y-2.5">
              {domainChartData.map(({ name, score, grade }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-16 flex-shrink-0">{name}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${score}%` }} />
                  </div>
                  <span className={`text-xs font-bold w-6 text-right ${GRADE_COLOR[grade]}`}>{grade}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {resultTab === 2 && (
        <div className="space-y-3">
          {tasks.map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl p-4 border border-gray-200 flex items-start gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${GRADE_BG[stageGrades[item.stage]] || 'bg-gray-100 text-gray-500'}`}>
                {item.label}
              </span>
              <span className="text-sm text-gray-800">{item.task}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 탭: 진로 설계 ────────────────────────────────────────────
function CareerSection({ studentId, data }) {
  const careerResult = data.careerResults?.find((r) => r.studentId === studentId)

  if (!careerResult) {
    return <p className="text-sm text-gray-400 py-8 text-center">진로 검사 결과가 없습니다.</p>
  }

  const { typeName, primaryCat, finalScores, fields, date } = careerResult

  const scoreData = finalScores
    ? Object.entries(finalScores)
        .map(([k, v]) => ({ name: CATEGORIES_LABEL[k] ?? k, score: v }))
        .sort((a, b) => b.score - a.score)
    : []

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 text-white">
        <p className="text-xs opacity-75 mb-1">진로 유형</p>
        <h3 className="text-lg font-bold">{typeName}</h3>
        {primaryCat && (
          <p className="text-sm opacity-80 mt-1">주요 계열: {CATEGORIES_LABEL[primaryCat] ?? primaryCat}</p>
        )}
        <p className="text-xs opacity-60 mt-2">검사일: {date}</p>
      </div>

      {scoreData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3">계열별 점수</p>
          <div className="space-y-2">
            {scoreData.map(({ name, score }) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-12 flex-shrink-0">{name}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-400 transition-all"
                    style={{ width: `${Math.min(100, Math.round((score / Math.max(...scoreData.map(d => d.score))) * 100))}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-6 text-right">{score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {fields && fields.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-gray-700">추천 분야</p>
          {fields.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-semibold text-gray-800 mb-2">{f.field}</p>
              <div className="space-y-1.5">
                <div>
                  <span className="text-xs font-semibold text-violet-600">관련 학과 </span>
                  <span className="text-xs text-gray-600">{f.majors?.join(', ')}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-blue-600">직업 </span>
                  <span className="text-xs text-gray-600">{f.jobs?.join(', ')}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-green-600">활동 </span>
                  <span className="text-xs text-gray-600">{f.activities?.join(', ')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────
const TABS = ['마인드', '일기', '학습', '과제', '진단', '진로']

export default function StudentDetailPage() {
  const { studentId } = useParams()
  const { data, getWeeklyLearning } = useData()
  const [activeTab, setActiveTab] = useState(0)

  const student = data.students.find((s) => s.id === studentId)
  const risk = RISK_LABELS[student?.riskLevel] || RISK_LABELS.normal
  const managerIds = data.assignments.filter((a) => a.studentId === studentId).map((a) => a.educatorId)
  const managers = data.educators.filter((e) => managerIds.includes(e.id) && e.role === 'manager')
  const hasAlert = data.alerts.some((a) => a.studentId === studentId && !a.resolved)

  if (!student) {
    return <p className="text-sm text-gray-400 py-16 text-center">학생 정보를 찾을 수 없습니다.</p>
  }

  return (
    <div className="space-y-0">
      {/* 학생 요약 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">{student.name}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${risk.color}`}>{risk.label}</span>
              {hasAlert && <AlertCircle size={13} className="text-red-500" />}
            </div>
            <p className="text-xs text-gray-400 truncate">
              {student.school} · {student.grade}
              {managers.length > 0 && ` · 담당: ${managers.map((m) => m.name).join(', ')}`}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-blue-600">{student.selfIndex}</p>
            <p className="text-xs text-gray-400">자기주도지수</p>
          </div>
        </div>
      </div>

      {/* 콘텐츠 탭 */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-4 px-4 mb-4">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === i
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && <MindSection studentId={studentId} data={data} getWeeklyLearning={getWeeklyLearning} />}
      {activeTab === 1 && <DiarySection studentId={studentId} data={data} />}
      {activeTab === 2 && <LearningSection studentId={studentId} data={data} />}
      {activeTab === 3 && <TaskSection studentId={studentId} data={data} />}
      {activeTab === 4 && <DiagnosisSection studentId={studentId} data={data} />}
      {activeTab === 5 && <CareerSection studentId={studentId} data={data} />}
    </div>
  )
}
