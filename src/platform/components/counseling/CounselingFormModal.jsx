import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import ModalShell from '../common/ModalShell.jsx'
import {
  COUNSELING_TYPES, COUNSELING_TYPE_LABELS,
  COUNSELING_TARGET_TYPES, COUNSELING_TARGET_LABELS,
  composeCounselingContent, hasStructuredContent,
} from '../../data/counselingTypes.js'
import { hasMultipleDuties } from '../../data/educatorDuties.js'
import CounselingContentFields from './CounselingContentFields.jsx'
import DutyTypeBadge from './DutyTypeBadge.jsx'
import { AttachmentField } from './AttachmentField.jsx'
import { uploadCounselingPdfs, removeCounselingFiles, filterUnreferencedPaths } from '../../lib/counselingFiles.js'
import MultiStudentSelect from '../common/MultiStudentSelect.jsx'
import TimeField from '../common/TimeField.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { findBookingDuplicates, confirmBookingDuplicate } from '../../utils/counselingDup.js'
import { findCounselingGroupSiblings } from '../../context/selectors/counselingGroup.js'

// 상담 작성 모달 — 매니저/관리자/학생상세에서 재사용. 코칭 모달(ManagerHomeTab) 패턴 차용.
// fixedStudent가 있으면 해당 학생 고정, 없으면 students 목록에서 다중 선택(최대 10명, 지정예약과 동일) —
// 같은 내용의 상담기록이 학생별로 각각 생성된다(fan-out, 첨부 실파일은 공유).
// record가 있으면 수정 모드 — 학생 고정·내용/type 프리필 후 updateCounselingRecord 호출.
// 구 기록(단일 comment) 수정 시엔 comment를 진단 칸에 프리필한다.
// 같은 내용으로 fan-out된 형제 기록이 있으면 그룹 전체/이 학생만 범위를 고를 수 있다(기본 그룹 전체).
// 한 학생만 고치면 내용이 달라져 그룹에서 자연히 빠진다.
export const COUNSELING_MAX_STUDENTS = 10

