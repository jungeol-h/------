// 종합성장리포트(월간) 출력 모달 — 2026-08 클라이언트 개편.
// 월 선택 → 해당 학생·기간 데이터를 supabase에서 직접 조회(역할별 fetch 윈도
// 무관 — MonthlyOperationsReportModal과 같은 이유·패턴) → 화면 미리보기
// 차트(Recharts)를 captureChart로 PNG 캡처해 PDF에 삽입한다.
// 자기주도학습코칭 내용은 기간 내 코칭 상담에서 자동 생성하되 직원은 수정 가능.
// 2026-11: 기간(시작월~종료월) 선택 + 1쪽 요약 리포트(GrowthSummaryReport) 추가 — 상세 리포트와 병존.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader, AlertCircle, RotateCcw } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, LabelList,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import ModalShell from '../common/ModalShell.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'
import {
  toAttendanceRecord, toLearningRecord, toCounselingRecord,
  toBookingCounselingRecord, toTask, toQuizAttempt, toMindRecord,
  toStudentFeedback, toCareerDesignResult, toLearningDiagnosisResult, toExamFeedback,
} from '../../lib/supabaseHelpers.js'
import { todayStr } from '../../utils/dateUtils.js'
import { buildFilename, nowDateTime } from '../../pdf/utils/formatters.js'
import { authorOf } from '../../pdf/config/meta.js'
import {
  buildGrowthReportData, buildExamTrend, buildCareerSummaryText, buildDiagnosisSummaryText,
  defaultSummaryTitle, SUMMARY_SUBJECTS, SUMMARY_TEXT_LIMITS,
} from '../../context/selectors/growthReport.js'
import { subjectColor } from '../../data/subjects.js'
import { STUDY_METHODS } from '../../context/selectors/learningRecords.js'

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-full'

// 학습법 고정 색 순서 — dataviz 검증 통과 팔레트 (학습법 정체성 기준 고정 배정,
// 순위에 따라 재배색하지 않는다). 미분류는 중립 회색.
const METHOD_COLORS = ['#dc2626', '#2563eb', '#d97706', '#7c3aed', '#16a34a', '#db2777', '#0891b2', '#65a30d']
const methodColor = (method) => {
  const idx = STUDY_METHODS.indexOf(method)
  return idx >= 0 ? METHOD_COLORS[idx % METHOD_COLORS.length] : '#6b7280'
}

// 기간 표기 — 한 달: '8월', 같은 해 여러 달: '7~9월', 해 넘김: '2026.11~2027.2'
function rangeLabel(start, end) {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  if (sy === ey && sm === em) return `${sm}월`
  if (sy === ey) return `${sm}~${em}월`
  return `${sy}.${sm}~${ey}.${em}`
}

