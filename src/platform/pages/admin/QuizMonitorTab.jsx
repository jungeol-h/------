// 확인평가 모니터링 탭 — 관리자(/admin/quiz)와 교과강사(/instructor/quiz) 공용.
// 과목 탭 > 학년·그룹 필터로 좁히고, 요약 카드를 "{과목} · {학년}" 섹션(회차 오름차순)으로 계층 표시.
// 그룹 필터는 회차가 아니라 대상 학생·응시를 거른다 (회차엔 그룹 소속이 없다).
// + 회차 관리(QuizSetManagement) + 응시 결과·채점 테이블 + 조건 지정 PDF 보고서(QuizReportModal).
// 강사는 본인 과목(instructorQuizSubject) 회차·응시만 필터, 관리자는 전체를 본다.

import { useMemo, useState } from 'react'
import { ClipboardCheck, Printer } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import QuizResultsTable from '../../components/admin/QuizResultsTable.jsx'
import QuizSetManagement from '../../components/admin/QuizSetManagement.jsx'
import QuizReportModal from '../../components/admin/QuizReportModal.jsx'
import RefreshButton from '../../components/RefreshButton.jsx'
import { QUIZ_SUBJECTS, instructorQuizSubject } from '../../utils/quizSubjects.js'
import { GRADES } from '../../data/grades.js'
import { GROUP_OPTIONS } from '../../data/groups.js'
import { buildQuizSummaries } from '../../utils/quizSummaries.js'

const pillClass = (active) =>
  `px-2.5 py-1 rounded-full text-[11px] font-semibold border transition flex-shrink-0 ${
    active
      ? 'bg-emerald-600 text-white border-emerald-600'
      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
  }`

