import { useState } from 'react'
import { AlertTriangle, ChevronRight, X, CheckCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

export default function ManagerHomeTab() {
  const { currentUser } = useAuth()
  const { data, resolveAlert } = useData()

  const myAlerts = data.alerts.filter(a => a.managerId === currentUser?.id && !a.resolved)
  const myStudentIds = data.assignments.filter(a => a.educatorId === currentUser?.id).map(a => a.studentId)
  const myStudents = data.students.filter(s => myStudentIds.includes(s.id))

  const [modal, setModal] = useState(null)
  const [comment, setComment] = useState('')

  const handleResolve = () => {
    if (!modal) return
    resolveAlert(modal.id, comment)
    setModal(null)
    setComment('')
  }

  return (
    <div className="py-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">안녕하세요, {currentUser?.name} 선생님</h2>
        <p className="text-sm text-gray-500">담당 학생 {myStudents.length}명</p>
      </div>

      {/* 긴급 알림 */}
      {myAlerts.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-red-500 font-bold text-sm">긴급 알림</span>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{myAlerts.length}</span>
          </div>
          {myAlerts.map(alert => {
            const student = data.students.find(s => s.id === alert.studentId)
            return (
              <div
                key={alert.id}
                onClick={() => { setModal(alert); setComment('') }}
                className={`rounded-2xl p-4 cursor-pointer border-2 transition-all hover:shadow-md ${
                  alert.severity === 'danger'
                    ? 'bg-red-50 border-red-300'
                    : 'bg-yellow-50 border-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    alert.severity === 'danger' ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    <AlertTriangle size={20} className={alert.severity === 'danger' ? 'text-red-500' : 'text-yellow-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.detail}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{alert.date}</p>
                  </div>
                  <ChevronRight size={16} className="text-blue-400 flex-shrink-0" />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <CheckCheck size={24} className="text-green-500 mx-auto mb-1" />
          <p className="text-green-700 font-semibold text-sm">긴급 알림이 없어요</p>
          <p className="text-xs text-green-500 mt-0.5">모든 학생이 안정적인 상태입니다</p>
        </div>
      )}

      {/* 담당 학생 요약 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">담당 학생 현황</h3>
        <div className="space-y-2">
          {myStudents.map(s => {
            const hasAlert = myAlerts.some(a => a.studentId === s.id)
            return (
              <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                  {s.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{s.name}</span>
                    {hasAlert && (
                      <AlertTriangle size={13} className="text-red-500" />
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{s.school} · {s.grade}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600">{s.selfIndex}</p>
                  <p className="text-xs text-gray-400">자기주도지수</p>
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
            <div className={`rounded-xl p-3 text-sm ${modal.severity === 'danger' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
              <p className="font-semibold">{modal.message}</p>
              <p className="mt-1 opacity-80">{modal.detail}</p>
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="학생에게 전달할 코칭 코멘트를 입력하세요..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleResolve}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCheck size={16} />
                알림 해제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