// 요약 리포트 텍스트 입력 — 권장 글자수 카운터 + 자동 생성 되돌리기. 학생·학부모는 읽기 전용.
function SummaryField({ label, value, auto, limit, editable, rows = 3, onChange, onReset }) {
  const over = limit && value.length > limit
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-semibold text-gray-600">{label}</label>
        <span className="flex items-center gap-2">
          {limit ? (
            <span className={`text-[11px] ${over ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}>
              {value.length}/{limit}자{over ? ' (초과 시 글자가 작아집니다)' : ''}
            </span>
          ) : null}
          {editable && value !== auto && (
            <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-semibold">
              <RotateCcw size={11} /> 되돌리기
            </button>
          )}
        </span>
      </div>
      {editable ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={fieldClass} />
      ) : (
        <p className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 rounded-xl px-3 py-2 min-h-[2.5rem]">{value || '-'}</p>
      )}
    </div>
  )
}

const fmtHours = (min) => {
  const m = Math.round(Number(min) || 0)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const r = m % 60
    return r > 0 ? `${h}시간 ${r}분` : `${h}시간`
  }
  return `${m}분`
}

// 파이 직접 라벨: 이름 + 비중% (색만으로 구분하지 않는다)
const pieLabel = ({ name, percent }) => `${name} ${Math.round(percent * 100)}%`

function DistPie({ data, colorOf }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 18, right: 42, bottom: 18, left: 42 }}>
        <Pie
          data={data}
          dataKey="minutes"
          nameKey="name"
          outerRadius="72%"
          stroke="#ffffff"
          strokeWidth={2}
          label={pieLabel}
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={colorOf(entry.name)} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmtHours(v)} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function GrowthReportModal({ student, onClose }) {
  const { data } = useData()
  const { currentUser } = useAuth()
  const studentId = student?.id

  const [startMonth, setStartMonth] = useState(() => todayStr().slice(0, 7))
  const [endMonth, setEndMonth] = useState(() => todayStr().slice(0, 7))
  // 요약 리포트 텍스트 직접 수정분 {key: text} — 없으면 자동 생성값. 기간·학생 변경 시 비움.
  const [overrides, setOverrides] = useState({})
  const [period, setPeriod] = useState(null) // { rows... } 조회 결과
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [coachingText, setCoachingText] = useState('')
  const coachingTouched = useRef(false)

  // 직원만 코칭 내용 수정 가능 — 학생·학부모는 자동 생성 텍스트 그대로.
  const canEditCoaching = !['student', 'parent'].includes(currentUser?.role)

  const subjectRef = useRef(null)
  const methodRef = useRef(null)
  const weeklyRef = useRef(null)
  const consultingRef = useRef(null)

  // 시작 > 종료가 되지 않게 반대쪽을 끌어 맞춘다
  const changeStart = (v) => {
    if (!v) return
    setStartMonth(v)
    if (v > endMonth) setEndMonth(v)
  }
  const changeEnd = (v) => {
    if (!v) return
    setEndMonth(v)
    if (v < startMonth) setStartMonth(v)
  }

  useEffect(() => {
    if (!startMonth || !endMonth || !studentId) return
    let cancelled = false
    setLoading(true)
    setError(false)
    const [sy, sm] = startMonth.split('-').map(Number)
    const [y, m] = endMonth.split('-').map(Number)
    const first = `${sy}-${String(sm).padStart(2, '0')}-01`
    // 말일은 실제 달력 기준 — '2026-02-31' 같은 date 리터럴은 Postgres 에러
    const last = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`

    const inMonth = (q) => q.eq('student_id', studentId).gte('date', first).lte('date', last)
    Promise.all([
      inMonth(supabase.from('attendance_records').select('*')),
      inMonth(supabase.from('learning_records').select('*')),
      inMonth(supabase.from('counseling_records').select('*')),
      inMonth(supabase.from('booking_records').select('*, booking_reservations(booking_slots(start_time, end_time)), booking_programs(name)').eq('status', 'done')),
      supabase.from('tasks').select('*').eq('student_id', studentId).gte('due_date', first).lte('due_date', last),
      // 응시일 경계는 selector가 KST 기준으로 거른다 — 학생당 응시 수가 적어 전량 조회
      supabase.from('quiz_attempts').select('*').eq('student_id', studentId),
      inMonth(supabase.from('mind_records').select('*')),
      inMonth(supabase.from('student_feedbacks').select('*')),
      // 요약 리포트용 — 검사 결과·내신 피드백은 기간 무관 학생 전량(소량), 선택은 selector가 한다
      supabase.from('career_results').select('*').eq('student_id', studentId),
      supabase.from('diagnosis_results').select('*').eq('student_id', studentId),
      supabase.from('exam_feedbacks').select('*').eq('student_id', studentId),
    ]).then((results) => {
      if (cancelled) return
      const failed = results.find((r) => r.error)
      // student_feedbacks는 마이그레이션 미적용이어도 나머지로 리포트 생성
      if (failed && !results.slice(7).includes(failed)) {
        setError(true)
        setLoading(false)
        return
      }
      const [attRes, learnRes, counsRes, bookRes, taskRes, quizRes, mindRes, fbRes, careerRes, diagRes, examRes] = results
      const okRows = (r) => (r.error ? [] : (r.data ?? []))
      setPeriod({
        startDate: first,
        endDate: last,
        attendanceRecords: (attRes.data ?? []).map(toAttendanceRecord),
        learningRecords: (learnRes.data ?? []).map(toLearningRecord),
        counselingRecords: [
          ...(counsRes.data ?? []).map(toCounselingRecord),
          ...(bookRes.data ?? []).map(toBookingCounselingRecord),
        ],
        tasks: (taskRes.data ?? []).map(toTask),
        quizAttempts: (quizRes.data ?? []).map(toQuizAttempt),
        mindRecords: (mindRes.data ?? []).map(toMindRecord),
        studentFeedbacks: okRows(fbRes).map(toStudentFeedback),
        careerResults: okRows(careerRes).map(toCareerDesignResult),
        diagnosisResults: okRows(diagRes).map(toLearningDiagnosisResult),
        examFeedbacks: okRows(examRes).map(toExamFeedback),
      })
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [startMonth, endMonth, studentId, retryKey])

  const report = useMemo(() => {
    if (!period) return null
    return buildGrowthReportData(
      { ...period, quizSets: data.quizSets, educators: data.educators },
      { studentId, startDate: period.startDate, endDate: period.endDate }
    )
  }, [period, data.quizSets, data.educators, studentId])

  // 월 변경/재조회 시 코칭 텍스트를 자동 생성값으로 갱신 (직접 수정 전까지)
  useEffect(() => {
    coachingTouched.current = false
    setOverrides({})
  }, [startMonth, endMonth, studentId])
  useEffect(() => {
    if (report && !coachingTouched.current) setCoachingText(report.coaching.autoText)
  }, [report])

  const label = rangeLabel(startMonth, endMonth)
  const multiMonth = startMonth !== endMonth
  const groupName = (student?.groups ?? []).join(', ')

  // 요약 리포트 자동 생성 텍스트 (period가 바뀔 때만 재계산)
  const summaryAuto = useMemo(() => {
    if (!period || !report) return null
    const end = period.endDate
    const trend = buildExamTrend(period.examFeedbacks, studentId, end)
    const auto = {
      title: defaultSummaryTitle(student?.groups, end.slice(0, 4)),
      career: buildCareerSummaryText(period.careerResults, studentId, end),
      diagnosis: buildDiagnosisSummaryText(period.diagnosisResults, studentId, end),
      actionPlan: trend.actionPlan,
    }
    for (const k of SUMMARY_SUBJECTS) auto[k] = report.subjectCoaching[k].autoText
    return { auto, trend }
  }, [period, report, studentId, student?.groups])

  const sumVal = (key) => overrides[key] ?? summaryAuto?.auto[key] ?? ''
  const sumField = (key, extra) => ({
    value: sumVal(key),
    auto: summaryAuto?.auto[key] ?? '',
    editable: canEditCoaching,
    onChange: (v) => setOverrides((o) => ({ ...o, [key]: v })),
    onReset: () => setOverrides((o) => { const n = { ...o }; delete n[key]; return n }),
    ...extra,
  })

  const buildSummaryDocument = async () => {
    const { default: GrowthSummaryReport } = await import('../../pdf/reports/GrowthSummaryReport.jsx')
    return {
      element: (
        <GrowthSummaryReport
          title={sumVal('title')}
          student={{ name: student?.name, school: student?.school, grade: student?.grade }}
          generatedAt={nowDateTime()}
          author={authorOf(currentUser)}
          usage={{
            title: multiMonth ? '월별' : '주차별',
            totalMinutes: report.usage.totalMinutes,
            bars: multiMonth ? report.usage.monthly : report.usage.weekly,
          }}
          study={report.study}
          coachingText={coachingText}
          examTrend={summaryAuto.trend}
          actionPlanText={sumVal('actionPlan')}
          careerText={sumVal('career')}
          diagnosisText={sumVal('diagnosis')}
          subjects={SUMMARY_SUBJECTS.map((k) => ({
            name: k, count: report.subjectCoaching[k].count, text: sumVal(k),
          }))}
        />
      ),
      filename: buildFilename('종합성장요약리포트', `${student?.name}_${label}`),
    }
  }

  const buildDocument = async () => {
    const { captureChart } = await import('../../pdf/utils/captureChart.js')
    const [subjectPng, methodPng, weeklyPng, consultingPng] = await Promise.all([
      captureChart(subjectRef.current),
      captureChart(methodRef.current),
      captureChart(weeklyRef.current),
      captureChart(consultingRef.current),
    ])
    const { default: GrowthReport } = await import('../../pdf/reports/GrowthReport.jsx')
    return {
      element: (
        <GrowthReport
          title={`종합성장리포트 ${label}`}
          groupName={groupName}
          periodText={`${period.startDate} ~ ${period.endDate}`}
          student={{ name: student?.name, school: student?.school, grade: student?.grade }}
          generatedAt={nowDateTime()}
          author={authorOf(currentUser)}
          charts={{ subjectPng, methodPng, weeklyPng, consultingPng }}
          usage={report.usage}
          study={report.study}
          mind={report.mind}
          consulting={report.consulting}
          coachingText={coachingText}
          feedbacks={report.feedbacks}
          quiz={report.quiz}
          tasks={report.tasks}
        />
      ),
      filename: buildFilename('종합성장리포트', `${student?.name}_${label}`),
    }
  }

  const usageBars = multiMonth ? report?.usage.monthly : report?.usage.weekly
  const hasWeekly = usageBars?.some((w) => w.minutes > 0)

  return (
    <ModalShell title="종합성장리포트" onClose={onClose} maxWidth="max-w-2xl">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">대상 기간 (시작월 ~ 종료월)</label>
        <div className="flex items-center gap-2">
          <input type="month" value={startMonth} onChange={(e) => changeStart(e.target.value)} className={fieldClass} />
          <span className="text-gray-400">~</span>
          <input type="month" value={endMonth} onChange={(e) => changeEnd(e.target.value)} className={fieldClass} />
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">
          <Loader size={16} className="animate-spin inline mr-1.5" /> 기간 데이터를 불러오는 중...
        </div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-red-500">
          <AlertCircle size={14} className="inline mr-1" /> 데이터를 불러오지 못했습니다.
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="ml-2 text-blue-600 font-semibold"
          >
            다시 시도
          </button>
        </div>
      ) : report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              ['센터 이용시간', fmtHours(report.usage.totalMinutes)],
              ['총 학습시간', fmtHours(report.study.totalMinutes)],
              ['자기주도지수', report.study.selfIndex == null ? '-' : `${report.study.selfIndex}점`],
              ['마인드 점수', report.mind.stability == null ? '-' : `${report.mind.stability}점`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 p-2">
                <p className="text-sm font-bold text-gray-800">{value}</p>
                <p className="text-[11px] text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {/* 차트 미리보기 — 이 노드들을 그대로 PNG 캡처해 PDF에 넣는다 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">과목별 학습시간</p>
              {report.study.subjectDist.length > 0 ? (
                <div ref={subjectRef} className="h-[210px] bg-white">
                  <DistPie data={report.study.subjectDist} colorOf={subjectColor} />
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-6 text-center">기간 내 학습 기록 없음</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">학습법별 학습시간</p>
              {report.study.methodDist.length > 0 ? (
                <div ref={methodRef} className="h-[210px] bg-white">
                  <DistPie data={report.study.methodDist} colorOf={methodColor} />
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-6 text-center">기간 내 학습 기록 없음</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">{multiMonth ? '월별' : '주차별'} 센터 이용시간</p>
              {hasWeekly ? (
                <div ref={weeklyRef} className="h-[180px] bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageBars} margin={{ top: 16, right: 8, bottom: 4, left: 8 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis hide />
                      <Tooltip formatter={(v) => fmtHours(v)} />
                      <Bar dataKey="minutes" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        <LabelList dataKey="minutes" position="top" formatter={(v) => (v > 0 ? fmtHours(v) : '')} style={{ fontSize: 10, fill: '#374151' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-6 text-center">기간 내 센터 이용 기록 없음</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">교과 컨설팅 시간</p>
              {report.consulting.rows.length > 0 ? (
                <div ref={consultingRef} className="h-[180px] bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.consulting.rows} margin={{ top: 16, right: 8, bottom: 4, left: 8 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis hide />
                      <Tooltip formatter={(v, _n, p) => [`${fmtHours(v)} · ${p.payload.sessions}회`, '컨설팅']} />
                      <Bar dataKey="minutes" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {report.consulting.rows.map((r) => (
                          <Cell key={r.name} fill={subjectColor(r.name)} />
                        ))}
                        <LabelList dataKey="sessions" position="top" formatter={(v) => `${v}회`} style={{ fontSize: 10, fill: '#374151' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-6 text-center">기간 내 교과 컨설팅 없음</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">
                자기주도 학습 코칭 내용 {canEditCoaching && <span className="font-normal text-gray-400">(수정 가능 — 코칭 상담 기록에서 자동 생성)</span>}
              </label>
              {canEditCoaching && coachingText !== report.coaching.autoText && (
                <button
                  type="button"
                  onClick={() => { coachingTouched.current = false; setCoachingText(report.coaching.autoText) }}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-semibold"
                >
                  <RotateCcw size={11} /> 자동 생성으로 되돌리기
                </button>
              )}
            </div>
            {canEditCoaching ? (
              <textarea
                value={coachingText}
                onChange={(e) => { coachingTouched.current = true; setCoachingText(e.target.value) }}
                rows={4}
                placeholder="기간 내 코칭 기록이 없습니다. 직접 입력할 수 있습니다."
                className={fieldClass}
              />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 rounded-xl px-3 py-2.5 min-h-[3rem]">
                {coachingText || '기간 내 코칭 내용이 없습니다.'}
              </p>
            )}
          </div>

          <div className="text-xs text-gray-500">
            피드백 {report.feedbacks.length}건 · 확인평가 {report.quiz.rows.length}회 · 과제 {report.tasks.total}건
          </div>

          <details className="rounded-xl border border-gray-200 px-3 py-2">
            <summary className="text-xs font-semibold text-gray-700 cursor-pointer">
              요약 리포트 내용 {canEditCoaching && <span className="font-normal text-gray-400">(1쪽 · 수정 가능)</span>}
            </summary>
            {summaryAuto && (
              <div className="space-y-3 mt-3">
                <SummaryField label="제목" {...sumField('title')} rows={1} />
                <p className="text-[11px] text-gray-400">학습코칭은 위 '자기주도 학습 코칭 내용'이 그대로 들어갑니다 (권장 {SUMMARY_TEXT_LIMITS.coaching}자, 현재 {coachingText.length}자).</p>
                <SummaryField label="진로진단" {...sumField('career', { limit: SUMMARY_TEXT_LIMITS.career })} />
                <SummaryField label="학습진단" {...sumField('diagnosis', { limit: SUMMARY_TEXT_LIMITS.diagnosis })} />
                <SummaryField label={`내신 보완과 실천과제 (${summaryAuto.trend.examYear}학년도 최근 시험 기준)`} {...sumField('actionPlan', { limit: SUMMARY_TEXT_LIMITS.actionPlan, rows: 4 })} />
                {SUMMARY_SUBJECTS.map((k) => (
                  <SummaryField
                    key={k}
                    label={`${k} 교과 코칭 (총 ${report.subjectCoaching[k].count}회)`}
                    {...sumField(k, { limit: SUMMARY_TEXT_LIMITS.subject, rows: 4 })}
                  />
                ))}
              </div>
            )}
          </details>

          <div className="flex justify-end gap-2 flex-wrap">
            <DownloadPdfButton label="상세 리포트 PDF" buildDocument={buildDocument} disabled={!report} />
            <DownloadPdfButton label="요약 리포트(1쪽) PDF" buildDocument={buildSummaryDocument} disabled={!report || !summaryAuto} />
          </div>
        </>
      )}
    </ModalShell>
  )
}
