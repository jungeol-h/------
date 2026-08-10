import { useState, useCallback, useMemo } from 'react'
import { CheckCheck, Pencil, Trash2, Siren, Printer, X } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  COUNSELING_TYPES, COUNSELING_TYPE_LABELS,
  COUNSELING_TARGET_TYPES, COUNSELING_TARGET_LABELS,
  composeCounselingContent,
} from '../../data/counselingTypes.js'
import { hasMultipleDuties } from '../../data/educatorDuties.js'
import { educatorDisplayName } from '../../utils/educatorName.js'
import StudentCombobox from '../common/StudentCombobox.jsx'
import MultiStudentSelect from '../common/MultiStudentSelect.jsx'
import TimeField from '../common/TimeField.jsx'
import CounselingFormModal, { COUNSELING_MAX_STUDENTS } from './CounselingFormModal.jsx'
import CounselingContentFields from './CounselingContentFields.jsx'
import CounselingRecordBody from './CounselingRecordBody.jsx'
import DutyTypeBadge from './DutyTypeBadge.jsx'
import UrgentReportModal from './UrgentReportModal.jsx'
import MonthlyReportModal from './MonthlyReportModal.jsx'
import { AttachmentField, AttachmentChips } from './AttachmentField.jsx'
import { uploadCounselingPdfs, removeCounselingFiles, filterUnreferencedPaths } from '../../lib/counselingFiles.js'
import { todayStr } from '../../utils/dateUtils.js'

const EMPTY_FIELDS = { topic: '', diagnosis: '', advice: '', followUp: '', note: '', nextAppointment: '' }

