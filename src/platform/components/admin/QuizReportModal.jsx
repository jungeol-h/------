// 확인평가 보고서 출력 모달 — 과목·학년·그룹(다중 체크)·회차를 지정해 QuizReport PDF를 부분 출력한다.
// 그룹은 회차가 아니라 대상 학생·응시를 거른다 — 그룹 전체 선택 시엔 무소속 학생도 포함.
// QuizMonitorTab(관리자·강사·감독관 공용)에서 오픈. quizSets/attempts는 이미 강사 스코핑된 것을 받는다.
// 주의: 실DB에서 (과목, 학년, 회차)가 유니크하지 않다 — 같은 회차 번호를 공유하는 별개 시험이
// 여러 개일 수 있으므로 회차 선택은 "필터"이며, 미리보기의 회차 개수로 실제 매칭 수를 보여준다.

import { useEffect, useMemo, useState } from 'react'
import ModalShell from '../common/ModalShell.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { buildFilename, nowDateTime } from '../../pdf/utils/formatters.js'
import { authorOf } from '../../pdf/config/meta.js'
import { QUIZ_SUBJECTS, SUBJECT_BADGE } from '../../utils/quizSubjects.js'
import { GRADES } from '../../data/grades.js'
import { GROUP_OPTIONS } from '../../data/groups.js'
import { buildQuizSummaries } from '../../utils/quizSummaries.js'

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full'

const pillClass = (active) =>
  `px-2.5 py-1 rounded-full text-[11px] font-semibold border transition flex-shrink-0 ${
    active
      ? 'bg-emerald-600 text-white border-emerald-600'
      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
  }`

