import { useState, useMemo, useCallback } from 'react'
import { User, AlertCircle, Plus, MoreVertical, Pencil, UserX, UserCheck, Search, ArrowUp, ArrowDown } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { getMindStatus } from '../../context/selectors/riskDetection.js'
import { getStudentIndicatorMap } from '../../context/selectors/studentIndicators.js'
import { LEARNING_CAUTION_RATE } from '../../context/selectors/weeklyLearning.js'
import { ATTENDANCE_CAUTION_ABSENT_THRESHOLD } from '../../context/selectors/attendanceStats.js'
import { formatPhone } from '../../utils/formatPhone.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'
import StudentFormModal from '../../components/admin/StudentFormModal.jsx'
import ParentManagementModal from '../../components/admin/ParentManagementModal.jsx'
import DownloadPdfButton from '../../pdf/components/DownloadPdfButton.jsx'
import { buildFilename, nowDateTime } from '../../pdf/utils/formatters.js'
import { authorOf } from '../../pdf/config/meta.js'

const ROLE_LABELS = { student: '학생', manager: '학습매니저', admin: '관리자', instructor: '교과강사', consultant: '컨설턴트', viewer: '열람자' }
const GENDER_LABELS = { M: '남', F: '여' }
// 학년 정렬 컬럼은 제거됨(학년은 이름 밑 병기) — GRADE_ORDER/gradeWeight도 함께 제거.
// 마인드 자동 지표 배지 (studentIndicators.mind)
const MIND_BADGES = {
  good:    { label: '양호', color: 'text-green-600 bg-green-100' },
  caution: { label: '주의', color: 'text-yellow-600 bg-yellow-100' },
  risk:    { label: '위험', color: 'text-red-600 bg-red-100' },
}
// 학생 목록 그리드 컬럼 — 이름/담당/학생연락처/학부모연락처/출결/학습/마인드/과제/일정/지수/메뉴
const LIST_GRID = 'grid-cols-[minmax(130px,1fr)_60px_100px_100px_48px_48px_52px_52px_44px_48px_32px]'

