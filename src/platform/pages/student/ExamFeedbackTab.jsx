// 학생 내신 피드백 보고서 (LearningTab '내신' 서브탭) — 시험 선택 → 폼 + 지난 보고서 목록.

import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import ExamKeySelect from '../../components/examReports/ExamKeySelect.jsx'
import ExamFeedbackForm from '../../components/examReports/ExamFeedbackForm.jsx'
import { defaultExamKey, examKeyLabel, sameExamKey } from '../../utils/examTerms.js'

export default function ExamFeedbackTab() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const [examKey, setExamKey] = useState(() => defaultExamKey())

  const mine = (data.examFeedbacks ?? []).filter((f) => f.studentId === currentUser?.id)
  const existing = mine.find((f) => sameExamKey(f, examKey)) ?? null
  const past = [...mine].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))

  if (!currentUser) return null
  return (
    <div className="space-y-4">
      <ExamKeySelect value={examKey} onChange={(k) => k && setExamKey(k)} className="w-full" />
      <ExamFeedbackForm
        key={`${examKey.examYear}-${examKey.semester}-${examKey.examType}`}
        student={currentUser}
        examKey={examKey}
        existing={existing}
      />
      {past.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-gray-700 px-1">내가 쓴 보고서</p>
          {past.map((f) => (
            <button key={f.id} type="button" onClick={() => setExamKey({ examYear: f.examYear, semester: f.semester, examType: f.examType })}
              className={`w-full flex items-center justify-between bg-white rounded-xl border px-3 py-2.5 text-sm text-left ${
                sameExamKey(f, examKey) ? 'border-blue-300' : 'border-gray-200'
              }`}>
              <span className="text-gray-800">{examKeyLabel(f)}</span>
              <span className="text-xs text-gray-400">{f.writtenDate || (f.updatedAt || '').slice(0, 10)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
