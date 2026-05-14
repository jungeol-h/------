import { useState } from 'react'
import { User, AlertCircle, Plus, MoreVertical, Pencil, UserX, UserCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useNavigate } from 'react-router-dom'
import StudentFormModal from '../../components/admin/StudentFormModal.jsx'

const ROLE_LABELS = { student: '학생', manager: '학습매니저', admin: '관리자' }
const RISK_LABELS = {
  normal:  { label: '정상', color: 'text-green-600 bg-green-100' },
  warning: { label: '주의', color: 'text-yellow-600 bg-yellow-100' },
  danger:  { label: '위험', color: 'text-red-600 bg-red-100' },
}
const GENDER_LABELS = { M: '남', F: '여' }

export default function UserManagementTab() {
  const { data, createStudent, updateStudent, setStudentStatus } = useData()
  const navigate = useNavigate()

  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState(null) // { mode: 'create' } | { mode: 'edit', student }
  const [menuOpenId, setMenuOpenId] = useState(null)

  const managers = data.educators.filter((e) => e.role === 'manager')
  const allStudents = data.students
  const activeStudents = allStudents.filter((s) => (s.status ?? 'active') === 'active')
  const inactiveStudents = allStudents.filter((s) => s.status === 'inactive')
  const visibleStudents = showInactive ? allStudents : activeStudents

  const findManagerId = (studentId) =>
    data.assignments.find((a) => a.studentId === studentId)?.educatorId ?? ''

  const handleCreate = async (form) => {
    await createStudent(form)
  }

  const handleEdit = async (form) => {
    if (modal?.mode !== 'edit' || !modal.student) return
    await updateStudent(modal.student.id, form)
  }

  const handleToggleStatus = async (student) => {
    const isActive = (student.status ?? 'active') === 'active'
    const next = isActive ? 'inactive' : 'active'
    const confirmMsg = isActive
      ? `${student.name} 학생을 비활성화할까요? 다른 화면(매니저/통계)에서 숨겨집니다.`
      : `${student.name} 학생을 다시 활성화할까요?`
    if (!window.confirm(confirmMsg)) return
    try {
      await setStudentStatus(student.id, next)
      setMenuOpenId(null)
    } catch {
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="py-6 space-y-6">
      <h2 className="text-lg font-bold text-gray-900">사용자 관리</h2>

      {/* ── 학생 목록 ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-500">
            학생 (활성 {activeStudents.length}명{inactiveStudents.length > 0 ? ` / 비활성 ${inactiveStudents.length}명` : ''})
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              비활성 표시
            </label>
            <button
              onClick={() => setModal({ mode: 'create' })}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
            >
              <Plus size={14} />
              학생 추가
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] text-xs text-gray-400 font-semibold px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span>이름 · 학교</span>
            <span className="w-14 text-center">담당</span>
            <span className="w-10 text-center">위험도</span>
            <span className="w-12 text-right">지수</span>
            <span className="w-8 text-center"> </span>
          </div>
          {visibleStudents.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400">표시할 학생이 없습니다.</div>
          ) : (
            visibleStudents.map((s) => {
              const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
              const hasAlert = data.alerts.some((a) => a.studentId === s.id && !a.resolved)
              const mgr = managers.find((m) =>
                data.assignments.some((a) => a.studentId === s.id && a.educatorId === m.id)
              )
              const isInactive = s.status === 'inactive'
              const genderLabel = s.gender ? GENDER_LABELS[s.gender] : null

              return (
                <div
                  key={s.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-3 py-2.5 border-b border-gray-50 last:border-0 transition-colors ${
                    isInactive ? 'bg-gray-50/60 opacity-70' : 'hover:bg-gray-50 active:bg-gray-100'
                  } cursor-pointer`}
                  onClick={() => navigate(`/admin/student/${s.id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800 truncate">{s.name}</span>
                        {genderLabel && (
                          <span className={`text-[10px] font-bold px-1 rounded ${
                            s.gender === 'M' ? 'text-blue-600 bg-blue-50' : 'text-pink-600 bg-pink-50'
                          }`}>
                            {genderLabel}
                          </span>
                        )}
                        {hasAlert && !isInactive && <AlertCircle size={11} className="text-red-500 flex-shrink-0" />}
                        {isInactive && (
                          <span className="text-[10px] font-bold px-1 rounded text-gray-500 bg-gray-200">비활성</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 truncate">
                        {s.school || '학교 미입력'} · {s.grade}{s.className ? ` · ${s.className}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="w-14 text-center text-xs text-gray-500 truncate px-1">
                    {mgr ? mgr.name : <span className="text-orange-400">미배정</span>}
                  </span>
                  <span className={`w-10 text-center text-xs font-semibold px-1 py-0.5 rounded-full ${risk.color}`}>
                    {risk.label}
                  </span>
                  <span className="w-12 text-right text-sm font-bold text-blue-600">{s.selfIndex}점</span>
                  <div className="w-8 flex justify-center relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpenId(menuOpenId === s.id ? null : s.id)
                      }}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuOpenId === s.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(null)
                          }}
                        />
                        <div
                          className="absolute right-0 top-7 z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[120px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setModal({ mode: 'edit', student: s })
                              setMenuOpenId(null)
                            }}
                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Pencil size={12} /> 수정
                          </button>
                          <button
                            onClick={() => handleToggleStatus(s)}
                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            {isInactive ? <><UserCheck size={12} /> 활성화</> : <><UserX size={12} /> 비활성화</>}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ── 교육자 목록 (읽기 전용 유지) ── */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 mb-3">교육자 ({data.educators.length}명)</h3>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] text-xs text-gray-400 font-semibold px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span>이름</span>
            <span className="w-20 text-center">역할</span>
            <span className="w-14 text-right">담당</span>
          </div>
          {data.educators.map((e) => {
            const assignedCount = data.assignments.filter((a) => a.educatorId === e.id).length
            return (
              <div key={e.id} className="grid grid-cols-[1fr_auto_auto] items-center px-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-gray-400" />
                  </div>
                  <span className="font-semibold text-sm text-gray-800">{e.name}</span>
                </div>
                <span className="w-20 text-center text-xs text-gray-500">{ROLE_LABELS[e.role] || e.role}</span>
                <span className="w-14 text-right text-sm font-bold text-emerald-600">
                  {e.role === 'manager' ? `${assignedCount}명` : '-'}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {modal && (
        <StudentFormModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.student : undefined}
          managers={managers}
          initialManagerId={modal.mode === 'edit' ? findManagerId(modal.student.id) : ''}
          onSubmit={modal.mode === 'edit' ? handleEdit : handleCreate}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
