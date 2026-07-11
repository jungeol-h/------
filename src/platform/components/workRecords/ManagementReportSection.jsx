import { useState } from 'react'
import { CheckCheck, Pencil, Trash2 } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import ModalShell from '../common/ModalShell.jsx'
import {
  MANAGEMENT_WORK_TYPES, MANAGEMENT_WORK_TYPE_LABELS,
} from '../../data/workRecordTypes.js'
import { todayStr as today } from '../../utils/dateUtils.js'


const EMPTY_FORM = () => ({
  date: today(),
  workType: MANAGEMENT_WORK_TYPES[0],
  startTime: '',
  endTime: '',
  content: '',
  note: '',
})

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'

// 관리보고 폼 필드 그룹 — 작성 섹션과 수정 모달이 공유.
function ManagementFields({ value, onChange }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">날짜</label>
          <input type="date" value={value.date} onChange={set('date')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">업무유형</label>
          <select value={value.workType} onChange={set('workType')} className={`${fieldClass} w-full`}>
            {MANAGEMENT_WORK_TYPES.map((t) => (
              <option key={t} value={t}>{MANAGEMENT_WORK_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">시작시간</label>
          <input type="time" value={value.startTime} onChange={set('startTime')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">종료시간</label>
          <input type="time" value={value.endTime} onChange={set('endTime')} className={`${fieldClass} w-full`} />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">세부내용</label>
        <textarea value={value.content} onChange={set('content')} rows={3} className={`${fieldClass} w-full resize-none`} />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">특이사항</label>
        <textarea value={value.note} onChange={set('note')} rows={2} className={`${fieldClass} w-full resize-none`} />
      </div>
    </>
  )
}

// 관리보고 메뉴 — 관리자 전용 작성(강사관리·운영일정관리 등 6유형), viewer는 열람만.
export default function ManagementReportSection({ readOnly = false }) {
  const { data, addManagementReport, updateManagementReport, deleteManagementReport } = useData()
  const { currentUser } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null) // 수정 대상 record
  const [editForm, setEditForm] = useState(null)

  const canSave = !saving && form.date && form.content.trim()

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await addManagementReport({ authorId: currentUser?.id, ...form })
      setForm(EMPTY_FORM())
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r) => {
    if (!window.confirm('이 관리보고를 삭제할까요?')) return
    try {
      await deleteManagementReport(r.id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const openEdit = (r) => {
    setEditing(r)
    setEditForm({
      date: r.date,
      workType: r.workType,
      startTime: r.startTime,
      endTime: r.endTime,
      content: r.content,
      note: r.note,
    })
  }

  const handleEditSave = async () => {
    if (!editForm?.date || !editForm.content.trim()) return
    setSaving(true)
    try {
      await updateManagementReport(editing.id, editForm)
      setEditing(null)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-gray-900">새 관리보고</h2>
          <ManagementFields value={form} onChange={setForm} />
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
        <h2 className="text-base font-bold text-gray-900">관리보고 기록</h2>
        {data.managementReports.length === 0 ? (
          <div className="text-center text-gray-400 py-12">관리보고 기록이 없어요 📋</div>
        ) : (
          <div className="space-y-3">
            {data.managementReports.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                      {MANAGEMENT_WORK_TYPE_LABELS[r.workType] ?? r.workType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {r.date}
                      {r.startTime && ` ${r.startTime}~${r.endTime || ''}`}
                    </span>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-blue-600 p-0.5" aria-label="관리보고 수정">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(r)} className="text-gray-400 hover:text-red-600 p-0.5" aria-label="관리보고 삭제">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
                {r.note && (
                  <p className="text-xs text-gray-500 mt-1.5 whitespace-pre-wrap">
                    <span className="font-semibold">특이사항</span> {r.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {editing && editForm && (
        <ModalShell title="관리보고 수정" onClose={() => setEditing(null)}>
            <ManagementFields value={editForm} onChange={setEditForm} />
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium">
                취소
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving || !editForm.date || !editForm.content.trim()}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCheck size={16} />
                저장
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  )
}
