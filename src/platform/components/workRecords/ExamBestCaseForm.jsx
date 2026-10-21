import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import ModalShell from '../common/ModalShell.jsx'
import StudentCombobox from '../common/StudentCombobox.jsx'
import ExamKeySelect from '../examReports/ExamKeySelect.jsx'
import { SUBJECTS } from '../../data/subjects.js'
import { defaultExamKey } from '../../utils/examTerms.js'

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'
const OTHER = '__other'

// 내신 우수사례 작성/수정 모달. record 있으면 수정(학생 고정).
export default function ExamBestCaseForm({ record, initialKey, students = [], onClose, onSaved }) {
  const { addExamBestCase, updateExamBestCase } = useData()
  const { currentUser } = useAuth()
  const isEdit = !!record
  const [key, setKey] = useState(() =>
    record ? { examYear: record.examYear, semester: record.semester, examType: record.examType }
      : (initialKey ?? defaultExamKey()))
  const [studentId, setStudentId] = useState(record?.studentId ?? '')
  const [subjectSel, setSubjectSel] = useState(() =>
    !record?.subject ? '' : SUBJECTS.includes(record.subject) ? record.subject : OTHER)
  const [subjectEtc, setSubjectEtc] = useState(() =>
    record?.subject && !SUBJECTS.includes(record.subject) ? record.subject : '')
  const [score, setScore] = useState(record?.score ?? '')
  const [prepPeriod, setPrepPeriod] = useState(record?.prepPeriod ?? '')
  const [process, setProcess] = useState(record?.process ?? '')
  const [keyPoint, setKeyPoint] = useState(record?.keyPoint ?? '')
  const [saving, setSaving] = useState(false)

  const subject = subjectSel === OTHER ? subjectEtc.trim() : subjectSel
  const canSave = !saving && studentId && subject && process.trim()

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const body = {
        examYear: key.examYear, semester: key.semester, examType: key.examType,
        subject, score: score.trim(), prepPeriod: prepPeriod.trim(),
        process: process.trim(), keyPoint: keyPoint.trim(),
      }
      if (isEdit) {
        await updateExamBestCase(record.id, { ...body, updatedAt: new Date().toISOString() })
      } else {
        await addExamBestCase({
          ...body, studentId, authorId: currentUser?.id, authorName: currentUser?.name,
        })
      }
      onSaved?.()
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  const label = (t) => <label className="text-xs text-gray-500 mb-1 block">{t}</label>

  return (
    <ModalShell title={isEdit ? '우수사례 수정' : '새 우수사례'} onClose={onClose}>
      <div>
        {label('시험')}
        <ExamKeySelect value={key} onChange={(k) => k && setKey(k)} className="w-full" />
      </div>
      <div>
        {label('학생')}
        {isEdit ? (
          <div className={`${fieldClass} bg-gray-50 text-gray-600`}>
            {students.find((s) => s.id === studentId)?.name ?? '(학생 정보 없음)'}
          </div>
        ) : (
          <StudentCombobox students={students} value={studentId} onChange={setStudentId} placeholder="학생 검색..." />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          {label('과목')}
          <select value={subjectSel} onChange={(e) => setSubjectSel(e.target.value)} className={`${fieldClass} w-full`}>
            <option value="">선택</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value={OTHER}>기타</option>
          </select>
          {subjectSel === OTHER && (
            <input value={subjectEtc} onChange={(e) => setSubjectEtc(e.target.value)} placeholder="과목명"
              className={`${fieldClass} w-full mt-2`} />
          )}
        </div>
        <div>
          {label('성적 (점수/등급)')}
          <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="예: 95점 / A" className={`${fieldClass} w-full`} />
        </div>
      </div>
      <div>
        {label('대비 기간')}
        <input value={prepPeriod} onChange={(e) => setPrepPeriod(e.target.value)} placeholder="예: 시험 4주 전부터" className={`${fieldClass} w-full`} />
      </div>
      <div>
        {label('학습 과정 요약')}
        <textarea value={process} onChange={(e) => setProcess(e.target.value)} rows={6}
          placeholder="시험 대비 계획 · 실천 과정 · 활용 자료 등"
          className={`${fieldClass} w-full resize-none`} />
      </div>
      <div>
        {label('성공 포인트')}
        <textarea value={keyPoint} onChange={(e) => setKeyPoint(e.target.value)} rows={3} className={`${fieldClass} w-full resize-none`} />
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={!canSave}
          className="py-2.5 px-6 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
          <CheckCheck size={16} />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </ModalShell>
  )
}
