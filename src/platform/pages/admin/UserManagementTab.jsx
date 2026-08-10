// 관리자 학생 탭 (/admin/users) — 학생 목록 그리드(검색·정렬, 출결/학습/마인드/과제/일정 지표 배지)
// + 학생 등록(개별·엑셀 일괄)/수정/등록 상태 변경(재원·신청취소·퇴원), 학부모 계정 관리 모달, 보고서 PDF 출력.
// 지표는 getStudentIndicatorMap으로 1-pass 계산. viewer의 /viewer/students에서 readOnly로 재사용.

import { useState, useMemo, useCallback } from 'react'
import { User, AlertCircle, Plus, Upload, MoreVertical, Pencil, UserX, UserCheck, Search, ArrowUp, ArrowDown, Trash2, ClipboardList, Paperclip, MessageSquare } from 'lucide-react'
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
import EducatorGroupModal from '../../components/admin/EducatorGroupModal.jsx'
import EducatorFormModal from '../../components/admin/EducatorFormModal.jsx'
import ModalShell from '../../components/common/ModalShell.jsx'
import BulkStudentUploadModal from '../../components/admin/BulkStudentUploadModal.jsx'
import TaskFormModal from '../../components/tasks/TaskFormModal.jsx'
import StudyJournalModal from '../../components/admin/StudyJournalModal.jsx'
import StudentFeedbackModal from '../../components/admin/StudentFeedbackModal.jsx'
import { GROUP_OPTIONS } from '../../data/groups.js'
import { STUDENT_STATUS_OPTIONS, STUDENT_STATUS_LABELS, isActiveStudent } from '../../data/studentStatus.js'
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
// 학생 목록 그리드 컬럼 — 이름/담당/학생연락처/학부모연락처/출결/학습/마인드/과제/일정/일지/지수/메뉴
const LIST_GRID = 'grid-cols-[minmax(130px,1fr)_60px_100px_100px_48px_48px_52px_52px_44px_44px_48px_32px]'

