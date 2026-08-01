import { useEffect, useMemo, useState } from 'react'
import ModalShell from '../common/ModalShell.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { educatorDisplayName } from '../../utils/educatorName.js'
import {
  currentMonthRange,
  monthRangeOf,
  formatKoreanDate,
} from '../../context/selectors/monthlyCounselingReport.js'
import { buildMonthlyLessonEntries } from '../../context/selectors/monthlyLessonReport.js'

const DEFAULT_SCHEDULE = '매주 토요일 12:00~19:00'

// 강사별 월간 수업 보고서 출력 옵션 모달 — counseling/MonthlyReportModal의 수업보고 변형.
// 데이터가 동기(data.lessonReports)라 async loadRecords 없이 단순하다.
// props:
//   educators: [{id, name, subject}] — 강사 선택 셀렉트(admin/viewer용). fixedEducator와 택일
//   fixedEducator: {id, name, subject} — 본인 고정(매니저/강사/컨설턴트)
//   reports: data.lessonReports **전량** — 누적회차가 기간 이전 이력 기준이라 미리 자르면 안 된다
//   getStudent: (studentId) => student | undefined
//   onClose
export default function LessonReportModal({
  educators = null,
  fixedEducator = null,
  reports,
  getStudent,
  onClose,
}) {
  const [defaultStart, defaultEnd] = useMemo(() => currentMonthRange(), [])
  const [educatorId, setEducatorId] = useState(fixedEducator?.id ?? '')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [datesTouched, setDatesTouched] = useState(false) // 사용자가 기간을 직접 수정했는가
  const [duty, setDuty] = useState(fixedEducator?.subject ?? '')
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)

  const selectedEducator =
    fixedEducator ?? educators?.find((e) => e.id === educatorId) ?? null

  // 월초에 열면 기본 기간(이번 달)이 0건인 사고 방지 — 사용자가 기간을 손대기 전이고
  // 현재 기간에 기록이 없으면, 선택 강사의 최근 기록이 있는 달로 기간을 자동 이동한다.
  // 이동 후에는 기간 내 기록이 생겨 조건이 거짓이 되므로 재실행돼도 무한 루프가 없다.
  useEffect(() => {
    if (datesTouched || !educatorId) return
    const mine = (reports ?? []).filter((r) => r.authorId === educatorId && r.date)
    if (mine.length === 0) return
    if (mine.some((r) => r.date >= startDate && r.date <= endDate)) return
    const latest = mine.reduce((acc, r) => (r.date > acc ? r.date : acc), mine[0].date)
    const range = monthRangeOf(latest)
    if (!range) return
    setStartDate(range[0])
    setEndDate(range[1])
  }, [datesTouched, reports, educatorId, startDate, endDate])

  const { entries, totalCount } = useMemo(() => {
    if (!educatorId || !startDate || !endDate) return { entries: [], totalCount: 0 }
    return buildMonthlyLessonEntries(reports, getStudent, {
      educatorId,
      startDate,
      endDate,
    })
  }, [reports, getStudent, educatorId, startDate, endDate])

  const handleSelectEducator = (id) => {
    setEducatorId(id)
    // 담당업무 기본값은 선택 강사의 담당 분야 — 이후 자유 수정
    setDuty(educators?.find((e) => e.id === id)?.subject ?? '')
  }

  const fieldClass =
    'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-full'

  const managerName = selectedEducator?.name ?? ''
  const periodText = `${formatKoreanDate(startDate)} ~ ${formatKoreanDate(endDate)}`
  const canBuild = !!educatorId && entries.length > 0

  return (
    <ModalShell title="월간 수업 보고서" onClose={onClose}>
      {educators && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">담당자(강사)</label>
          <select
            value={educatorId}
            onChange={(e) => handleSelectEducator(e.target.value)}
            className={fieldClass}
          >
            <option value="">강사를 선택하세요</option>
            {educators.map((e) => (
              <option key={e.id} value={e.id}>
                {educatorDisplayName(e)}
              </option>
            ))}
          </select>
        </div>
      )}
      {fixedEducator && (
        <p className="text-sm text-gray-600">
          담당자: <span className="font-semibold text-gray-900">{fixedEducator.name}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setDatesTouched(true); setStartDate(e.target.value) }}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setDatesTouched(true); setEndDate(e.target.value) }}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">담당업무</label>
        <input
          type="text"
          value={duty}
          onChange={(e) => setDuty(e.target.value)}
          placeholder="예: 수학"
          className={fieldClass}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">업무일정</label>
        <input
          type="text"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          className={fieldClass}
        />
      </div>

      {educatorId && (
        <div className="text-sm">
          <span className={entries.length === 0 ? 'text-gray-400' : 'text-gray-600'}>
            해당 기간 수업보고 <span className="font-bold">{totalCount}</span>건
            {entries.length === 0 && ' — 출력할 기록이 없습니다.'}
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <DownloadPdfButton
          label="보고서 PDF"
          disabled={!canBuild}
          buildDocument={async () => {
            const { default: MonthlyLessonReport } = await import(
              '../../pdf/reports/MonthlyLessonReport.jsx'
            )
            const { buildFilename } = await import('../../pdf/utils/formatters.js')
            return {
              element: (
                <MonthlyLessonReport
                  header={{ managerName, periodText, duty, schedule, totalCount }}
                  entries={entries}
                />
              ),
              filename: buildFilename('수업보고서', `${managerName}_${startDate.slice(0, 7)}`),
            }
          }}
        />
      </div>
    </ModalShell>
  )
}