export default function UserManagementTab({ readOnly = false }) {
  const { data, createStudent, updateStudent, setStudentStatus } = useData()
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState(null) // { mode: 'create' } | { mode: 'edit', student }
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [showParentModal, setShowParentModal] = useState(false)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('name') // 'name' | 'grade' | 'manager' | 'risk' | 'selfIndex'
  const [sortDir, setSortDir] = useState('asc')  // 'asc' | 'desc'

  // 열람 전용(viewer) 경로에서는 학생 상세도 viewer 경로로 이동한다.
  const detailBase = currentUser?.role === 'viewer' ? '/viewer/student' : '/admin/student'

  const managers = data.educators.filter((e) => e.role === 'manager')
  const allStudents = data.students
  const activeStudents = allStudents.filter((s) => (s.status ?? 'active') === 'active')
  const inactiveStudents = allStudents.filter((s) => s.status === 'inactive')
  const baseStudents = showInactive ? allStudents : activeStudents

  const managerNameOf = (studentId) => {
    const a = data.assignments.find((x) => x.studentId === studentId)
    if (!a) return ''
    return data.educators.find((e) => e.id === a.educatorId)?.name ?? ''
  }

  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? baseStudents.filter((s) => {
          const mgr = managerNameOf(s.id)
          return (
            (s.name || '').toLowerCase().includes(q) ||
            (s.school || '').toLowerCase().includes(q) ||
            (s.grade || '').toLowerCase().includes(q) ||
            (s.className || '').toLowerCase().includes(q) ||
            mgr.toLowerCase().includes(q)
          )
        })
      : baseStudents.slice()

    const dir = sortDir === 'asc' ? 1 : -1
    const cmp = (a, b) => {
      switch (sortKey) {
        case 'manager': {
          const am = managerNameOf(a.id)
          const bm = managerNameOf(b.id)
          if (!am && bm) return 1
          if (am && !bm) return -1
          const d = am.localeCompare(bm, 'ko')
          return d !== 0 ? d * dir : (a.name || '').localeCompare(b.name || '', 'ko')
        }
        case 'selfIndex': {
          const d = (a.selfIndex ?? 0) - (b.selfIndex ?? 0)
          return d !== 0 ? d * dir : (a.name || '').localeCompare(b.name || '', 'ko')
        }
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '', 'ko') * dir
      }
    }
    return filtered.sort(cmp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseStudents, query, sortKey, sortDir, data.assignments, data.educators])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'selfIndex' || key === 'risk' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ k }) =>
    sortKey === k ? (
      sortDir === 'asc' ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />
    ) : null

  const findManagerId = (studentId) =>
    data.assignments.find((a) => a.studentId === studentId)?.educatorId ?? ''

  // 출결/학습/마인드/과제/일정 지표 — 레코드 배열 1-pass로 학생별 Map 계산 (행별 selector 호출 금지)
  const indicatorMap = useMemo(() => getStudentIndicatorMap(data), [data])

  const handleCreate = async (form) => {
    await createStudent(form)
  }

  const handleEdit = async (form) => {
    if (modal?.mode !== 'edit' || !modal.student) return
    await updateStudent(modal.student.id, form)
  }

  const handleDownloadPdf = useCallback(async () => {
    const identifier = `${showInactive ? '전체' : '활성'}_${sortKey}${sortDir === 'desc' ? '내림' : '오름'}`
    const filename = buildFilename('학생목록', identifier)
    const [{ downloadPdf }, { default: UserListReport }] = await Promise.all([
      import('../../pdf/utils/downloadPdf.js'),
      import('../../pdf/reports/UserListReport.jsx'),
    ])
    await downloadPdf(
      <UserListReport
        students={visibleStudents}
        managerNameOf={managerNameOf}
        filters={{ showInactive, query, sortKey, sortDir }}
        period={`조회일 ${nowDateTime().slice(0, 10)}`}
        generatedAt={nowDateTime()}
        author={authorOf(currentUser)}
      />,
      filename,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStudents, showInactive, query, sortKey, sortDir, currentUser])

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">학생 관리</h2>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              onClick={() => setShowParentModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              학부모 계정
            </button>
          )}
          <DownloadPdfButton
            onDownload={handleDownloadPdf}
            label="학생 목록 보고서"
            disabled={visibleStudents.length === 0}
          />
        </div>
      </div>

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
            {!readOnly && (
              <button
                onClick={() => setModal({ mode: 'create' })}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                <Plus size={14} />
                학생 추가
              </button>
            )}
          </div>
        </div>

        {/* 검색바 */}
        <div className="mb-2 relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름·학교·학년·반·담당 검색"
            className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <div className="min-w-[760px]">
          <div className={`grid ${LIST_GRID} text-xs text-gray-400 font-semibold px-3 py-2 border-b border-gray-100 bg-gray-50`}>
            <button
              type="button"
              onClick={() => toggleSort('name')}
              className={`text-left flex items-center gap-1 hover:text-gray-600 ${sortKey === 'name' ? 'text-gray-700' : ''}`}
            >
              이름 <SortIcon k="name" />
            </button>
            <button
              type="button"
              onClick={() => toggleSort('manager')}
              className={`text-center flex items-center justify-center gap-1 hover:text-gray-600 ${sortKey === 'manager' ? 'text-gray-700' : ''}`}
            >
              담당 <SortIcon k="manager" />
            </button>
            <span className="text-center">학생 연락처</span>
            <span className="text-center">학부모 연락처</span>
            <span className="text-center" title="최근 30일 결석 횟수">출결</span>
            <span className="text-center" title="최근 7일 계획 이행률">학습</span>
            <span className="text-center" title="최근 마인드 기록 판정">마인드</span>
            <span className="text-center" title="과제 완료/전체">과제</span>
            <span className="text-center" title="업무계획에 태그된 횟수">일정</span>
            <button
              type="button"
              onClick={() => toggleSort('selfIndex')}
              className={`text-right flex items-center justify-end gap-1 hover:text-gray-600 ${sortKey === 'selfIndex' ? 'text-gray-700' : ''}`}
            >
              지수 <SortIcon k="selfIndex" />
            </button>
            <span className="text-center"> </span>
          </div>
          {visibleStudents.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400">
              {query.trim() ? '검색 결과가 없습니다.' : '표시할 학생이 없습니다.'}
            </div>
          ) : (
            visibleStudents.map((s) => {
              const hasAlert = getMindStatus(data.mindRecords.filter((r) => r.studentId === s.id)) !== null
              const mgr = managers.find((m) =>
                data.assignments.some((a) => a.studentId === s.id && a.educatorId === m.id)
              )
              const isInactive = s.status === 'inactive'
              const genderLabel = s.gender ? GENDER_LABELS[s.gender] : null
              const ind = indicatorMap.get(s.id)
              const mindBadge = ind?.mind ? MIND_BADGES[ind.mind] : null
              const fulfillRate = ind?.fulfillment ? Math.round(ind.fulfillment.rate * 100) : null

              return (
                <div
                  key={s.id}
                  className={`grid ${LIST_GRID} items-center px-3 py-2.5 border-b border-gray-50 last:border-0 transition-colors ${
                    isInactive ? 'bg-gray-50/60 opacity-70' : 'hover:bg-gray-50 active:bg-gray-100'
                  } cursor-pointer`}
                  onClick={() => navigate(`${detailBase}/${s.id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
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
                      <span className="text-xs text-gray-400 truncate block">
                        {s.school || '학교 미입력'}{s.grade ? ` · ${s.grade}` : ''}{s.className ? ` ${s.className}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-center text-xs text-gray-500 truncate px-1">
                    {mgr ? mgr.name : <span className="text-orange-400">미배정</span>}
                  </span>
                  <span className="text-center text-[11px] text-gray-600 whitespace-nowrap">{formatPhone(s.password) || '-'}</span>
                  <span className="text-center text-[11px] text-gray-600 whitespace-nowrap">{formatPhone(s.parentPassword) || '-'}</span>
                  <span className={`text-center text-xs font-semibold ${
                    (ind?.absentCount ?? 0) >= ATTENDANCE_CAUTION_ABSENT_THRESHOLD ? 'text-red-600' : 'text-gray-600'
                  }`} title="최근 30일 결석 횟수">
                    {ind?.absentCount ? `결${ind.absentCount}` : '-'}
                  </span>
                  <span className={`text-center text-xs font-semibold ${
                    fulfillRate != null && fulfillRate < LEARNING_CAUTION_RATE * 100 ? 'text-orange-600' : 'text-gray-600'
                  }`} title="최근 7일 계획 이행률">
                    {fulfillRate != null ? `${fulfillRate}%` : '-'}
                  </span>
                  {mindBadge ? (
                    <span className={`text-center text-[11px] font-semibold px-1 py-0.5 rounded-full mx-auto ${mindBadge.color}`}>
                      {mindBadge.label}
                    </span>
                  ) : (
                    <span className="text-center text-xs text-gray-300">-</span>
                  )}
                  <span className="text-center text-xs text-gray-600" title="과제 완료/전체">
                    {ind?.tasksTotal ? `${ind.tasksDone}/${ind.tasksTotal}` : '-'}
                  </span>
                  <span className="text-center text-xs text-gray-600" title="업무계획 태그 횟수">
                    {ind?.planCount ? `${ind.planCount}회` : '-'}
                  </span>
                  <span className="text-right text-sm font-bold text-blue-600">{s.selfIndex}점</span>
                  {readOnly ? (
                    <span aria-hidden />
                  ) : (
                  <div className="flex justify-center relative">
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
                  )}
                </div>
              )
            })
          )}
          </div>
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

      {!readOnly && modal && (
        <StudentFormModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.student : undefined}
          managers={managers}
          initialManagerId={modal.mode === 'edit' ? findManagerId(modal.student.id) : ''}
          onSubmit={modal.mode === 'edit' ? handleEdit : handleCreate}
          onClose={() => setModal(null)}
        />
      )}

      {!readOnly && showParentModal && (
        <ParentManagementModal onClose={() => setShowParentModal(false)} />
      )}
    </div>
  )
}