export default function UserManagementTab({ readOnly = false }) {
  const {
    data, createStudent, updateStudent, updateEducatorGroups, setStudentStatus,
    createEducator, updateEducator, setEducatorStatus, deleteEducator,
  } = useData()
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [showInactive, setShowInactive] = useState(false) // 재원 외(신청취소·퇴원·비활성) 표시
  const [modal, setModal] = useState(null) // { mode: 'create' } | { mode: 'edit', student }
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [showParentModal, setShowParentModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false) // 과제 내기 — 학생 다중 선택 일괄 부여
  const [showFeedbackModal, setShowFeedbackModal] = useState(false) // 학생 피드백 — 수시 코멘트
  const [journalStudentId, setJournalStudentId] = useState(null) // 학습일지 첨부 모달 대상 학생 id
  const [query, setQuery] = useState('')
  const [filterGroup, setFilterGroup] = useState('all') // 'all' | GROUP_OPTIONS 값
  const [groupEditTarget, setGroupEditTarget] = useState(null) // 소속 편집 대상 교육자
  const [educatorModal, setEducatorModal] = useState(null) // { mode: 'create' } | { mode: 'edit', educator }
  const [educatorMenuId, setEducatorMenuId] = useState(null)
  const [showInactiveEducators, setShowInactiveEducators] = useState(false)
  const [educatorDeleteTarget, setEducatorDeleteTarget] = useState(null) // 완전 삭제 확인 대상
  const [sortKey, setSortKey] = useState('name') // 'name' | 'grade' | 'manager' | 'risk' | 'selfIndex'
  const [sortDir, setSortDir] = useState('asc')  // 'asc' | 'desc'

  // 열람 전용(viewer) 경로에서는 학생 상세도 viewer 경로로 이동한다.
  const detailBase = currentUser?.role === 'viewer' ? '/viewer/student' : '/admin/student'

  const managers = data.educators.filter((e) => e.role === 'manager' && e.status !== 'inactive')
  const allStudents = data.students
  const activeStudents = allStudents.filter(isActiveStudent)
  const nonActiveStudents = allStudents.filter((s) => !isActiveStudent(s))
  const baseStudents = showInactive ? allStudents : activeStudents

  const managerNameOf = (studentId) => {
    const a = data.assignments.find((x) => x.studentId === studentId)
    if (!a) return ''
    return data.educators.find((e) => e.id === a.educatorId)?.name ?? ''
  }

  const visibleStudents = useMemo(() => {
    const grouped = filterGroup === 'all'
      ? baseStudents
      : baseStudents.filter((s) => (s.groups ?? []).includes(filterGroup))
    const q = query.trim().toLowerCase()
    const filtered = q
      ? grouped.filter((s) => {
          const mgr = managerNameOf(s.id)
          return (
            (s.name || '').toLowerCase().includes(q) ||
            (s.school || '').toLowerCase().includes(q) ||
            (s.grade || '').toLowerCase().includes(q) ||
            (s.className || '').toLowerCase().includes(q) ||
            mgr.toLowerCase().includes(q)
          )
        })
      : grouped.slice()

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
  }, [baseStudents, query, filterGroup, sortKey, sortDir, data.assignments, data.educators])

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

  const buildPdf = useCallback(async () => {
    // 그룹을 파일명·제목에 넣는다 — 그룹별로 여러 부를 뽑을 때 파일이 구분되지 않아
    // "그룹별 인쇄가 안 된다"는 클라이언트 제보(2026-08-10). 필터 자체는 원래 적용됐다.
    const groupLabel = filterGroup === 'all' ? '전체그룹' : filterGroup
    const identifier = `${groupLabel}_${showInactive ? '전체' : '활성'}_${sortKey}${sortDir === 'desc' ? '내림' : '오름'}`
    const filename = buildFilename('학생목록', identifier)
    const { default: UserListReport } = await import('../../pdf/reports/UserListReport.jsx')
    return {
      element: (
        <UserListReport
          students={visibleStudents}
          managerNameOf={managerNameOf}
          filters={{ showInactive, query, sortKey, sortDir, group: filterGroup }}
          period={`조회일 ${nowDateTime().slice(0, 10)}`}
          generatedAt={nowDateTime()}
          author={authorOf(currentUser)}
        />
      ),
      filename,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStudents, showInactive, query, sortKey, sortDir, filterGroup, currentUser])

  // ── 교육자 CRUD 핸들러 ──
  const activeEducators = data.educators.filter((e) => e.status !== 'inactive')
  const inactiveEducators = data.educators.filter((e) => e.status === 'inactive')
  const visibleEducators = showInactiveEducators ? data.educators : activeEducators

  const handleEducatorSubmit = async (form) => {
    if (educatorModal?.mode === 'edit') {
      await updateEducator(educatorModal.educator.id, form)
    } else {
      await createEducator(form)
    }
  }

  const handleEducatorStatus = async (educator, next) => {
    const confirmMsg = next === 'active'
      ? `${educator.name} 계정을 다시 활성화할까요? 로그인이 가능해집니다.`
      : `${educator.name} 계정을 비활성화할까요? 로그인이 차단되고 강사 배정 목록에서 빠집니다. 작성한 기록은 보존됩니다.`
    if (!window.confirm(confirmMsg)) return
    try {
      await setEducatorStatus(educator.id, next)
      setEducatorMenuId(null)
    } catch {
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  const handleChangeStatus = async (student, next) => {
    const label = STUDENT_STATUS_LABELS[next]
    const confirmMsg = next === 'active'
      ? `${student.name} 학생을 재원 상태로 되돌릴까요? 로그인과 다른 화면 표시가 다시 활성화됩니다.`
      : `${student.name} 학생을 '${label}' 상태로 변경할까요? 로그인이 막히고 매니저/통계 화면에서 숨겨지며, 센터 이용시간·등하원 시간표가 정리되고 예정된 예약이 취소됩니다.`
    if (!window.confirm(confirmMsg)) return
    try {
      const { cancelledBookings } = await setStudentStatus(student.id, next, { actorId: currentUser?.id })
      setMenuOpenId(null)
      if (cancelledBookings > 0) {
        alert(`예정된 예약 ${cancelledBookings}건을 취소했습니다.`)
      }
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
            buildDocument={buildPdf}
            label="학생 목록 보고서"
            disabled={visibleStudents.length === 0}
          />
        </div>
      </div>

      {/* ── 학생 목록 ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-500">
            학생 (재원 {activeStudents.length}명{nonActiveStudents.length > 0 ? ` / 그 외 ${nonActiveStudents.length}명` : ''})
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              퇴원·취소 포함
            </label>
            {!readOnly && (
              <>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-600 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                >
                  <ClipboardList size={14} />
                  과제 내기
                </button>
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-violet-600 text-violet-700 text-xs font-semibold hover:bg-violet-50"
                >
                  <MessageSquare size={14} />
                  피드백
                </button>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 text-xs font-semibold hover:bg-emerald-50"
                >
                  <Upload size={14} />
                  일괄 등록
                </button>
                <button
                  onClick={() => setModal({ mode: 'create' })}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  <Plus size={14} />
                  학생 추가
                </button>
              </>
            )}
          </div>
        </div>

        {/* 그룹 필터 + 검색바 */}
        <div className="mb-2 flex gap-2">
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
          >
            <option value="all">전체 그룹</option>
            {GROUP_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·학교·학년·반·담당 검색"
              className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <div className="min-w-[810px]">
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
            <span className="text-center" title="학습일지 첨부">일지</span>
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
              const isInactive = !isActiveStudent(s)
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
                          <span className="text-[10px] font-bold px-1 rounded text-gray-500 bg-gray-200">
                            {STUDENT_STATUS_LABELS[s.status] ?? '비활성'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 truncate block">
                        {s.groups?.[0] ? `${s.groups[0]} · ` : ''}{s.school || '학교 미입력'}{s.grade ? ` · ${s.grade}` : ''}{s.className ? ` ${s.className}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-center text-xs text-gray-500 truncate px-1">
                    {mgr ? mgr.name : <span className="text-orange-400">미배정</span>}
                  </span>
                  <span className="text-center text-[11px] text-gray-600 whitespace-nowrap">{formatPhone(s.phone) || '-'}</span>
                  <span className="text-center text-[11px] text-gray-600 whitespace-nowrap">{formatPhone(s.parentPhone) || '-'}</span>
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
                  {/* 학습일지 첨부 — 행 클릭(상세 이동)과 겹치므로 stopPropagation 필수 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setJournalStudentId(s.id)
                    }}
                    className="flex items-center justify-center gap-0.5 text-xs text-gray-600 hover:text-blue-600"
                    title="학습일지 첨부"
                  >
                    {(s.studyJournals?.length ?? 0) > 0 ? (
                      <>
                        <Paperclip size={12} />
                        {s.studyJournals.length}
                      </>
                    ) : (
                      '-'
                    )}
                  </button>
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
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <div className="px-3 py-0.5 text-[10px] text-gray-400">상태 변경</div>
                            {STUDENT_STATUS_OPTIONS
                              .filter((o) => o.value !== (s.status ?? 'active'))
                              .map((o) => (
                                <button
                                  key={o.value}
                                  onClick={() => handleChangeStatus(s, o.value)}
                                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {o.value === 'active' ? <UserCheck size={12} /> : <UserX size={12} />}
                                  {o.label}{o.value !== 'active' ? ' 처리' : ''}
                                </button>
                              ))}
                          </div>
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

      {/* ── 교육자 목록 (추가/수정/비활성/완전삭제 — admin 계정은 보호) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-500">
            교육자 ({activeEducators.length}명{inactiveEducators.length > 0 ? ` / 비활성 ${inactiveEducators.length}명` : ''})
          </h3>
          <div className="flex items-center gap-2">
            {inactiveEducators.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInactiveEducators}
                  onChange={(e) => setShowInactiveEducators(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                비활성 포함
              </label>
            )}
            {!readOnly && (
              <button
                onClick={() => setEducatorModal({ mode: 'create' })}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                <Plus size={14} />
                교육자 추가
              </button>
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] text-xs text-gray-400 font-semibold px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span>이름</span>
            <span className="w-28 text-center">소속</span>
            <span className="w-20 text-center">역할</span>
            <span className="w-14 text-right">담당</span>
            <span className="w-8"> </span>
          </div>
          {visibleEducators.map((e) => {
            const assignedCount = data.assignments.filter((a) => a.educatorId === e.id).length
            const groupLabel = e.groups?.length ? e.groups.join(', ') : '전체'
            const isInactive = e.status === 'inactive'
            const canManage = !readOnly && e.role !== 'admin'
            return (
              <div
                key={e.id}
                className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-3 py-2.5 border-b border-gray-50 last:border-0 ${
                  isInactive ? 'bg-gray-50/60 opacity-70' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-sm text-gray-800 truncate">{e.name}</span>
                      {isInactive && (
                        <span className="text-[10px] font-bold px-1 rounded text-gray-500 bg-gray-200">비활성</span>
                      )}
                    </div>
                    {e.role === 'instructor' && e.subject && (
                      <span className="text-xs text-gray-400 truncate block">{e.subject}</span>
                    )}
                  </div>
                </div>
                {readOnly ? (
                  <span className="w-28 text-center text-xs text-gray-500 truncate" title={groupLabel}>
                    {groupLabel}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setGroupEditTarget(e)}
                    className="w-28 text-center text-xs text-gray-500 truncate hover:text-emerald-600 hover:underline"
                    title={`${groupLabel} — 클릭해서 소속 편집`}
                  >
                    {groupLabel}
                  </button>
                )}
                <span className="w-20 text-center text-xs text-gray-500">{ROLE_LABELS[e.role] || e.role}</span>
                <span className="w-14 text-right text-sm font-bold text-emerald-600">
                  {e.role === 'manager' ? `${assignedCount}명` : '-'}
                </span>
                {canManage ? (
                  <div className="w-8 flex justify-end relative">
                    <button
                      onClick={() => setEducatorMenuId(educatorMenuId === e.id ? null : e.id)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500"
                      aria-label="교육자 메뉴"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {educatorMenuId === e.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setEducatorMenuId(null)} />
                        <div className="absolute right-0 top-7 z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[130px]">
                          <button
                            onClick={() => {
                              setEducatorModal({ mode: 'edit', educator: e })
                              setEducatorMenuId(null)
                            }}
                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Pencil size={12} /> 수정
                          </button>
                          <button
                            onClick={() => handleEducatorStatus(e, isInactive ? 'active' : 'inactive')}
                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            {isInactive ? <UserCheck size={12} /> : <UserX size={12} />}
                            {isInactive ? '활성화' : '비활성화'}
                          </button>
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <button
                              onClick={() => {
                                setEducatorDeleteTarget(e)
                                setEducatorMenuId(null)
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={12} /> 완전 삭제
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="w-8" aria-hidden />
                )}
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
          students={data.students}
          onSubmit={modal.mode === 'edit' ? handleEdit : handleCreate}
          onClose={() => setModal(null)}
        />
      )}

      {!readOnly && showParentModal && (
        <ParentManagementModal onClose={() => setShowParentModal(false)} />
      )}

      {!readOnly && showBulkModal && (
        <BulkStudentUploadModal onClose={() => setShowBulkModal(false)} />
      )}

      {!readOnly && showTaskModal && (
        <TaskFormModal
          students={activeStudents}
          onClose={() => setShowTaskModal(false)}
        />
      )}

      {!readOnly && showFeedbackModal && (
        <StudentFeedbackModal
          students={activeStudents}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {/* 학습일지 첨부 — viewer도 열람 가능(readOnly). 대상은 id로 들고 있어
          setStudentJournals 후에도 최신 studyJournals가 반영된 학생을 넘긴다. */}
      {journalStudentId && (
        <StudyJournalModal
          student={data.students.find((st) => st.id === journalStudentId)}
          readOnly={readOnly}
          onClose={() => setJournalStudentId(null)}
        />
      )}

      {!readOnly && groupEditTarget && (
        <EducatorGroupModal
          educator={groupEditTarget}
          onSave={(groups) => updateEducatorGroups(groupEditTarget.id, groups)}
          onClose={() => setGroupEditTarget(null)}
        />
      )}

      {!readOnly && educatorModal && (
        <EducatorFormModal
          mode={educatorModal.mode}
          initial={educatorModal.mode === 'edit' ? educatorModal.educator : undefined}
          onSubmit={handleEducatorSubmit}
          onClose={() => setEducatorModal(null)}
        />
      )}

      {!readOnly && educatorDeleteTarget && (
        <EducatorDeleteConfirmModal
          educator={educatorDeleteTarget}
          onConfirm={() => deleteEducator(educatorDeleteTarget.id)}
          onClose={() => setEducatorDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// 교육자 완전 삭제 확인 모달 — users 행 삭제는 FK CASCADE로 그 계정이 작성한
// 상담·수업 기록까지 지우므로, 이름을 직접 입력해야 삭제 버튼이 활성화된다.
function EducatorDeleteConfirmModal({ educator, onConfirm, onClose }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const matched = typed.trim() === educator.name

  const handleDelete = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      alert(err?.message ?? '삭제 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="교육자 완전 삭제" onClose={onClose} maxWidth="max-w-md">
      <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-700 leading-relaxed">
        <p className="font-bold mb-1">이 작업은 되돌릴 수 없습니다.</p>
        <p>
          <b>{educator.name}</b>({ROLE_LABELS[educator.role] || educator.role}) 계정과 함께
          이 계정이 작성한 <b>상담·수업 기록이 모두 삭제</b>됩니다.
          기록을 보존하려면 삭제 대신 '비활성화'를 사용하세요.
        </p>
      </div>
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">
          삭제하려면 이름(<span className="text-red-600">{educator.name}</span>)을 입력하세요
        </label>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
          placeholder={educator.name}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
        >
          취소
        </button>
        <button
          onClick={handleDelete}
          disabled={!matched || busy}
          className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? '삭제 중…' : '완전 삭제'}
        </button>
      </div>
    </ModalShell>
  )
}