export default function QuizReportModal({
  quizSets,
  attempts,
  students,
  mySubject,
  currentUser,
  defaultSubject = '전체',
  defaultGrade = '전체',
  defaultGroup = '전체',
  onClose,
}) {
  // 강사는 자기 과목 고정, 관리자·감독관은 현재 탭 선택값으로 프리필
  const [subject, setSubject] = useState(mySubject ?? defaultSubject ?? '전체')
  // 학년 다중 선택 — 기본 전체, 탭에서 특정 학년을 보고 있었으면 그 학년만
  const [grades, setGrades] = useState(() =>
    GRADES.includes(defaultGrade) ? [defaultGrade] : [...GRADES]
  )
  const [round, setRound] = useState('전체') // '전체' | number
  // 그룹 다중 선택 — 기본 전체, 탭에서 특정 그룹을 보고 있었으면 그 그룹만
  const [groupSel, setGroupSel] = useState(() =>
    GROUP_OPTIONS.includes(defaultGroup) ? [defaultGroup] : [...GROUP_OPTIONS]
  )

  // 토글하되 GRADES 순서를 유지한 배열로 보관 (라벨·파일명 표기 일관성)
  const toggleGrade = (g) => {
    setGrades((prev) =>
      prev.includes(g)
        ? prev.filter((x) => x !== g)
        : GRADES.filter((x) => prev.includes(x) || x === g)
    )
  }

  const toggleGroup = (g) => {
    setGroupSel((prev) =>
      prev.includes(g)
        ? prev.filter((x) => x !== g)
        : GROUP_OPTIONS.filter((x) => prev.includes(x) || x === g)
    )
  }

  // 그룹은 학생을 거른다 — 전체 선택이면 필터 없음(무소속 포함)
  const allGroups = groupSel.length === GROUP_OPTIONS.length
  const targetStudents = useMemo(
    () =>
      allGroups
        ? students
        : students.filter((s) => (s.groups ?? []).some((g) => groupSel.includes(g))),
    [students, allGroups, groupSel]
  )

  const gradeSet = useMemo(() => new Set(grades), [grades])

  // 과목·학년 조건까지 만족하는 세트 — 회차 옵션 산출용
  const subjectGradeSets = useMemo(
    () =>
      quizSets.filter(
        (s) => (subject === '전체' || s.subject === subject) && (gradeSet.has(s.grade) || s.grade === '전체')
      ),
    [quizSets, subject, gradeSet]
  )

  // 회차 옵션 — 현재 과목·학년 선택에 존재하는 distinct round 오름차순
  const roundOptions = useMemo(
    () =>
      [...new Set(subjectGradeSets.map((s) => s.round).filter((r) => r != null))].sort(
        (a, b) => a - b
      ),
    [subjectGradeSets]
  )

  // 과목/학년 변경으로 선택한 회차가 옵션에서 사라지면 '전체'로 리셋
  useEffect(() => {
    if (round !== '전체' && !roundOptions.includes(round)) setRound('전체')
  }, [round, roundOptions])

  // 최종 매칭 세트 — 보고서 표 순서를 위해 과목 > 학년 > 회차 오름차순 정렬
  const matchedSets = useMemo(() => {
    const filtered =
      round === '전체' ? subjectGradeSets : subjectGradeSets.filter((s) => s.round === round)
    const subjectOrder = (s) => {
      const i = QUIZ_SUBJECTS.indexOf(s.subject)
      return i === -1 ? QUIZ_SUBJECTS.length : i
    }
    const gradeOrder = (s) => {
      const i = GRADES.indexOf(s.grade)
      return i === -1 ? GRADES.length : i
    }
    return [...filtered].sort(
      (a, b) =>
        subjectOrder(a) - subjectOrder(b) ||
        gradeOrder(a) - gradeOrder(b) ||
        (a.round ?? 0) - (b.round ?? 0)
    )
  }, [subjectGradeSets, round])

  const matchedAttempts = useMemo(() => {
    const ids = new Set(matchedSets.map((s) => s.id))
    const bySet = attempts.filter((a) => ids.has(a.quizSetId))
    if (allGroups) return bySet
    const studentIds = new Set(targetStudents.map((s) => s.id))
    return bySet.filter((a) => studentIds.has(a.studentId))
  }, [attempts, matchedSets, allGroups, targetStudents])

  const canBuild = grades.length > 0 && groupSel.length > 0 && matchedSets.length > 0

  // 조건 표기 — PDF period 라인·파일명 공용 재료
  const subjectLabel = subject === '전체' ? '전체 과목' : subject
  const roundLabel = round === '전체' ? '전체 회차' : `${round}회`
  const gradeLabel = grades.length === GRADES.length ? '전체 학년' : grades.join('·')
  const groupLabel = allGroups ? '전체 그룹' : groupSel.join('·')

  return (
    <ModalShell title="확인평가 보고서" onClose={onClose}>
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">과목</label>
        {mySubject ? (
          // 강사는 자기 과목 고정
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-bold ${
              SUBJECT_BADGE[mySubject] ?? 'bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            {mySubject}
            <span className="font-medium text-[10px] opacity-70">담당 과목</span>
          </span>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {['전체', ...QUIZ_SUBJECTS].map((s) => (
              <button key={s} type="button" onClick={() => setSubject(s)} className={pillClass(subject === s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">학년 (복수 선택)</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {GRADES.map((g) => (
            <button key={g} type="button" onClick={() => toggleGrade(g)} className={pillClass(grades.includes(g))}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">그룹 (복수 선택)</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {GROUP_OPTIONS.map((g) => (
            <button key={g} type="button" onClick={() => toggleGroup(g)} className={pillClass(groupSel.includes(g))}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">회차</label>
        <select
          value={round === '전체' ? '전체' : String(round)}
          onChange={(e) => setRound(e.target.value === '전체' ? '전체' : Number(e.target.value))}
          className={fieldClass}
        >
          <option value="전체">전체 회차</option>
          {roundOptions.map((r) => (
            <option key={r} value={r}>{r}회</option>
          ))}
        </select>
      </div>

      {/* 실시간 미리보기 — 조건에 걸리는 회차·응시 건수 */}
      <div className="text-sm">
        {grades.length === 0 ? (
          <span className="text-red-500">학년을 하나 이상 선택하세요.</span>
        ) : groupSel.length === 0 ? (
          <span className="text-red-500">그룹을 하나 이상 선택하세요.</span>
        ) : matchedSets.length === 0 ? (
          <span className="text-gray-400">조건에 해당하는 회차가 없습니다.</span>
        ) : (
          <span className="text-gray-600">
            회차 <span className="font-bold">{matchedSets.length}</span>개 ·
            응시 <span className="font-bold">{matchedAttempts.length}</span>건
          </span>
        )}
      </div>

      <div className="flex justify-end">
        <DownloadPdfButton
          label="보고서 PDF"
          disabled={!canBuild}
          buildDocument={async () => {
            const { default: QuizReport } = await import('../../pdf/reports/QuizReport.jsx')
            const summaries = buildQuizSummaries(matchedSets, matchedAttempts, targetStudents)
            return {
              element: (
                <QuizReport
                  summaries={summaries}
                  attempts={matchedAttempts}
                  students={students}
                  quizSets={matchedSets}
                  period={`${subjectLabel} · ${roundLabel} · ${gradeLabel} · ${groupLabel} · 조회일 ${nowDateTime().slice(0, 10)}`}
                  generatedAt={nowDateTime()}
                  author={authorOf(currentUser)}
                />
              ),
              filename: buildFilename(
                '확인평가보고서',
                [
                  subject === '전체' ? '전체과목' : subject,
                  round === '전체' ? '전체회차' : `${round}회`,
                  grades.length === GRADES.length ? '전체학년' : grades.join('·'),
                  ...(allGroups ? [] : [groupSel.join('·')]),
                ].join('_')
              ),
            }
          }}
        />
      </div>
    </ModalShell>
  )
}
