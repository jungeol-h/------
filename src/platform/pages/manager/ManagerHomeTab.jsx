import { useState, useMemo } from 'react'
import { AlertTriangle, X, CheckCheck, Clock, ClipboardList, MessageCircle, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { getRiskStudents } from '../../context/selectors/riskDetection.js'
import SaveErrorBox from '../../components/common/SaveErrorBox.jsx'

export default function ManagerHomeTab() {
  const { currentUser } = useAuth()
  const { data, recordCoaching } = useData()

  const myStudentIds = data.assignments.filter(a => a.educatorId === currentUser?.id).map(a => a.studentId)
  const myStudents = data.students.filter(s => myStudentIds.includes(s.id))

  // 위험 학생 — 조회 시점 실시간 계산 (담당 학생 중 마인드 위험군)
  const riskStudents = useMemo(
    () => getRiskStudents(data, { educatorId: currentUser?.id }),
    [data, currentUser?.id]
  )

  // 이미 코칭(alert 기록)이 있는 학생 — "코칭 완료" 표시용
  const coachedStudentIds = useMemo(
    () => new Set(data.alerts.map(a => a.studentId)),
    [data.alerts]
  )

  const [modal, setModal] = useState(null)
  const [comment, setComment] = useState('')
  const [coachError, setCoachError] = useState(null)

  const handleCoach = async () => {
    if (!modal) return
    setCoachError(null)
    try {
      await recordCoaching({
        studentId: modal.student.id,
        managerId: currentUser.id,
        studentName: modal.student.name,
        level: modal.level,
        comment,
      })
      setModal(null)
      setComment('')
    } catch (e) {
      setCoachError(e)
    }
  }

  return (
    <div className="py-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">안녕하세요, {currentUser?.name} 선생님</h2>
        <p className="text-sm text-gray-500">담당 학생 {myStudents.length}명</p>
      </div>

      {/* 위험 학생 — 마인드 점수 낮은 담당 학생 */}
      {riskStudents.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-red-500 font-bold text-sm">마인드 위험 학생</span>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{riskStudents.length}</span>
          </div>
          {riskStudents.map(({ student, level }) => {
            const coached = coachedStudentIds.has(student.id)
            return (
              <div
                key={student.id}
                onClick={() => { setModal({ student, level }); setComment('') }}
                className={`rounded-2xl p-4 cursor-pointer border-2 transition-all hover:shadow-md ${
                  level === 'danger' ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    level === 'danger' ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    <AlertTriangle size={20} className={level === 'danger' ? 'text-red-500' : 'text-yellow-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm">{student.name} 학생</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      마인드 점수 {level === 'danger' ? '위험' : '주의'} 단계입니다
                    </p>
                  </div>
                  {coached ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-semibold flex-shrink-0">
                      <CheckCheck size={14} /> 코칭 완료
                    </span>
                  ) : (
                    <span className="text-xs text-blue-500 font-semibold flex-shrink-0">코칭하기</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <CheckCheck size={24} className="text-green-500 mx-auto mb-1" />
          <p className="text-green-700 font-semibold text-sm">마인드 위험 학생이 없어요</p>
          <p className="text-xs text-green-500 mt-0.5">담당 학생이 모두 안정적인 상태입니다</p>
        </div>
      )}

      {/* 담당 학생 요약 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">담당 학생 현황</h3>
        <div className="space-y-2">
          {myStudents.map(s => {
            const isRisk = riskStudents.some(r => r.student.id === s.id)
            const totalMin = data.learningRecords.filter(r => r.studentId === s.id).reduce((sum, r) => sum + r.duration, 0)
            const pendingCount = data.tasks.filter(t => t.studentId === s.id && t.status === 'pending').length
            const counselingCount = data.counselingRecords.filter(r => r.studentId === s.id).length
            return (
              <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User size={20} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{s.name}</span>
                    {isRisk && (
                      <AlertTriangle size={13} className="text-red-500" />
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{s.school} · {s.grade}</span>
                </div>
                <div className="flex flex-col gap-1 text-right min-w-[68px]">
                  <div className="flex items-center gap-1 justify-end text-xs text-gray-600">
                    <Clock size={11} className="text-indigo-400" />
                    <span>{totalMin}분</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end text-xs">
                    <ClipboardList size={11} className={pendingCount > 0 ? 'text-red-400' : 'text-gray-300'} />
                    <span className={pendingCount > 0 ? 'text-red-600 font-bold' : 'text-gray-600'}>{pendingCount}개</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end text-xs text-gray-600">
                    <MessageCircle size={11} className="text-emerald-400" />
                    <span>{counselingCount}회</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 코칭 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base">코칭 코멘트 작성</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className={`rounded-xl p-3 text-sm ${modal.level === 'danger' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
              <p className="font-semibold">{modal.student.name} 학생</p>
              <p className="mt-1 opacity-80">
                마인드 점수가 {modal.level === 'danger' ? '위험' : '주의'} 단계입니다. 코칭 코멘트를 남기면 상담 기록에 등록됩니다.
              </p>
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="학생에게 전달할 코칭 코멘트를 입력하세요..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <SaveErrorBox error={coachError} userId={currentUser?.id} />
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleCoach}
                disabled={!comment.trim()}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCheck size={16} />
                코칭 기록 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
