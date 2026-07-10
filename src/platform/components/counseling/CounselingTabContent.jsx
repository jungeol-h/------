import { useState } from 'react'
import { CheckCheck, Pencil, Trash2 } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  COUNSELING_TYPES, COUNSELING_TYPE_LABELS,
  COUNSELING_TARGET_TYPES, COUNSELING_TARGET_LABELS,
  composeCounselingContent,
} from '../../data/counselingTypes.js'
import StudentCombobox from './StudentCombobox.jsx'
import CounselingFormModal from './CounselingFormModal.jsx'
import CounselingContentFields from './CounselingContentFields.jsx'
import CounselingRecordBody from './CounselingRecordBody.jsx'

const EMPTY_FIELDS = { topic: '', detail: '', followUp: '', note: '' }

// 매니저/관리자 상담 탭 공용 본문.
// 상단에 인라인 작성 폼(버튼→모달 없이 바로 입력), 아래에 기존 상담 리스트.
// 두 역할의 차이는 props로만 분기: 작성 대상(students)·노출 기록(records)·작성자 표시(showAuthor).
// readOnly=true면 작성 폼과 카드 수정/삭제 버튼을 숨긴다(열람 전용 역할).
export default function CounselingTabContent({ students, records, showAuthor = false, authorId, readOnly = false }) {
  const { addCounselingRecord, deleteCounselingRecord, data } = useData()
  const { currentUser } = useAuth()
  const [studentId, setStudentId] = useState('')
  const [type, setType] = useState(COUNSELING_TYPES[0])
  const [targetType, setTargetType] = useState('student')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [saving, setSaving] = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  const canManage = (r) =>
    !readOnly && (r.educatorId === currentUser?.id || currentUser?.role === 'admin')

  const handleDelete = async (id) => {
    if (!window.confirm('이 상담 기록을 삭제할까요?')) return
    try {
      await deleteCounselingRecord(id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const fieldClass =
    'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'

  const canSave = !saving && fields.topic.trim() && studentId

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const content = composeCounselingContent(fields)
      await addCounselingRecord({ studentId, authorId, content, type, targetType, fields })
      // 성공 시 폼 초기화(학생/유형은 연속 작성 편의를 위해 유지하지 않고 비움).
      setStudentId('')
      setType(COUNSELING_TYPES[0])
      setTargetType('student')
      setFields(EMPTY_FIELDS)
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-6 space-y-6">
      {/* ── 새 상담 작성 ── */}
      {!readOnly && (
      <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">새 상담 기록</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StudentCombobox
            students={students}
            value={studentId}
            onChange={setStudentId}
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
                {COUNSELING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {COUNSELING_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <CounselingContentFields value={fields} onChange={setFields} fieldClass={fieldClass} />

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

      {/* ── 기존 상담 리스트 ── */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">상담 기록</h2>
        {records.length === 0 ? (
          <div className="text-center text-gray-400 py-12">상담 기록이 없어요 💬</div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => {
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{r.date}</span>
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
                            onClick={() => handleDelete(r.id)}
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
                  {showAuthor && author && (
                    <p className="text-xs text-gray-400 mt-2">작성: {author.name}</p>
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
    </div>
  )
}