export default function CounselingFormModal({ students = [], fixedStudent, record, authorId, onClose, onSaved }) {
  const { addCounselingRecord, updateCounselingRecord, data } = useData()
  const isEdit = !!record
  const editStudent = isEdit ? data.students.find((s) => s.id === record.studentId) : null
  // 모달을 연 시점의 형제로 고정 — 저장 도중 로컬 동기화로 목록이 바뀌어도 대상이 흔들리지 않게 한다
  const [siblings] = useState(() => (isEdit ? findCounselingGroupSiblings(record, data.counselingRecords) : []))
  const [editScope, setEditScope] = useState('group') // 'group' | 'single'
  const groupEdit = siblings.length > 0 && editScope === 'group'
  const groupSize = siblings.length + 1
  const groupNames = [record?.studentId, ...siblings.map((r) => r.studentId)]
    .map((id) => data.students.find((s) => s.id === id)?.name ?? '학생')
    .join(', ')
  const [studentIds, setStudentIds] = useState(() =>
    record?.studentId ? [record.studentId] : fixedStudent?.id ? [fixedStudent.id] : []
  )
  // 복수 담당업무 작성자는 신규 작성 시 유형 기본값 없이 명시적 선택을 강제한다 (보고서 오분류 방지)
  const multiDuty = hasMultipleDuties(authorId)
  const [type, setType] = useState(record?.type ?? (multiDuty ? '' : COUNSELING_TYPES[0]))
  const [targetType, setTargetType] = useState(record?.targetType ?? 'student')
  const [date, setDate] = useState(record?.date ?? todayStr())
  const [startTime, setStartTime] = useState(record?.startTime ?? '')
  const [endTime, setEndTime] = useState(record?.endTime ?? '')
  const [fields, setFields] = useState({
    topic: record?.topic ?? '',
    diagnosis: record ? (hasStructuredContent(record) ? record.diagnosis : record.comment ?? '') : '',
    advice: record?.advice ?? '',
    followUp: record?.followUp ?? '',
    note: record?.note ?? '',
    nextAppointment: record?.nextAppointment ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [existingAttachments, setExistingAttachments] = useState(record?.attachments ?? [])
  const [attachFiles, setAttachFiles] = useState([]) // 업로드 대기 PDF File[]

  const fieldClass = 'w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

  const handleSave = async () => {
    // 신규 작성만: 예약현황에서 이미 쓴 같은 날 상담이면 확인 — 취소하면 저장하지 않는다
    if (!isEdit) {
      const dupIds = findBookingDuplicates(data.counselingRecords, studentIds, authorId, date)
      if (!confirmBookingDuplicate(dupIds, (id) => data.students.find((s) => s.id === id)?.name, date)) return
    }
    setSaving(true)
    try {
      const content = composeCounselingContent(fields)
      const uploaded = attachFiles.length > 0 ? await uploadCounselingPdfs(attachFiles, authorId) : []
      const attachments = [...existingAttachments, ...uploaded]
      if (isEdit) {
        // 그룹 수정은 단일 UPDATE 문이라 일부 학생만 저장되는 상태가 생기지 않는다
        const targetIds = groupEdit ? [record.id, ...siblings.map((r) => r.id)] : [record.id]
        await updateCounselingRecord(targetIds, { content, type, targetType, fields, attachments, startTime, endTime, date })
        // 수정에서 제거된 첨부의 실파일 정리 (best-effort).
        // 이번에 수정하지 않은 기록이 같은 실파일을 참조할 수 있어 미참조 path만 지운다.
        const keptPaths = new Set(existingAttachments.map((a) => a.path))
        const removed = (record.attachments ?? []).filter((a) => !keptPaths.has(a.path)).map((a) => a.path)
        removeCounselingFiles(filterUnreferencedPaths(removed, data.counselingRecords, targetIds))
      } else {
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
      }
      onSaved?.()
      onClose()
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={isEdit ? '상담 수정' : '상담 작성'} onClose={onClose}>
        {isEdit || fixedStudent ? (
          <div className="rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">
            {(isEdit ? editStudent?.name : fixedStudent?.name) ?? '학생'} 학생
          </div>
        ) : (
          <MultiStudentSelect
            students={students}
            value={studentIds}
            onChange={setStudentIds}
            max={COUNSELING_MAX_STUDENTS}
            label="피상담 학생"
            placeholder="학생 검색해서 추가..."
          />
        )}

        {siblings.length > 0 && (
          <fieldset className="rounded-xl bg-purple-50 p-3 space-y-2 text-sm text-gray-700">
            <legend className="sr-only">수정 범위</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="counseling-edit-scope"
                checked={editScope === 'group'}
                onChange={() => setEditScope('group')}
                className="mt-0.5"
              />
              <span>그룹 전체 {groupSize}명 수정 ({groupNames})</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="counseling-edit-scope"
                checked={editScope === 'single'}
                onChange={() => setEditScope('single')}
                className="mt-0.5"
              />
              <span>이 학생만 수정 <span className="text-xs text-gray-500">— 저장하면 그룹에서 빠집니다</span></span>
            </label>
          </fieldset>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">상담 대상</label>
            <select
              value={targetType}
              onChange={e => setTargetType(e.target.value)}
              className={fieldClass}
            >
              {COUNSELING_TARGET_TYPES.map(t => (
                <option key={t} value={t}>{COUNSELING_TARGET_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">상담 유형</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className={fieldClass}
            >
              {multiDuty && <option value="" disabled>유형을 선택하세요</option>}
              {COUNSELING_TYPES.map(t => (
                <option key={t} value={t}>{COUNSELING_TYPE_LABELS[t]}</option>
              ))}
              {/* 구 체계 값으로 저장된 기록 수정 시 값 유실 방지 */}
              {isEdit && !COUNSELING_TYPES.includes(type) && (
                <option value={type}>{COUNSELING_TYPE_LABELS[type] ?? type}</option>
              )}
            </select>
            <DutyTypeBadge educatorId={authorId} type={type} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">상담일</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">시작시간</label>
            <TimeField
              value={startTime}
              onChange={setStartTime}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">종료시간</label>
            <TimeField
              value={endTime}
              onChange={setEndTime}
              className={fieldClass}
            />
          </div>
        </div>

        <CounselingContentFields value={fields} onChange={setFields} fieldClass={fieldClass} />

        <AttachmentField
          existing={existingAttachments}
          onRemoveExisting={(path) => setExistingAttachments((prev) => prev.filter((a) => a.path !== path))}
          pending={attachFiles}
          onChangePending={setAttachFiles}
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !fields.topic.trim() || studentIds.length === 0 || !type}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={16} />
            {groupEdit
              ? `${groupSize}명 모두 저장`
              : !isEdit && studentIds.length > 1 ? `${studentIds.length}명 기록 저장` : '저장'}
          </button>
        </div>
    </ModalShell>
  )
}
