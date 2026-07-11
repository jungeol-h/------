import { X } from 'lucide-react'

// 관리자 홈 핵심지표(출결/학습/마인드 주의) 상세 모달 — UrgentReportListModal 레이아웃.
// rows: [{ student, valueText }], 행 클릭 시 onSelect(studentId)로 학생 상세 이동.
export default function CautionStudentsModal({ title, icon: Icon, iconClass = 'text-red-500', description, rows, emptyText, onClose, onSelect }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={17} className={iconClass} />}
            <h3 className="font-bold text-gray-900 text-base">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {description && <p className="text-xs text-gray-400 -mt-2">{description}</p>}

        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{emptyText ?? '해당 학생이 없습니다.'}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ student, valueText }) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => onSelect(student.id)}
                  className="w-full flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 text-left hover:bg-blue-50 active:scale-[0.99] transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{student.name}</p>
                    <p className="text-xs text-gray-500 truncate">{student.school} · {student.grade}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-full px-2 py-0.5 flex-shrink-0 ml-2">
                    {valueText}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
