// 출결 탭 (매니저·관리자 공용, wide 레이아웃) — LMS식 구성:
// 긴급 알림 → 날짜별 현황(◀▶ 이동, 요약 타일·필터·명단 테이블) + 시간대별 현황(타임라인)
// → 센터 이용시간 관리(명단·엑셀·설정·학생 수정).
// 지난 날짜의 미등원(등록명단에 있는데 기록 없음)은 센터 이용시간 등록 기준으로
// 분류한다 — 클라이언트 확정(2026-07-19). 기록 조회 윈도는 fetcher의 최근 60일.
// 등·하원 시간표는 이용시간의 파생물이라 별도 편집 UI가 없다 — 이용시간 저장 시
// RPC가 자동 갱신한다 (scripts/add-center-hours.sql v2).
// 판정(지각/조퇴/결석)은 서버가 하고, 여기서는 결과 표시와 수동 정정만 한다.
// 매니저는 담당(배정) 학생만, 관리자(admin)는 전체 active 학생을 대상으로 한다.

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Siren, X, MonitorSmartphone, FileSpreadsheet,
  CalendarRange, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock3,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { supabase } from '../../lib/supabase.js'
import AttendanceExcelModal from '../../components/attendance/AttendanceExcelModal.jsx'
import TodayAttendancePanel from '../../components/attendance/TodayAttendancePanel.jsx'
import TodayTimeline from '../../centerHours/TodayTimeline.jsx'
import CenterHoursSection from '../../centerHours/CenterHoursSection.jsx'
import { useCenterHours } from '../../centerHours/useCenterHours.js'
import {
  getDailyAttendanceBoard,
  getUnresolvedAttendanceNotifications,
  dayLabel,
} from '../../context/selectors/attendance.js'
import { todayStr, toDateStr, daysAgoStr } from '../../utils/dateUtils.js'

const STATUS_OPTIONS = [
  { value: 'present', label: '등원' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
]

const NOTI_PREVIEW = 4 // 긴급 알림 접힘 상태에서 보여줄 개수

const hhmm = (iso) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '')

