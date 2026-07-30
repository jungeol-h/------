import { useState } from 'react'
import { X, CheckCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import MultiStudentSelect from '../common/MultiStudentSelect.jsx'
import TimeField from '../common/TimeField.jsx'
import { AttachmentField } from '../counseling/AttachmentField.jsx'
import {
  uploadTaskFiles, removeTaskFiles, validateTaskFile,
  MAX_TASK_FILES, MAX_TASK_FILE_MB,
} from '../../lib/taskFiles.js'

// 과제 부여 모달 — 교과강사/컨설턴트/매니저/관리자가 학생에게 과제를 배정한다.
// fixedStudent가 있으면 해당 학생 고정(학생상세), 없으면 students 목록에서
// 다중 선택 — 같은 과제가 선택한 학생 수만큼 개별 생성된다(일괄 부여).
// task가 있으면 수정 모드 — 학생 고정·필드 프리필 후 updateTask 호출.
export default function TaskFormModal({ students = [], fixedStudent, task, onClose, onSaved }) {
  const { addTasks, updateTask, data } = useData()
  const { currentUser } = useAuth()
  const isEdit = !!task
  const lockedStudent = isEdit ? data.students.find((s) => s.id === task.studentId) : fixedStudent

  const [studentIds, setStudentIds] = useState(() =>
    task?.studentId ? [task.studentId] : fixedStudent?.id ? [fixedStudent.id] : []
  )
  const [title, setTitle] = useState(task?.title ?? '')
  const [subject, setSubject] = useState(task?.subject ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [dueTime, setDueTime] = useState(task?.dueTime && task.dueTime !== '23:59' ? task.dueTime : '')
  const [method, setMethod] = useState(task?.method ?? '')
  const [content, setContent] = useState(task?.content ?? '')
  const [existingAttachments, setExistingAttachments] = useState(task?.attachments ?? [])
  const [attachFiles, setAttachFiles] = useState([]) // 업로드 대기 File[]
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total } — 대용량 업로드 체감용

  const fieldClass = 'w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

  const canSave = !saving && title.trim() && studentIds.length > 0 && dueDate

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const uploaded = attachFiles.length > 0
        ? await uploadTaskFiles(attachFiles, currentUser?.id, (done, total) => setProgress({ done, total }))
        : []
      const attachments = [...existingAttachments, ...uploaded]
      if (isEdit) {
        await updateTask(task.id, { title, subject, dueDate, dueTime: dueTime || '23:59', method, content, attachments })
        // 수정에서 제거된 첨부의 실파일 정리 (best-effort).
        // 일괄 부여로 만들어진 형제 과제가 같은 실파일을 참조하므로,
        // 다른 과제가 아직 참조하는 경로는 지우지 않는다.
        const keptPaths = new Set(existingAttachments.map((a) => a.path))
        const removed = (task.attachments ?? [])
          .filter((a) => !keptPaths.has(a.path))
          .map((a) => a.path)
          .filter((path) => !data.tasks.some(
            (t) => t.id !== task.id && (t.attachments ?? []).some((a) => a.path === path)
          ))
        removeTaskFiles(removed)
      } else {
        // 첨부 실파일은 한 벌만 업로드하고 전 학생의 과제가 메타로 공유한다.
        await addTasks({
          studentIds,
          title,
          subject,
          dueDate,
          dueTime: dueTime || '23:59',
          assignerId: currentUser?.id,
          assignerName: currentUser?.name,
          method,
          content,
          attachments,
        })
      }
      onSaved?.()
      onClose()
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">{isEdit ? '과제 수정' : '과제 부여'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {lockedStudent ? (
          <div className="rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">
            {lockedStudent.name} 학생
          </div>
        ) : (
          <MultiStudentSelect
            students={students}
            value={studentIds}
            onChange={setStudentIds}
            label="대상 학생"
            placeholder="학생 검색해서 추가..."
          />
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="과제 제목 (필수)"
          className={fieldClass}
        />

        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="과목"
          className={fieldClass}
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="과제 내용 (선택)"
          rows={3}
          className={`${fieldClass} resize-none`}
        />

        <input
          type="text"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          placeholder="수행방법 (선택) — 예: 노트에 풀고 사진 제출"
          className={fieldClass}
        />

        <AttachmentField
          existing={existingAttachments}
          onRemoveExisting={(path) => setExistingAttachments((prev) => prev.filter((a) => a.path !== path))}
          pending={attachFiles}
          onChangePending={setAttachFiles}
          accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          validate={validateTaskFile}
          kindLabel="이미지·PDF"
          maxCount={MAX_TASK_FILES}
          maxMb={MAX_TASK_FILE_MB}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">마감일</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">마감시간 (선택)</label>
            <TimeField
              value={dueTime}
              onChange={setDueTime}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={16} />
            {saving
              ? progress && progress.total > 1 ? `업로드 중... ${progress.done}/${progress.total}` : '저장 중...'
              : !isEdit && studentIds.length > 1 ? `${studentIds.length}명에게 부여` : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
