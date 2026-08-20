import { useEffect, useMemo, useState } from 'react'
import { Loader, AlertCircle, FileSpreadsheet } from 'lucide-react'
import ModalShell from '../common/ModalShell.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { educatorDisplayName } from '../../utils/educatorName.js'
import { COUNSELING_TYPES, COUNSELING_TYPE_LABELS } from '../../data/counselingTypes.js'
import { EDUCATOR_DUTIES } from '../../data/educatorDuties.js'
import {
  currentMonthRange,
  monthRangeOf,
  formatKoreanDate,
  buildMonthlyCounselingEntries,
} from '../../context/selectors/monthlyCounselingReport.js'

const DEFAULT_SCHEDULE = '매주 토요일 12:00~19:00'

// 담당업무(유형)별 보고서 분리 시 구 체계(counselingTypes.js 표시 전용 키)로 저장된
// 기존 기록도 함께 잡히도록 하는 별칭 — 예: '진로진학' 선택 시 구 '진로' 기록 포함.
// assessment(검사 결과 분석 상담)는 진로진학 duty/유형 필터 선택 시 함께 잡히도록
// career_path 별칭에 포함 — 2026-08-20 클라 확인 요청 기반(황광희 진로진학 컨설팅 집계 정합).
const LEGACY_TYPE_ALIASES = {
  career_path: ['career', 'assessment'],
  subject_learning: ['study'],
  adjustment: ['habit'],
}

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
  // 강사 셀렉트 값 — 복수 담당업무 강사(educatorDuties)는 업무별 항목으로 나뉘어
  // 'id::dutyKey' 형태가 된다 (예: 황광희(국어) / 황광희(진로진학컨설팅)).
  const [educatorPick, setEducatorPick] = useState(fixedEducator?.id ?? '')
  const [educatorId, dutyKey] = educatorPick.split('::')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [datesTouched, setDatesTouched] = useState(false) // 사용자가 기간을 직접 수정했는가
  const [filterType, setFilterType] = useState('') // '' = 전체 — 담당업무별 보고서 분리용
  const [duty, setDuty] = useState(fixedEducator?.subject ?? '')
  const [schedule, setSchedule] = useState(fixedEducator?.workSchedule || DEFAULT_SCHEDULE)

  // 유형 필터 확장(구 체계 별칭 포함). null이면 전체.
  const selectedTypes = useMemo(
    () => (filterType ? [filterType, ...(LEGACY_TYPE_ALIASES[filterType] ?? [])] : null),
    [filterType],
  )

  const [loaded, setLoaded] = useState(null) // { records, getStudent }
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [excelBusy, setExcelBusy] = useState(false)

  const selectedEducator =
    fixedEducator ?? educators?.find((e) => e.id === educatorId) ?? null
  const selectedDuty =
    EDUCATOR_DUTIES[educatorId]?.find((d) => d.key === dutyKey) ?? null

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

  // 월초에 열면 기본 기간(이번 달)이 0건인 사고 방지 — 사용자가 기간을 손대기 전이고
  // 현재 기간에 기록이 없으면, 선택 강사의 최근 기록이 있는 달로 기간을 자동 이동한다.
  // 이동 후에는 기간 내 기록이 생겨 조건이 거짓이 되므로 재실행돼도 무한 루프가 없다.
  useEffect(() => {
    if (datesTouched || !loaded || !educatorId) return
    const mine = loaded.records.filter(
      (r) => r.educatorId === educatorId && r.date &&
        (!selectedTypes || selectedTypes.includes(r.type)),
    )
    if (mine.length === 0) return
    if (mine.some((r) => r.date >= startDate && r.date <= endDate)) return
    const latest = mine.reduce((acc, r) => (r.date > acc ? r.date : acc), mine[0].date)
    const range = monthRangeOf(latest)
    if (!range) return
    setStartDate(range[0])
    setEndDate(range[1])
  }, [datesTouched, loaded, educatorId, startDate, endDate, selectedTypes])

  const { entries, totalCount, totalMinutes, totalUnits } = useMemo(() => {
    if (!loaded || !educatorId || !startDate || !endDate) {
      return { entries: [], totalCount: 0, totalMinutes: 0, totalUnits: 0 }
    }
    return buildMonthlyCounselingEntries(loaded.records, loaded.getStudent, {
      educatorId,
      startDate,
      endDate,
      types: selectedTypes,
    })
  }, [loaded, educatorId, startDate, endDate, selectedTypes])

  const handleSelectEducator = (value) => {
    setEducatorPick(value)
    const [id, pickedKey] = value.split('::')
    const educator = educators?.find((e) => e.id === id)
    const pickedDuty = EDUCATOR_DUTIES[id]?.find((d) => d.key === pickedKey)
    if (pickedDuty) {
      // 업무별 항목 선택 → 유형 필터·담당업무 헤더 자동 적용
      setFilterType(pickedDuty.type)
      setDuty(pickedDuty.reportDuty)
    } else {
      // 담당업무 기본값: 유형 선택 시 유형 라벨, 아니면 선택 강사의 담당 분야 — 이후 자유 수정
      setDuty(
        filterType
          ? `${COUNSELING_TYPE_LABELS[filterType]} 컨설팅`
          : educator?.subject ?? '',
      )
    }
    setSchedule(educator?.workSchedule || DEFAULT_SCHEDULE)
  }

  const handleSelectType = (value) => {
    setFilterType(value)
    const matchedDuty = EDUCATOR_DUTIES[educatorId]?.find((d) => d.type === value)
    setDuty(
      matchedDuty
        ? matchedDuty.reportDuty
        : value
          ? `${COUNSELING_TYPE_LABELS[value]} 컨설팅`
          : selectedEducator?.subject ?? '',
    )
  }

  const fieldClass =
    'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-full'

  const managerName = selectedEducator?.name ?? ''
  const periodText = `${formatKoreanDate(startDate)} ~ ${formatKoreanDate(endDate)}`
  const canBuild = !!educatorId && !loading && !loadError && entries.length > 0

  // PDF/엑셀 파일명 공용 식별자 조각 — buildFilename이 .pdf를 붙이므로 엑셀은 라벨만 재사용해 직접 조립.
  const filenameIdentifier = [
    managerName,
    selectedDuty && filterType === selectedDuty.type
      ? selectedDuty.label
      : filterType && COUNSELING_TYPE_LABELS[filterType],
    startDate.slice(0, 7),
  ]
    .filter(Boolean)
    .join('_')

  const handleExcelDownload = async () => {
    if (excelBusy || !canBuild) return
    setExcelBusy(true)
    try {
      const { downloadCounselingReportExcel } = await import(
        '../../utils/counselingReportExcel.js'
      )
      const { buildFilename } = await import('../../pdf/utils/formatters.js')
      const pdfFilename = buildFilename(reportLabel, filenameIdentifier)
      const filename = pdfFilename.replace(/\.pdf$/, '.xlsx')
      await downloadCounselingReportExcel({
        header: { managerName, periodText, duty, schedule, totalUnits, totalMinutes },
        entries,
        filename,
      })
    } finally {
      setExcelBusy(false)
    }
  }

  return (
    <ModalShell title="월간 컨설팅 보고서" onClose={onClose}>
      {educators && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">담당자(강사)</label>
          <select
            value={educatorPick}
            onChange={(e) => handleSelectEducator(e.target.value)}
            className={fieldClass}
          >
            <option value="">강사를 선택하세요</option>
            {educators.flatMap((e) => {
              const duties = EDUCATOR_DUTIES[e.id]
              if (!duties?.length) {
                return (
                  <option key={e.id} value={e.id}>
                    {educatorDisplayName(e)}
                  </option>
                )
              }
              // 복수 담당업무 강사는 업무별 항목으로 분리 노출 (계정은 하나)
              return duties.map((d) => (
                <option key={`${e.id}::${d.key}`} value={`${e.id}::${d.key}`}>
                  {`${e.name}(${d.label})`}
                </option>
              ))
            })}
          </select>
        </div>
      )}
      {fixedEducator && (
        <p className="text-sm text-gray-600">
          담당자: <span className="font-semibold text-gray-900">{fixedEducator.name}</span>
        </p>
      )}

      <div>
        <label className="text-xs text-gray-500 mb-1 block">담당업무(상담유형)</label>
        <select
          value={filterType}
          onChange={(e) => handleSelectType(e.target.value)}
          className={fieldClass}
        >
          <option value="">전체 유형</option>
          {COUNSELING_TYPES.map((t) => (
            <option key={t} value={t}>
              {COUNSELING_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

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

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleExcelDownload}
          disabled={!canBuild || excelBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {excelBusy ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={14} />
          )}
          {excelBusy ? '생성 중…' : '엑셀(A4)'}
        </button>
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
                  header={{ managerName, periodText, duty, schedule, totalUnits, totalMinutes }}
                  entries={entries}
                />
              ),
              filename: buildFilename(reportLabel, filenameIdentifier),
            }
          }}
        />
      </div>
    </ModalShell>
  )
}
