import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronLeft } from 'lucide-react'
import { useData } from '../../../context/DataContext.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { COUNSELING_TYPE_LABELS, COUNSELING_TARGET_LABELS } from '../../../data/counselingTypes.js'
import DownloadPdfButton from '../../../pdf/components/DownloadPdfButton.jsx'
import { buildFilename } from '../../../pdf/utils/formatters.js'
import { buildStudentCounselingEntries } from '../../../context/selectors/studentCounselingReport.js'
import { educatorDisplayName } from '../../../utils/educatorName.js'
import CounselingRecordBody from '../../../components/counseling/CounselingRecordBody.jsx'
import ExternalCounselingForm from './ExternalCounselingForm.jsx'
import { deleteRecord } from './externalData.js'

// 외생 학생 상세: 정보 + 상담 기록 목록 + 작성/수정/삭제 + PDF.
// records는 해당 학생의 기록만 (상위에서 필터해 넘김).
// onRecordAdded/onRecordUpdated/onRecordDeleted로 상위 로컬 state 동기화.
export default function ExternalStudentDetail({
  student,
  records,
  onBack,
  onRecordAdded,
  onRecordUpdated,
  onRecordDeleted,
}) {
  const { currentUser } = useAuth()
  const { data } = useData()
  const [showForm, setShowForm] = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  const isAdmin = currentUser?.role === 'admin'

  // 작성자명: DataContext.educators에서 매핑 (instructor/consultant/admin은
  // fetchForAdmin으로 educators 보유). 없으면 '-'.
  const authorName = (counselorId) =>
    educatorDisplayName(data.educators?.find((e) => e.id === counselorId)) ?? '-'

  const sorted = records
    .slice()
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.id > a.id ? 1 : -1))

  const canManage = (r) => r.counselorId === currentUser?.id || isAdmin

  const handleDelete = async (id) => {
    if (!window.confirm('이 상담 기록을 삭제할까요?')) return
    try {
      await deleteRecord(id)
      onRecordDeleted?.(id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const buildPdf = useCallback(async () => {
    const { entries, totalCount, totalHours, periodText } = buildStudentCounselingEntries(
      records.map((r) => {
        const typeLabel = COUNSELING_TYPE_LABELS[r.type] || r.type
        const targetLabel = COUNSELING_TARGET_LABELS[r.targetType]
        return {
          ...r,
          startTime: '', // 외부상담에는 시각 컬럼이 없다 → 날짜만 표기
          endTime: '',
          fallbackContent: r.content,
          educatorName: authorName(r.counselorId),
          // 피상담자가 학생이 아니면 유형에 병기 (구 양식의 '대상' 컬럼 대체)
          typeLabel: r.targetType && r.targetType !== 'student' ? `${typeLabel}(${targetLabel})` : typeLabel,
        }
      }),
    )
    const { default: StudentCounselingReport } = await import('../../../pdf/reports/StudentCounselingReport.jsx')
    return {
      element: (
        <StudentCounselingReport
          header={{
            studentName: student?.name,
            schoolGrade: [student?.school, student?.grade].filter(Boolean).join(' '),
            periodText,
            scheduleText: '', // 외생은 자동 출결(등록일정) 없음
            totalCount,
            totalHours, // 외부상담은 시각 미기록 → 0시수
          }}
          entries={entries}
        />
      ),
      filename: buildFilename('상담보고서', student?.name),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, student])

  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft size={16} /> 목록으로
      </button>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="font-bold text-gray-900">{student?.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">
          {[student?.school, student?.grade].filter(Boolean).join(' · ') || '-'}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <DownloadPdfButton
          buildDocument={buildPdf}
          label="상담 보고서"
          disabled={records.length === 0}
        />
        {currentUser?.role !== 'viewer' && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 bg-emerald-500 text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
          >
            <Plus size={16} /> 상담 작성
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">상담 기록이 없습니다.</p>
      ) : (
        sorted.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
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
            <CounselingRecordBody record={r} fallback={r.content} />
            <p className="text-xs text-gray-400 mt-2">작성: {authorName(r.counselorId)}</p>
          </div>
        ))
      )}

      {showForm && (
        <ExternalCounselingForm
          student={student}
          counselorId={currentUser?.id}
          onClose={() => setShowForm(false)}
          onSaved={(rec) => onRecordAdded?.(rec)}
        />
      )}

      {editRecord && (
        <ExternalCounselingForm
          student={student}
          record={editRecord}
          counselorId={currentUser?.id}
          onClose={() => setEditRecord(null)}
          onSaved={(rec) => onRecordUpdated?.(rec)}
        />
      )}
    </div>
  )
}
