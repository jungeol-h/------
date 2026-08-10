// 학생 다중 선택 (검색 콤보박스 + 칩) — LessonReportSection의 참여학생 패턴을
// 재사용 컴포넌트로 추출. 과제 일괄 부여·상담기록 다중 선택이 공유한다.
// value: studentId 배열, onChange(nextIds), max: 최대 인원(선택).

import { X } from 'lucide-react'
import StudentCombobox from './StudentCombobox.jsx'

export default function MultiStudentSelect({
  students = [],
  value = [],
  onChange,
  max,
  label = '학생 선택',
  placeholder = '학생 검색해서 추가...',
}) {
  const addStudent = (id) => {
    if (!id || value.includes(id)) return
    if (max && value.length >= max) {
      alert(`최대 ${max}명까지 선택할 수 있어요.`)
      return
    }
    onChange([...value, id])
  }

  const removeStudent = (id) => {
    onChange(value.filter((sid) => sid !== id))
  }

  // 이미 선택된 학생은 콤보박스 목록에서 제외
  const selectable = students.filter((s) => !value.includes(s.id))

  return (
    <div>
      <label className="text-xs text-gray-500 mb-1.5 block">
        {label}{max ? ` (최대 ${max}명)` : ''} · {value.length}명 선택됨
      </label>
      <StudentCombobox students={selectable} value="" onChange={addStudent} placeholder={placeholder} />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((sid) => {
            const s = students.find((st) => st.id === sid)
            return (
              <span
                key={sid}
                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full pl-2.5 pr-1 py-1"
              >
                {s?.name ?? sid}
                <button
                  type="button"
                  onClick={() => removeStudent(sid)}
                  className="p-0.5 hover:text-blue-900"
                  aria-label="학생 제거"
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
