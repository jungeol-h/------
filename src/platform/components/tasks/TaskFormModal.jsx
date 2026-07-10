import { useState } from 'react'
import { X, CheckCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import StudentCombobox from '../counseling/StudentCombobox.jsx'

// 과제 부여 모달 — 교과강사/컨설턴트/매니저/관리자가 학생에게 과제를 배정한다.
// fixedStudent가 있으면 해당 학생 고정(학생상세), 없으면 students 목록에서 선택.
// task가 있으면 수정 모드 — 학생 고정·필드 프리필 후 updateTask 호출.
export default function TaskFormModal({ students = [], fixedStudent, task, onClose, onSaved }) {
  const { addTask, updateTask, data } = useData()
  const { currentUser } = useAuth()
  const isEdit = !!task
  const lockedStudent = isEdit ? data.students.find((s) => s.id === task.studentId) : fixedStudent

  const [studentId, setStudentId] = useState(task?.studentId ?? fixedStudent?.id ?? '')
  const [title, setTitle] = useState(task?.title ?? '')
  const [subject, setSubject] = useState(task?.subject ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [dueTime, setDueTime] = useState(task?.dueTime && task.dueTime !== '23:59' ? task.dueTime : '')
  const [method, setMethod] = useState(task?.method ?? '')
  const [content, setContent] = useState(task?.content ?? '')
  const [saving, setSaving] = useState(false)

  const fieldClass = 'w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

  const canSave = !saving && title.trim() && studentId && dueDate

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      if (isEdit) {
        await updateTask(task.id, { title, subject, dueDate, dueTime: dueTime || '23:59', method, content })
      } else {
        await addTask({
          studentId,
          title,
          subject,
          dueDate,
          dueTime: dueTime || '23:59',
          assignerId: currentUser?.id,
          assignerName: currentUser?.name,
          method,
          content,
        })
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
          <StudentCombobox
            students={students}
            value={studentId}
            onChange={setStudentId}
            placeholder="학생 검색..."
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
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
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
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