// readOnly: 감독관(viewer) 열람용 — 회차 관리 숨김·수동 채점 비활성 (요약·결과·PDF 보고서는 허용)
export default function QuizMonitorTab({ readOnly = false }) {
  const { data, updateQuizAttemptGrading } = useData()
  const { currentUser } = useAuth()

  // 강사는 자기 과목 회차·응시만 (관리자는 전체)
  const mySubject = instructorQuizSubject(currentUser)
  const scopedSets = useMemo(
    () => (mySubject ? data.quizSets.filter((s) => s.subject === mySubject) : data.quizSets),
    [data.quizSets, mySubject]
  )
  const scopedAttempts = useMemo(() => {
    if (!mySubject) return data.quizAttempts
    const setIds = new Set(scopedSets.map((s) => s.id))
    return data.quizAttempts.filter((a) => setIds.has(a.quizSetId))
  }, [data.quizAttempts, scopedSets, mySubject])

  // 과목·학년·그룹 계층 필터 (강사는 과목 탭 숨김 — 자기 과목 고정)
  const [activeSubject, setActiveSubject] = useState('전체')
  const [activeGrade, setActiveGrade] = useState('전체')
  const [activeGroup, setActiveGroup] = useState('전체')
  const [reportOpen, setReportOpen] = useState(false)

  // 그룹 필터는 학생을 거른다 — '전체'는 무소속(빈 배열) 학생도 포함
  const viewStudents = useMemo(
    () =>
      activeGroup === '전체'
        ? data.students
        : data.students.filter((s) => (s.groups ?? []).includes(activeGroup)),
    [data.students, activeGroup]
  )

  const viewSets = useMemo(
    () =>
      scopedSets.filter(
        (s) =>
          (mySubject || activeSubject === '전체' || s.subject === activeSubject) &&
          (activeGrade === '전체' || s.grade === activeGrade || s.grade === '전체')
      ),
    [scopedSets, mySubject, activeSubject, activeGrade]
  )
  const viewAttempts = useMemo(() => {
    // 필터가 없으면 스코프 전체 그대로 (세트 미상 응시도 기존처럼 테이블에 남긴다)
    let result = scopedAttempts
    if (!((mySubject || activeSubject === '전체') && activeGrade === '전체')) {
      const setIds = new Set(viewSets.map((s) => s.id))
      result = result.filter((a) => setIds.has(a.quizSetId))
    }
    if (activeGroup !== '전체') {
      const studentIds = new Set(viewStudents.map((s) => s.id))
      result = result.filter((a) => studentIds.has(a.studentId))
    }
    return result
  }, [scopedAttempts, viewSets, viewStudents, mySubject, activeSubject, activeGrade, activeGroup])

  // 회차별 응시자 수 / 미응시자 수 / 평균 — 간단 요약 카드 (계산은 quizSummaries.js 공용)
  const summaries = useMemo(
    () => buildQuizSummaries(viewSets, viewAttempts, viewStudents),
    [viewSets, viewAttempts, viewStudents]
  )

  // "{과목} · {학년}" 섹션으로 그룹핑 — 과목(QUIZ_SUBJECTS 순) > 학년(GRADES 순) > 회차 오름차순
  const sections = useMemo(() => {
    const map = new Map()
    summaries.forEach((summary) => {
      const subject = summary.set.subject ?? '국어'
      const grade = summary.set.grade ?? '학년 미상'
      const key = `${subject} · ${grade}`
      if (!map.has(key)) map.set(key, { key, subject, grade, items: [] })
      map.get(key).items.push(summary)
    })
    const subjectOrder = (s) => {
      const i = QUIZ_SUBJECTS.indexOf(s)
      return i === -1 ? QUIZ_SUBJECTS.length : i
    }
    const gradeOrder = (g) => {
      const i = GRADES.indexOf(g)
      return i === -1 ? GRADES.length : i
    }
    return [...map.values()]
      .sort(
        (a, b) =>
          subjectOrder(a.subject) - subjectOrder(b.subject) ||
          gradeOrder(a.grade) - gradeOrder(b.grade)
      )
      .map((sec) => ({
        ...sec,
        items: [...sec.items].sort((a, b) => (a.set.round ?? 0) - (b.set.round ?? 0)),
      }))
  }, [summaries])

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="text-emerald-600" />
          <h2 className="text-base font-bold text-gray-800">
            {mySubject ? `${mySubject} 확인평가 모니터링` : '확인평가 모니터링'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            disabled={scopedSets.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            <Printer size={14} />
            보고서 출력
          </button>
        </div>
      </div>

      {/* 과목 pill 탭 — 강사는 자기 과목으로 자동 스코핑되어 숨김 (QuizSetManagement와 같은 패턴) */}
      {!mySubject && (
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['전체', ...QUIZ_SUBJECTS].map((s) => (
            <button key={s} type="button" onClick={() => setActiveSubject(s)} className={pillClass(activeSubject === s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 학년 pill + 그룹 pill — 그룹은 대상 학생·응시를 거른다 */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {['전체', ...GRADES].map((g) => (
          <button key={g} type="button" onClick={() => setActiveGrade(g)} className={pillClass(activeGrade === g)}>
            {g}
          </button>
        ))}
        <span className="w-px h-4 bg-gray-200 flex-shrink-0" aria-hidden />
        {['전체', ...GROUP_OPTIONS].map((g) => (
          <button
            key={`group-${g}`}
            type="button"
            onClick={() => setActiveGroup(g)}
            className={pillClass(activeGroup === g)}
          >
            {g === '전체' ? '전체 그룹' : g}
          </button>
        ))}
      </div>

      {summaries.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-gray-400">
          {scopedSets.length === 0
            ? '아직 등록된 회차가 없습니다.'
            : '선택한 조건에 해당하는 회차가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec) => (
            <div key={sec.key}>
              <p className="text-xs font-bold text-gray-500 mb-1.5">
                {sec.subject} · {sec.grade}
                <span className="font-semibold text-gray-400 ml-1.5">{sec.items.length}회차</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {sec.items.map(({ set, eligibleCount, submittedCount, missingCount, pendingCount, avgPct }) => (
                  <div key={set.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                    {/* 같은 회차 번호의 별개 시험이 있을 수 있어 회차+제목으로 식별한다 */}
                    <p className="text-[11px] font-bold text-emerald-600">{set.round}회</p>
                    <p className="text-sm font-semibold text-gray-800 leading-snug mt-0.5">{set.title}</p>
                    <div className="flex items-end gap-2 mt-3">
                      <span className="text-2xl font-bold text-gray-800">{submittedCount}</span>
                      <span className="text-xs text-gray-400 pb-1">/ {eligibleCount}명 응시</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>미응시 {missingCount}</span>
                      <span>평균 {avgPct}%</span>
                    </div>
                    {pendingCount > 0 && (
                      <p className="text-[11px] text-amber-600 font-semibold mt-1">미채점 {pendingCount}건</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && <QuizSetManagement />}

      <QuizResultsTable
        attempts={viewAttempts}
        students={data.students}
        quizSets={viewSets}
        quizQuestions={data.quizQuestions}
        onUpdateGrading={readOnly ? undefined : updateQuizAttemptGrading}
      />

      {reportOpen && (
        <QuizReportModal
          quizSets={scopedSets}
          attempts={scopedAttempts}
          students={data.students}
          mySubject={mySubject}
          currentUser={currentUser}
          defaultSubject={activeSubject}
          defaultGrade={activeGrade}
          defaultGroup={activeGroup}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}
