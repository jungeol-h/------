import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { User, AlertCircle, Plus, Pencil, Trash2 } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { supabase } from '../../lib/supabase.js'
import { toAttendanceRecord } from '../../lib/supabaseHelpers.js'
import { buildReflectionData } from '../../context/selectors/reflectionReport.js'
import { getMindStatus } from '../../context/selectors/riskDetection.js'
import { COUNSELING_TYPE_LABELS, COUNSELING_TARGET_LABELS } from '../../data/counselingTypes.js'
import CounselingFormModal from '../../components/counseling/CounselingFormModal.jsx'
import CounselingRecordBody from '../../components/counseling/CounselingRecordBody.jsx'
import { educatorDisplayName } from '../../utils/educatorName.js'
import TaskFormModal from '../../components/tasks/TaskFormModal.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { buildFilename, nowDateTime } from '../../pdf/utils/formatters.js'
import { authorOf } from '../../pdf/config/meta.js'
import { STAGE_META, STAGE_ORDER } from '../../data/stageFeedbackLibrary.js'
import { DOMAIN_LABELS } from '../../data/questions.js'
import { actualMinutes, methodBreakdown } from '../../context/selectors/learningRecords.js'
import {
  calcDomainScores, calcStageScores, calcStageGrades,
  getStageStatus, getStateType, buildCoachingReport, selectTasks, getTypeName, scoreToGrade,
} from '../../utils/learningDiagnosisEngine.js'

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

  const timeRecords = records.filter((r) => actualMinutes(r) > 0)
  const totalMin = timeRecords.reduce((s, r) => s + actualMinutes(r), 0)

  // 과목별 합계
  const bySubject = {}
  timeRecords.forEach((r) => {
    bySubject[r.subject] = (bySubject[r.subject] ?? 0) + actualMinutes(r)
  })
  const subjectData = Object.entries(bySubject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, minutes]) => ({ name, minutes }))
  const methodData = methodBreakdown(timeRecords, 8)

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
          <p className="text-xl font-bold text-indigo-600">{timeRecords.length}</p>
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

      {methodData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h4 className="text-sm font-bold text-gray-700 mb-3">학습법별 학습시간 (분)</h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={methodData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v}분`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="minutes" fill="#10b981" radius={[0, 4, 4, 0]} />
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
                {actualMinutes(r) > 0 && (
                  <span className="text-xs text-blue-600 font-semibold">{actualMinutes(r)}분</span>
                )}
                <span className="text-xs text-gray-400">{r.recordType === 'planner' ? '계획' : '타이머'}</span>
                {r.studyMethod && <span className="text-xs text-gray-400">{r.studyMethod}</span>}
                {r.focus != null && <span className="text-xs text-gray-400">집중도 {r.focus}%</span>}
              </div>
              {r.content && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{r.content}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 탭: 과제 ─────────────────────────────────────────────────
function TaskSection({ studentId, data, currentUser, canWrite = false }) {
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const { deleteTask } = useData()

  const student = data.students.find((s) => s.id === studentId)
  const tasks = data.tasks
    .filter((t) => t.studentId === studentId)
    .slice()
    .sort((a, b) => (b.dueDate > a.dueDate ? 1 : -1))

  const pending = tasks.filter((t) => t.status === 'pending')
  const done = tasks.filter((t) => t.status === 'done')

  // 본인 부여분 or admin 수정/삭제 가능. assignerId 없는 기존 과제는 admin만.
  const canManage = (t) =>
    canWrite && (t.assignerId === currentUser?.id || currentUser?.role === 'admin')

  const handleDelete = async (id) => {
    if (!window.confirm('이 과제를 삭제할까요?')) return
    try {
      await deleteTask(id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const ManageButtons = ({ t }) =>
    canManage(t) ? (
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => setEditTask(t)} className="text-gray-400 hover:text-blue-600 p-0.5" aria-label="과제 수정">
          <Pencil size={14} />
        </button>
        <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600 p-0.5" aria-label="과제 삭제">
          <Trash2 size={14} />
        </button>
      </div>
    ) : null

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
          >
            <Plus size={16} /> 과제 추가
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">과제가 없습니다.</p>
      ) : (
        <>
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
                <div key={t.id} className="bg-white rounded-xl p-3 shadow-sm border-l-4 border-orange-400 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{t.title}</p>
                    {t.content && (
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">{t.content}</p>
                    )}
                    {t.method && (
                      <p className="text-xs text-gray-500 mt-1">수행방법: {t.method}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.subject}{t.assignerName ? ` · 출제: ${t.assignerName}` : ''} · 마감 {t.dueDate}
                    </p>
                  </div>
                  <ManageButtons t={t} />
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-semibold">완료된 과제</p>
              {done.map((t) => (
                <div key={t.id} className="bg-gray-50 rounded-xl p-3 opacity-60 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-500 line-through">{t.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.subject}{t.assignerName ? ` · ${t.assignerName}` : ''}</p>
                  </div>
                  <ManageButtons t={t} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showForm && (
        <TaskFormModal fixedStudent={student} onClose={() => setShowForm(false)} />
      )}
      {editTask && (
        <TaskFormModal task={editTask} onClose={() => setEditTask(null)} />
      )}
    </div>
  )
}

// ─── 탭: 학습진단 ─────────────────────────────────────────────
function LearningDiagnosisSection({ studentId, data }) {
  const [resultTab, setResultTab] = useState(0)
  const diagResult = data.learningDiagnosisResults?.find((r) => r.studentId === studentId)

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
        <p className="text-xs opacity-60 mt-2">학습진단일: {diagResult.date}</p>
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

// ─── 탭: 진로설계 ─────────────────────────────────────────────
function CareerDesignSection({ studentId, data }) {
  const careerResult = data.careerDesignResults?.find((r) => r.studentId === studentId)

  if (!careerResult) {
    return <p className="text-sm text-gray-400 py-8 text-center">진로설계 결과가 없습니다.</p>
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

// ─── 탭: 상담 ─────────────────────────────────────────────────
function CounselingSection({ studentId, data, currentUser, canWrite = true }) {
  const [showForm, setShowForm] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const authorId = currentUser?.id

  const student = data.students.find((s) => s.id === studentId)
  const records = data.counselingRecords
    .filter((r) => r.studentId === studentId)
    .slice()
    .sort((a, b) => (b.date > a.date ? 1 : -1))

  const { deleteCounselingRecord } = useData()

  const canManage = (r) =>
    canWrite && (r.educatorId === currentUser?.id || currentUser?.role === 'admin')

  const handleDelete = async (id) => {
    if (!window.confirm('이 상담 기록을 삭제할까요?')) return
    try {
      await deleteCounselingRecord(id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const handleDownloadPdf = useCallback(async () => {
    const sorted = records.slice().sort((a, b) => (a.date > b.date ? 1 : -1))
    const [{ downloadPdf }, { default: CounselingReport }] = await Promise.all([
      import('../../pdf/utils/downloadPdf.js'),
      import('../../pdf/reports/CounselingReport.jsx'),
    ])
    await downloadPdf(
      <CounselingReport
        student={{ name: student?.name, school: student?.school, grade: student?.grade }}
        records={sorted.map((r) => ({
          date: r.date,
          typeLabel: COUNSELING_TYPE_LABELS[r.type] || r.type,
          targetLabel: COUNSELING_TARGET_LABELS[r.targetType] ?? '학생',
          authorName: educatorDisplayName(data.educators.find((e) => e.id === r.educatorId)) ?? '-',
          content: r.comment,
        }))}
        generatedAt={nowDateTime()}
        author={authorOf(currentUser)}
      />,
      buildFilename('상담보고서', student?.name),
    )
  }, [records, student, data.educators, currentUser])

  const handleDownloadReflection = useCallback(async () => {
    // admin/manager fetch에는 이 학생의 출결이 없다 → 여기서만 lazy fetch.
    let attendanceRecords = []
    try {
      const res = await supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
      if (res.error) throw res.error
      attendanceRecords = (res.data ?? []).map(toAttendanceRecord)
    } catch {
      alert('출결 기록을 불러오지 못했습니다. 출결 없이 리포트를 생성합니다.')
      attendanceRecords = []
    }

    // learning/mind는 page data에 이미 있음. 출결만 주입해 selector 재사용.
    const merged = { ...data, attendanceRecords }
    const { attendance, learning, mind } = buildReflectionData(merged, studentId)

    const [{ downloadPdf }, { default: ReflectionReport }] = await Promise.all([
      import('../../pdf/utils/downloadPdf.js'),
      import('../../pdf/reports/ReflectionReport.jsx'),
    ])
    await downloadPdf(
      <ReflectionReport
        student={{ name: student?.name, school: student?.school, grade: student?.grade }}
        attendance={attendance}
        learning={learning}
        mind={mind}
        generatedAt={nowDateTime()}
        author={authorOf(currentUser)}
      />,
      buildFilename('종합성장리포트', student?.name),
    )
  }, [studentId, student, data, currentUser])

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <DownloadPdfButton
          onDownload={handleDownloadReflection}
          label="종합 성장 리포트"
          className="bg-blue-600 hover:bg-blue-700"
        />
        <DownloadPdfButton
          onDownload={handleDownloadPdf}
          label="상담 보고서"
          disabled={records.length === 0}
        />
        {canWrite && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
          >
            <Plus size={16} /> 상담 작성
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">상담 기록이 없습니다.</p>
      ) : (
        records.map((r) => {
          const author = data.educators.find((e) => e.id === r.educatorId)
          return (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                    {COUNSELING_TYPE_LABELS[r.type] || r.type}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {COUNSELING_TARGET_LABELS[r.targetType] ?? '학생'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{r.date}</span>
                  {canManage(r) && (
                    <>
                      <button
                        onClick={() => setEditRecord(r)}
                        className="text-gray-400 hover:text-blue-600 p-0.5"
                        aria-label="상담 수정"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-gray-400 hover:text-red-600 p-0.5"
                        aria-label="상담 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <CounselingRecordBody record={r} fallback={r.comment} />
              {author && <p className="text-xs text-gray-400 mt-2">작성: {educatorDisplayName(author)}</p>}
            </div>
          )
        })
      )}

      {showForm && (
        <CounselingFormModal
          fixedStudent={student}
          authorId={authorId}
          onClose={() => setShowForm(false)}
        />
      )}

      {editRecord && (
        <CounselingFormModal
          record={editRecord}
          authorId={authorId}
          onClose={() => setEditRecord(null)}
        />
      )}
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────
const TABS = ['마인드', '일기', '학습', '과제', '학습진단', '진로설계', '상담']

export default function StudentDetailPage() {
  const { studentId } = useParams()
  const { currentUser } = useAuth()
  const { data, getWeeklyLearning } = useData()
  const [activeTab, setActiveTab] = useState(0)

  const student = data.students.find((s) => s.id === studentId)
  const risk = RISK_LABELS[student?.riskLevel] || RISK_LABELS.normal
  const managerIds = data.assignments.filter((a) => a.studentId === studentId).map((a) => a.educatorId)
  const managers = data.educators.filter((e) => managerIds.includes(e.id) && e.role === 'manager')
  const hasAlert = getMindStatus(data.mindRecords.filter((r) => r.studentId === studentId)) !== null

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
      {activeTab === 3 && <TaskSection studentId={studentId} data={data} currentUser={currentUser} canWrite={currentUser?.role !== 'viewer'} />}
      {activeTab === 4 && <LearningDiagnosisSection studentId={studentId} data={data} />}
      {activeTab === 5 && <CareerDesignSection studentId={studentId} data={data} />}
      {activeTab === 6 && <CounselingSection studentId={studentId} data={data} currentUser={currentUser} canWrite={currentUser?.role !== 'viewer'} />}
    </div>
  )
}