// 매니저/관리자 상담 탭 공용 본문.
// 상단에 인라인 작성 폼(버튼→모달 없이 바로 입력, 학생 다중 선택 시 학생별
// 기록 fan-out — 첨부 실파일은 공유), 아래에 기존 상담 리스트.
// 두 역할의 차이는 props로만 분기: 작성 대상(students)·노출 기록(records)·작성자 표시(showAuthor).
// readOnly=true면 작성 폼과 카드 수정/삭제 버튼을 숨긴다(열람 전용 역할).
export default function CounselingTabContent({ students, records, showAuthor = false, authorId, readOnly = false }) {
  const { addCounselingRecord, deleteCounselingRecord, data } = useData()
  const { currentUser } = useAuth()
  const [studentIds, setStudentIds] = useState([]) // 다중 선택 — 학생별 기록 fan-out
  // 복수 담당업무 작성자는 유형 기본값 없이 명시적 선택을 강제한다 (보고서 오분류 방지)
  const multiDuty = hasMultipleDuties(authorId)
  const [type, setType] = useState(multiDuty ? '' : COUNSELING_TYPES[0])
  const [targetType, setTargetType] = useState('student')
  const [date, setDate] = useState(todayStr())
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [attachFiles, setAttachFiles] = useState([]) // 업로드 대기 PDF File[]
  const [saving, setSaving] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [showUrgent, setShowUrgent] = useState(false)
  const [showMonthlyReport, setShowMonthlyReport] = useState(false)

  // ── 상담 기록 검색 필터 (강사·학생·기간) ──
  const [filterEducatorId, setFilterEducatorId] = useState('')
  const [filterStudentId, setFilterStudentId] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // 필터 옵션은 실제 기록에 등장하는 강사·학생에서만 파생 (빈 결과가 나올 옵션 배제)
  const filterEducators = useMemo(() => {
    const ids = new Set(records.map((r) => r.educatorId))
    return data.educators
      .filter((e) => ids.has(e.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
  }, [records, data.educators])

  const filterStudents = useMemo(() => {
    const ids = new Set(records.map((r) => r.studentId))
    return data.students
      .filter((s) => ids.has(s.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
  }, [records, data.students])

  const filteredRecords = useMemo(
    () => records.filter((r) =>
      (!filterEducatorId || r.educatorId === filterEducatorId) &&
      (!filterStudentId || r.studentId === filterStudentId) &&
      (!filterFrom || r.date >= filterFrom) &&
      (!filterTo || r.date <= filterTo)
    ),
    [records, filterEducatorId, filterStudentId, filterFrom, filterTo]
  )

  const hasFilter = Boolean(filterEducatorId || filterStudentId || filterFrom || filterTo)
  const resetFilter = () => {
    setFilterEducatorId('')
    setFilterStudentId('')
    setFilterFrom('')
    setFilterTo('')
  }

  // 월간 보고서 — 누적횟수(N회차)가 화면 필터와 무관하게 전체 이력 기준이어야
  // 하므로 props의 records가 아니라 data.counselingRecords 전량을 넘긴다.
  const isReportPicker = currentUser?.role === 'admin' || currentUser?.role === 'viewer'
  const loadMonthlyRecords = useCallback(async () => {
    const studentById = new Map(data.students.map((s) => [s.id, s]))
    return {
      records: data.counselingRecords.map((r) => ({ ...r, fallbackContent: r.comment })),
      getStudent: (id) => studentById.get(id),
    }
  }, [data.counselingRecords, data.students])

  // 긴급 보고는 관리자에게 보내는 것 — 관리자 본인·열람 전용 역할에는 숨김
  const canUrgentReport = !readOnly && currentUser?.role !== 'admin'

  // 예약(지정예약) 유래 기록은 여기서 수정·삭제 불가 — 원본이 booking_records라
  // counseling CRUD로 건드리면 로컬만 바뀌고 DB에 남는 유령이 된다.
  const canManage = (r) =>
    !readOnly && !r.source &&
    (r.educatorId === currentUser?.id || currentUser?.role === 'admin')

  const handleDelete = async (record) => {
    if (!window.confirm('이 상담 기록을 삭제할까요?')) return
    try {
      await deleteCounselingRecord(record.id)
      // 실파일 정리 (best-effort) — fan-out 형제 기록이 참조하는 path는 남긴다
      removeCounselingFiles(filterUnreferencedPaths(
        record.attachments?.map((a) => a.path), data.counselingRecords, record.id
      ))
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const fieldClass =
    'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'

  const canSave = !saving && fields.topic.trim() && studentIds.length > 0 && type

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const content = composeCounselingContent(fields)
      const attachments = attachFiles.length > 0 ? await uploadCounselingPdfs(attachFiles, authorId) : []
      // 학생별 fan-out — 첨부 실파일은 한 벌만 업로드하고 메타를 공유한다.
      let savedCount = 0
      try {
        for (const sid of studentIds) {
          await addCounselingRecord({ studentId: sid, authorId, content, type, targetType, fields, attachments, startTime, endTime, date })
          savedCount += 1
        }
      } catch (err) {
        if (savedCount > 0) {
          alert(`오류로 ${studentIds.length}명 중 ${savedCount}명까지만 저장됐습니다. 목록을 확인한 뒤 나머지 학생만 다시 작성해주세요.`)
        }
        throw err
      }
      // 성공 시 폼 초기화(학생/유형은 연속 작성 편의를 위해 유지하지 않고 비움).
      setStudentIds([])
      setType(multiDuty ? '' : COUNSELING_TYPES[0])
      setTargetType('student')
      setDate(todayStr())
      setStartTime('')
      setEndTime('')
      setFields(EMPTY_FIELDS)
      setAttachFiles([])
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-6 space-y-6">
      {/* ── 새 상담 작성 ── */}
      {canUrgentReport && (
        <button
          type="button"
          onClick={() => setShowUrgent(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 active:scale-[0.99] transition"
        >
          <Siren size={15} />
          긴급 보고 · 건의
        </button>
      )}

      {!readOnly && (
      <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">새 상담 기록</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MultiStudentSelect
            students={students}
            value={studentIds}
            onChange={setStudentIds}
            max={COUNSELING_MAX_STUDENTS}
            label="피상담 학생"
            placeholder="학생 검색해서 추가..."
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">상담 대상</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className={`${fieldClass} w-full`}
              >
                {COUNSELING_TARGET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {COUNSELING_TARGET_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">상담 유형</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`${fieldClass} w-full`}
              >
                {multiDuty && <option value="" disabled>유형을 선택하세요</option>}
                {COUNSELING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {COUNSELING_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <DutyTypeBadge educatorId={authorId} type={type} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">상담일</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${fieldClass} w-full`}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">시작시간</label>
            <TimeField
              value={startTime}
              onChange={setStartTime}
              className={`${fieldClass} w-full`}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">종료시간</label>
            <TimeField
              value={endTime}
              onChange={setEndTime}
              className={`${fieldClass} w-full`}
            />
          </div>
        </div>

        <CounselingContentFields value={fields} onChange={setFields} fieldClass={fieldClass} />

        <AttachmentField pending={attachFiles} onChangePending={setAttachFiles} />

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="py-2.5 px-6 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={16} />
            {studentIds.length > 1 ? `${studentIds.length}명 기록 저장` : '저장'}
          </button>
        </div>
      </section>
      )}

      {/* ── 기존 상담 리스트 ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">
            상담 기록
            <span className="ml-1.5 text-sm font-semibold text-gray-400">
              {hasFilter ? `${filteredRecords.length}건 / 전체 ${records.length}건` : `${records.length}건`}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setShowMonthlyReport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 active:scale-95 transition"
          >
            <Printer size={14} />
            월간 보고서
          </button>
        </div>

        {/* 검색 필터 — 강사·학생·기간 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">강사 (작성자)</label>
              <select
                value={filterEducatorId}
                onChange={(e) => setFilterEducatorId(e.target.value)}
                className={`${fieldClass} w-full`}
              >
                <option value="">전체 강사</option>
                {filterEducators.map((e) => (
                  <option key={e.id} value={e.id}>{educatorDisplayName(e)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">학생</label>
              <StudentCombobox
                students={filterStudents}
                value={filterStudentId}
                onChange={setFilterStudentId}
                placeholder="학생 검색..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">시작일</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className={`${fieldClass} w-full`}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">종료일</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className={`${fieldClass} w-full`}
              />
            </div>
            {hasFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="col-span-2 sm:col-span-1 h-[42px] px-4 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold flex items-center justify-center gap-1 hover:bg-gray-200"
              >
                <X size={14} />
                초기화
              </button>
            )}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            {hasFilter ? '조건에 맞는 상담 기록이 없어요 🔍' : '상담 기록이 없어요 💬'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((r) => {
              const student = data.students.find((s) => s.id === r.studentId)
              const author = data.educators.find((e) => e.id === r.educatorId)
              return (
                <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{student?.name || '학생'}</span>
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                        {COUNSELING_TYPE_LABELS[r.type] || r.type}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {COUNSELING_TARGET_LABELS[r.targetType] ?? '학생'}
                      </span>
                      {r.source === 'booking' && (
                        <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">
                          예약 상담
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {r.date}
                        {r.startTime && ` ${r.startTime}~${r.endTime || ''}`}
                      </span>
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
                            onClick={() => handleDelete(r)}
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
                  <AttachmentChips attachments={r.attachments} />
                  {showAuthor && author && (
                    <p className="text-xs text-gray-400 mt-2">작성: {educatorDisplayName(author)}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {editRecord && (
        <CounselingFormModal
          record={editRecord}
          authorId={authorId}
          onClose={() => setEditRecord(null)}
        />
      )}

      {showUrgent && <UrgentReportModal onClose={() => setShowUrgent(false)} />}

      {showMonthlyReport && (
        <MonthlyReportModal
          educators={
            isReportPicker
              ? data.educators.filter((e) =>
                  ['admin', 'manager', 'instructor', 'consultant'].includes(e.role),
                )
              : null
          }
          fixedEducator={
            // 스테일 localStorage 세션에는 subject/workSchedule이 없을 수 있어 fetch본 우선
            isReportPicker ? null : data.educators.find((e) => e.id === currentUser?.id) ?? currentUser
          }
          loadRecords={loadMonthlyRecords}
          reportLabel="컨설팅보고서"
          onClose={() => setShowMonthlyReport(false)}
        />
      )}
    </div>
  )
}
