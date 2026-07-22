import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import ModalShell from '../common/ModalShell.jsx'
import {
  COUNSELING_TYPES, COUNSELING_TYPE_LABELS,
  COUNSELING_TARGET_TYPES, COUNSELING_TARGET_LABELS,
  composeCounselingContent, hasStructuredContent,
} from '../../data/counselingTypes.js'
import CounselingContentFields from './CounselingContentFields.jsx'
import { AttachmentField } from './AttachmentField.jsx'
import { uploadCounselingPdfs, removeCounselingFiles } from '../../lib/counselingFiles.js'
import { todayStr } from '../../utils/dateUtils.js'

// 상담 작성 모달 — 매니저/관리자/학생상세에서 재사용. 코칭 모달(ManagerHomeTab) 패턴 차용.
// fixedStudent가 있으면 해당 학생 고정, 없으면 students 목록에서 선택.
// record가 있으면 수정 모드 — 학생 고정·내용/type 프리필 후 updateCounselingRecord 호출.
// 구 기록(단일 comment) 수정 시엔 comment를 진단 칸에 프리필한다.
export default function CounselingFormModal({ students = [], fixedStudent, record, authorId, onClose, onSaved }) {
  const { addCounselingRecord, updateCounselingRecord, data } = useData()
  const isEdit = !!record
  const editStudent = isEdit ? data.students.find((s) => s.id === record.studentId) : null
  const [studentId, setStudentId] = useState(record?.studentId ?? fixedStudent?.id ?? '')
  const [type, setType] = useState(record?.type ?? COUNSELING_TYPES[0])
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
    setSaving(true)
    try {
      const content = composeCounselingContent(fields)
      const uploaded = attachFiles.length > 0 ? await uploadCounselingPdfs(attachFiles, authorId) : []
      const attachments = [...existingAttachments, ...uploaded]
      if (isEdit) {
        await updateCounselingRecord(record.id, { content, type, targetType, fields, attachments, startTime, endTime, date })
        // 수정에서 제거된 첨부의 실파일 정리 (best-effort)
        const keptPaths = new Set(existingAttachments.map((a) => a.path))
        removeCounselingFiles((record.attachments ?? []).filter((a) => !keptPaths.has(a.path)).map((a) => a.path))
      } else {
        await addCounselingRecord({ studentId, authorId, content, type, targetType, fields, attachments, startTime, endTime, date })
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
          <select
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            className={fieldClass}
          >
            <option value="" disabled>학생 선택</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.school ?? ''} {s.grade ?? ''})
              </option>
            ))}
          </select>
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
              {COUNSELING_TYPES.map(t => (
                <option key={t} value={t}>{COUNSELING_TYPE_LABELS[t]}</option>
              ))}
              {/* 구 체계 값으로 저장된 기록 수정 시 값 유실 방지 */}
              {isEdit && !COUNSELING_TYPES.includes(type) && (
                <option value={type}>{COUNSELING_TYPE_LABELS[type] ?? type}</option>
              )}
            </select>
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
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">종료시간</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
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
            disabled={saving || !fields.topic.trim() || !studentId}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={16} />
            저장
          </button>
        </div>
    </ModalShell>
  )
}
