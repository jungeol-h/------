import { useState } from 'react'
import { CheckCheck, Pencil, Trash2, X } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { LESSON_MAX_STUDENTS } from '../../data/workRecordTypes.js'
import { educatorDisplayName } from '../../utils/educatorName.js'
import StudentCombobox from '../counseling/StudentCombobox.jsx'
import { todayStr as today } from '../../utils/dateUtils.js'


const EMPTY_FORM = () => ({
  date: today(),
  studentIds: [],
  startTime: '',
  endTime: '',
  topic: '',
  textbook: '',
  content: '',
  homework: '',
  note: '',
})

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'

// 수업보고 폼 필드 그룹 — 작성 섹션과 수정 모달이 공유.
// 참여학생은 WorkPlanFormModal의 콤보박스+칩 패턴, 최대 10명.
function LessonFields({ value, onChange, students }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })

  const addStudent = (id) => {
    if (!id || value.studentIds.includes(id)) return
    if (value.studentIds.length >= LESSON_MAX_STUDENTS) {
      alert(`참여 학생은 최대 ${LESSON_MAX_STUDENTS}명까지 선택할 수 있어요.`)
      return
    }
    onChange({ ...value, studentIds: [...value.studentIds, id] })
  }

  const removeStudent = (id) => {
    onChange({ ...value, studentIds: value.studentIds.filter((sid) => sid !== id) })
  }

  return (
    <>
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">
          참여학생 (최대 {LESSON_MAX_STUDENTS}명) · {value.studentIds.length}명 선택됨
        </label>
        <StudentCombobox students={students} value="" onChange={addStudent} placeholder="학생 검색해서 추가..." />
        {value.studentIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {value.studentIds.map((sid) => {
              const s = students.find((st) => st.id === sid)
              return (
                <span key={sid} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full pl-2.5 pr-1 py-1">
                  {s?.name ?? sid}
                  <button type="button" onClick={() => removeStudent(sid)} className="p-0.5 hover:text-blue-900" aria-label="학생 제거">
                    <X size={12} />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">날짜</label>
          <input type="date" value={value.date} onChange={set('date')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">시작시간</label>
          <input type="time" value={value.startTime} onChange={set('startTime')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">종료시간</label>
          <input type="time" value={value.endTime} onChange={set('endTime')} className={`${fieldClass} w-full`} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">수업주제</label>
          <input type="text" value={value.topic} onChange={set('topic')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">수업교재</label>
          <input type="text" value={value.textbook} onChange={set('textbook')} className={`${fieldClass} w-full`} />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">수업내용</label>
        <textarea value={value.content} onChange={set('content')} rows={3} className={`${fieldClass} w-full resize-none`} />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">과제</label>
        <textarea value={value.homework} onChange={set('homework')} rows={2} className={`${fieldClass} w-full resize-none`} />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">특이사항</label>
        <textarea value={value.note} onChange={set('note')} rows={2} className={`${fieldClass} w-full resize-none`} />
      </div>
    </>
  )
}

// 수업보고 메뉴 — 매니저·강사·컨설턴트·관리자 작성, 수정/삭제는 본인 것만(관리자는 전체).
export default function LessonReportSection({ students, readOnly = false }) {
  const { data, addLessonReport, updateLessonReport, deleteLessonReport } = useData()
  const { currentUser } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const canManage = (r) =>
    !readOnly && (r.authorId === currentUser?.id || currentUser?.role === 'admin')

  const canSave = !saving && form.date && form.topic.trim() && form.studentIds.length > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await addLessonReport({ authorId: currentUser?.id, ...form })
      setForm(EMPTY_FORM())
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r) => {
    if (!window.confirm('이 수업보고를 삭제할까요?')) return
    try {
      await deleteLessonReport(r.id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const openEdit = (r) => {
    setEditing(r)
    setEditForm({
      date: r.date,
      studentIds: r.studentIds,
      startTime: r.startTime,
      endTime: r.endTime,
      topic: r.topic,
      textbook: r.textbook,
      content: r.content,
      homework: r.homework,
      note: r.note,
    })
  }

  const handleEditSave = async () => {
    if (!editForm?.date || !editForm.topic.trim() || editForm.studentIds.length === 0) return
    setSaving(true)
    try {
      await updateLessonReport(editing.id, editForm)
      setEditing(null)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  const studentName = (sid) => data.students.find((s) => s.id === sid)?.name ?? '?'

  return (
    <div className="space-y-6">
      {!readOnly && (
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-gray-900">새 수업보고</h2>
          <LessonFields value={form} onChange={setForm} students={students} />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="py-2.5 px-6 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCheck size={16} />
              저장
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">수업보고 기록</h2>
        {data.lessonReports.length === 0 ? (
          <div className="text-center text-gray-400 py-12">수업보고 기록이 없어요 📚</div>
        ) : (
          <div className="space-y-3">
            {data.lessonReports.map((r) => {
              const author = data.educators.find((e) => e.id === r.authorId)
              return (
                <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-gray-800 truncate">{r.topic || '수업'}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {r.date}
                        {r.startTime && ` ${r.startTime}~${r.endTime || ''}`}
                      </span>
                    </div>
                    {canManage(r) && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600 p-0.5" aria-label="수업보고 수정">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(r)} className="text-gray-400 hover:text-red-600 p-0.5" aria-label="수업보고 삭제">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  {r.studentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {r.studentIds.map((sid) => (
                        <span key={sid} className="text-[11px] bg-blue-50 text-blue-700 font-semibold rounded-full px-2 py-0.5">
                          {studentName(sid)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1 text-sm text-gray-700">
                    {r.textbook && <p><span className="text-xs font-semibold text-gray-500 mr-1.5">교재</span>{r.textbook}</p>}
                    {r.content && <p className="whitespace-pre-wrap"><span className="text-xs font-semibold text-gray-500 mr-1.5">내용</span>{r.content}</p>}
                    {r.homework && <p className="whitespace-pre-wrap"><span className="text-xs font-semibold text-gray-500 mr-1.5">과제</span>{r.homework}</p>}
                    {r.note && <p className="whitespace-pre-wrap"><span className="text-xs font-semibold text-gray-500 mr-1.5">특이사항</span>{r.note}</p>}
                  </div>
                  {author && (
                    <p className="text-xs text-gray-400 mt-2">작성: {educatorDisplayName(author)}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {editing && editForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base">수업보고 수정</h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <LessonFields value={editForm} onChange={setEditForm} students={students} />
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium">
                취소
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving || !editForm.date || !editForm.topic.trim() || editForm.studentIds.length === 0}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCheck size={16} />
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
