import { useEffect, useMemo, useState } from 'react'
import { Loader, AlertCircle } from 'lucide-react'
import ModalShell from '../common/ModalShell.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { educatorDisplayName } from '../../utils/educatorName.js'
import {
  currentMonthRange,
  formatKoreanDate,
  buildMonthlyCounselingEntries,
} from '../../context/selectors/monthlyCounselingReport.js'

const DEFAULT_SCHEDULE = '매주 토요일 12:00~19:00'

// 강사별 월간 컨설팅 보고서 출력 옵션 모달 — 재원생/외부 상담 공용.
// 기간·담당업무·업무일정을 입력받아 MonthlyCounselingReport PDF를 생성한다.
// props:
//   educators: [{id, name, subject}] — 강사 선택 셀렉트(admin/viewer용). fixedEducator와 택일
//   fixedEducator: {id, name, subject} — 본인 고정(강사/컨설턴트/매니저)
//   loadRecords: async (educatorId) => ({ records, getStudent })
//     records는 강사 무관 전체 이력 정규화본({educatorId, date, startTime?, …, fallbackContent})
//   reportLabel: 파일명용 리포트 이름 (예: '컨설팅보고서', '외부컨설팅보고서')
//   onClose
export default function MonthlyReportModal({
  educators = null,
  fixedEducator = null,
  loadRecords,
  reportLabel = '컨설팅보고서',
  onClose,
}) {
  const [defaultStart, defaultEnd] = useMemo(() => currentMonthRange(), [])
  const [educatorId, setEducatorId] = useState(fixedEducator?.id ?? '')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [duty, setDuty] = useState(fixedEducator?.subject ?? '')
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)

  const [loaded, setLoaded] = useState(null) // { records, getStudent }
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const selectedEducator =
    fixedEducator ?? educators?.find((e) => e.id === educatorId) ?? null

  useEffect(() => {
    if (!educatorId) return
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setLoaded(null)
    loadRecords(educatorId)
      .then((result) => {
        if (!cancelled) setLoaded(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [educatorId, loadRecords, retryKey])

  const { entries, totalCount } = useMemo(() => {
    if (!loaded || !educatorId || !startDate || !endDate) return { entries: [], totalCount: 0 }
    return buildMonthlyCounselingEntries(loaded.records, loaded.getStudent, {
      educatorId,
      startDate,
      endDate,
    })
  }, [loaded, educatorId, startDate, endDate])

  const handleSelectEducator = (id) => {
    setEducatorId(id)
    // 담당업무 기본값은 선택 강사의 담당 분야 — 이후 자유 수정
    setDuty(educators?.find((e) => e.id === id)?.subject ?? '')
  }

  const fieldClass =
    'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-full'

  const managerName = selectedEducator?.name ?? ''
  const periodText = `${formatKoreanDate(startDate)} ~ ${formatKoreanDate(endDate)}`
  const canBuild = !!educatorId && !loading && !loadError && entries.length > 0

  return (
    <ModalShell title="월간 컨설팅 보고서" onClose={onClose}>
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
            onChange={(e) => setStartDate(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
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
          placeholder="예: 진로진학 컨설팅"
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
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <Loader size={14} className="animate-spin" /> 상담 기록 불러오는 중...
            </span>
          ) : loadError ? (
            <span className="inline-flex items-center gap-1.5 text-red-500">
              <AlertCircle size={14} /> 불러오지 못했습니다.
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="text-blue-600 font-semibold"
              >
                다시 시도
              </button>
            </span>
          ) : (
            <span className={entries.length === 0 ? 'text-gray-400' : 'text-gray-600'}>
              해당 기간 상담 <span className="font-bold">{totalCount}</span>건
              {entries.length === 0 && ' — 출력할 기록이 없습니다.'}
            </span>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <DownloadPdfButton
          label="보고서 PDF"
          disabled={!canBuild}
          buildDocument={async () => {
            const { default: MonthlyCounselingReport } = await import(
              '../../pdf/reports/MonthlyCounselingReport.jsx'
            )
            const { buildFilename } = await import('../../pdf/utils/formatters.js')
            return {
              element: (
                <MonthlyCounselingReport
                  header={{ managerName, periodText, duty, schedule, totalCount }}
                  entries={entries}
                />
              ),
              filename: buildFilename(reportLabel, `${managerName}_${startDate.slice(0, 7)}`),
            }
          }}
        />
      </div>
    </ModalShell>
  )
}