export default function AttendanceTab() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'
  // 감독관(viewer)은 관리자와 같은 전체 범위를 열람하되 쓰기 액션은 숨긴다
  const isViewer = currentUser?.role === 'viewer'
  const seeAll = isAdmin || isViewer
  const {
    data, updateAttendance,
    resolveAttendanceNotification, resolveAllAttendanceNotifications,
    ingestAttendanceNotification,
  } = useData()
  const centerHours = useCenterHours()

  // Realtime — cron이 만든 긴급 알림을 열려 있는 화면에 즉시 반영
  useEffect(() => {
    const channel = supabase
      .channel('attendance-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_notifications' },
        (payload) => ingestAttendanceNotification(payload.new)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ingestAttendanceNotification])

  const notifications = useMemo(
    () => getUnresolvedAttendanceNotifications(data, { educatorId: currentUser?.id, all: seeAll }),
    [data, currentUser?.id, seeAll]
  )

  // 조회 날짜 — 기본 오늘, ◀▶로 과거 이동 (기록 fetch 윈도인 60일까지)
  const [dateStr, setDateStr] = useState(todayStr)
  const isToday = dateStr === todayStr()
  const minDateStr = daysAgoStr(60)
  const shiftDate = (delta) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const next = toDateStr(new Date(y, m - 1, d + delta))
    if (next > todayStr() || next < minDateStr) return
    setDateStr(next)
  }

  // 예정 기준 = 센터 이용시간 등록명단. 아직 못 불러왔으면 시간표로 대체(null)
  const centerHoursReady =
    !centerHours.state.loading && !centerHours.state.error && !centerHours.state.migrationNeeded
  const board = useMemo(
    () => getDailyAttendanceBoard(data, {
      educatorId: currentUser?.id,
      all: seeAll,
      dateStr,
      registrations: centerHoursReady ? centerHours.registrations : null,
    }),
    [data, currentUser?.id, seeAll, dateStr, centerHoursReady, centerHours.registrations]
  )

  const myStudents = useMemo(() => {
    if (seeAll) {
      return data.students
        .filter((s) => (s.status ?? 'active') === 'active')
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    }
    const ids = new Set(
      data.assignments.filter((a) => a.educatorId === currentUser?.id).map((a) => a.studentId)
    )
    return data.students.filter((s) => ids.has(s.id))
  }, [data.assignments, data.students, currentUser?.id, seeAll])

  const [editModal, setEditModal] = useState(null) // { student, record }
  const [excelOpen, setExcelOpen] = useState(false)
  const [notiExpanded, setNotiExpanded] = useState(false)
  const [notiBusy, setNotiBusy] = useState(false)

  const [vy, vm, vd] = dateStr.split('-').map(Number)
  const viewDow = new Date(vy, vm - 1, vd).getDay()
  const visibleNotis = notiExpanded ? notifications : notifications.slice(0, NOTI_PREVIEW)

  const handleResolveAll = async () => {
    setNotiBusy(true)
    try {
      await resolveAllAttendanceNotifications(notifications.map((n) => n.id))
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setNotiBusy(false)
    }
  }

  return (
    <div className="py-6 space-y-8">
      {/* 긴급 알림 */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Siren size={16} className="text-red-500" />
            <span className="text-red-500 font-bold text-sm">긴급 확인 필요</span>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {notifications.length}
            </span>
            {!isViewer && (
              <button
                onClick={handleResolveAll}
                disabled={notiBusy}
                className="ml-auto px-3 py-1.5 bg-white border border-red-200 rounded-xl text-xs font-bold text-red-600 active:scale-95 transition-all disabled:opacity-40"
              >
                전체 확인 ({notifications.length}건)
              </button>
            )}
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {visibleNotis.map((n) => (
              <div key={n.id} className="bg-red-50 border-2 border-red-300 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-700 truncate">{n.message}</p>
                  <p className="text-[11px] text-red-400 mt-0.5">{n.date} · {hhmm(n.createdAt)}</p>
                </div>
                {!isViewer && (
                  <button
                    onClick={() => resolveAttendanceNotification(n.id).catch(() => {})}
                    className="flex-shrink-0 px-3 py-2 bg-white border border-red-200 rounded-xl text-xs font-bold text-red-600 active:scale-95 transition-all"
                  >
                    확인
                  </button>
                )}
              </div>
            ))}
          </div>
          {notifications.length > NOTI_PREVIEW && (
            <button
              onClick={() => setNotiExpanded((v) => !v)}
              className="w-full py-2 text-xs font-bold text-red-400 flex items-center justify-center gap-1"
            >
              {notiExpanded
                ? <>접기 <ChevronUp size={13} /></>
                : <>외 {notifications.length - NOTI_PREVIEW}건 더 보기 <ChevronDown size={13} /></>}
            </button>
          )}
        </div>
      )}

      {/* 헤더: 조회 날짜 이동(◀▶·달력·오늘 복귀) + 상단 액션 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 mr-auto">
          <button
            onClick={() => shiftDate(-1)}
            disabled={dateStr <= minDateStr}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white active:scale-95 transition-all disabled:opacity-30"
            aria-label="이전 날짜"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-bold text-gray-900 whitespace-nowrap">
            {vm}월 {vd}일 ({dayLabel(viewDow)}) 출결
          </h2>
          <button
            onClick={() => shiftDate(1)}
            disabled={isToday}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white active:scale-95 transition-all disabled:opacity-30"
            aria-label="다음 날짜"
          >
            <ChevronRight size={18} />
          </button>
          <input
            type="date"
            value={dateStr}
            min={minDateStr}
            max={todayStr()}
            onChange={(e) => { if (e.target.value) setDateStr(e.target.value) }}
            className="ml-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            aria-label="조회 날짜 선택"
          />
          {!isToday && (
            <button
              onClick={() => setDateStr(todayStr())}
              className="ml-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold active:scale-95 transition-all"
            >
              오늘
            </button>
          )}
        </div>
        <button
          onClick={() => setExcelOpen(true)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <FileSpreadsheet size={15} className="text-emerald-500" />
          출결 엑셀
        </button>
        {!isViewer && (
          <button
            onClick={() => navigate(isAdmin ? '/admin/kiosk' : '/manager/kiosk')}
            className="px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <MonitorSmartphone size={15} />
            키오스크 열기
          </button>
        )}
      </div>

      <AttendanceExcelModal open={excelOpen} onClose={() => setExcelOpen(false)} />

      {/* 날짜별 현황 (명단 테이블) + 시간대별 타임라인 */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-2">
          {!isToday && (
            <p className="text-[11px] text-gray-400">
              지난 날짜 조회 — 미등원은 센터 이용시간 등록명단 기준(기록 없는 예정 학생)입니다.
            </p>
          )}
          <TodayAttendancePanel
            board={board}
            isToday={isToday}
            onEditRecord={isViewer ? null : (payload) => setEditModal(payload)}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock3 size={15} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-gray-700">
              {isToday ? '오늘 시간대별 현황' : '시간대별 현황'}
            </h3>
          </div>
          {centerHours.state.loading ? (
            <CenterHoursLoading />
          ) : centerHours.state.migrationNeeded ? (
            <p className="bg-white rounded-2xl shadow-sm p-5 text-center text-sm text-gray-400">
              센터 이용시간 마이그레이션이 아직 적용되지 않았습니다.
            </p>
          ) : centerHours.state.error ? (
            <CenterHoursError onRetry={centerHours.reload} />
          ) : (
            <TodayTimeline
              registrations={centerHours.registrations}
              board={board}
              dateStr={dateStr}
            />
          )}
        </div>
      </div>

      {/* 센터 이용시간 관리 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={15} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-gray-700">센터 이용시간 · 시간대별 명단</h3>
        </div>
        {centerHours.state.loading ? (
          <CenterHoursLoading />
        ) : centerHours.state.migrationNeeded ? (
          <p className="bg-white rounded-2xl shadow-sm p-5 text-center text-sm text-gray-400">
            센터 이용시간 마이그레이션(scripts/add-center-hours.sql)이 아직 적용되지 않았습니다.
          </p>
        ) : centerHours.state.error ? (
          <CenterHoursError onRetry={centerHours.reload} />
        ) : (
          <CenterHoursSection
            role={currentUser?.role}
            allStudents={data.students}
            editableStudents={myStudents}
            registrations={centerHours.registrations}
            config={centerHours.config}
            reload={centerHours.reload}
            readOnly={isViewer}
          />
        )}
      </div>

      {/* 수동 정정 모달 */}
      {editModal && (
        <CorrectionModal
          student={editModal.student}
          record={editModal.record}
          onClose={() => setEditModal(null)}
          onSave={updateAttendance}
        />
      )}
    </div>
  )
}

function CenterHoursLoading() {
  return (
    <p className="bg-white rounded-2xl shadow-sm p-5 text-center text-sm text-gray-300">
      이용시간 데이터 불러오는 중...
    </p>
  )
}

// 센터 이용시간 데이터 로드 실패 안내 (마이그레이션 미적용과 구분)
function CenterHoursError({ onRetry }) {
  return (
    <p className="bg-white rounded-2xl shadow-sm p-5 text-center text-sm text-gray-400">
      센터 이용시간 데이터를 불러오지 못했습니다.
      <button onClick={onRetry} className="ml-2 text-indigo-500 font-bold">다시 시도</button>
    </p>
  )
}

// 출결 수동 정정 — 병결 처리 등 (source='manual'로 기록됨)
function CorrectionModal({ student, record, onClose, onSave }) {
  const [status, setStatus] = useState(record.status)
  const [note, setNote] = useState(record.note ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(record.id, { status, note })
      onClose()
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">{student.name} 출결 정정</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                status === opt.value
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : 'border-gray-100 text-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="사유 메모 (예: 병결 확인)"
          rows={2}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium">
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-bold active:scale-95 transition-all disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
