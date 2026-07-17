// 출결 탭 (매니저·관리자 공용) — 긴급 알림 배너 · 오늘 현황판 · 요일별 시간표 편집 · 키오스크 진입.
// 판정(지각/조퇴/결석)은 서버가 하고, 여기서는 결과 표시와 수동 정정만 한다.
// 매니저는 담당(배정) 학생만, 관리자(admin)는 전체 active 학생을 대상으로 한다.

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Siren, X, CheckCheck, MonitorSmartphone, CalendarClock, Pencil, Copy, FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { supabase } from '../../lib/supabase.js'
import AttendanceExcelModal from '../../components/attendance/AttendanceExcelModal.jsx'
import {
  getTodayAttendanceBoard,
  getUnresolvedAttendanceNotifications,
  getWeeklySchedule,
  dayLabel,
} from '../../context/selectors/attendance.js'

// 현황판 그룹 표시 순서·라벨·색 (미등원·결석을 먼저 강조)
const BOARD_GROUPS = [
  { key: 'not_arrived', label: '미등원', chip: 'bg-red-100 text-red-700', card: 'bg-red-50 border-red-200' },
  { key: 'absent', label: '결석', chip: 'bg-red-100 text-red-700', card: 'bg-red-50 border-red-200' },
  { key: 'late', label: '지각', chip: 'bg-yellow-100 text-yellow-700', card: 'bg-yellow-50 border-yellow-200' },
  { key: 'present', label: '등원', chip: 'bg-emerald-100 text-emerald-700', card: 'bg-white border-gray-100' },
  { key: 'early_leave', label: '조퇴', chip: 'bg-orange-100 text-orange-700', card: 'bg-orange-50 border-orange-200' },
  { key: 'checked_out', label: '하원', chip: 'bg-blue-100 text-blue-700', card: 'bg-white border-gray-100' },
  { key: 'waiting', label: '등원 전', chip: 'bg-gray-100 text-gray-500', card: 'bg-white border-gray-100' },
  { key: 'no_schedule', label: '오늘 예정 없음', chip: 'bg-gray-100 text-gray-400', card: 'bg-white border-gray-100' },
]

const STATUS_OPTIONS = [
  { value: 'present', label: '등원' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
]

const hhmm = (iso) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '')

export default function AttendanceTab() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'
  const {
    data, saveSchedule, updateAttendance,
    resolveAttendanceNotification, ingestAttendanceNotification,
  } = useData()

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
    () => getUnresolvedAttendanceNotifications(data, { educatorId: currentUser?.id, all: isAdmin }),
    [data, currentUser?.id, isAdmin]
  )
  const board = useMemo(
    () => getTodayAttendanceBoard(data, { educatorId: currentUser?.id, all: isAdmin }),
    [data, currentUser?.id, isAdmin]
  )

  const myStudents = useMemo(() => {
    if (isAdmin) {
      return data.students
        .filter((s) => (s.status ?? 'active') === 'active')
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    }
    const ids = new Set(
      data.assignments.filter((a) => a.educatorId === currentUser?.id).map((a) => a.studentId)
    )
    return data.students.filter((s) => ids.has(s.id))
  }, [data.assignments, data.students, currentUser?.id, isAdmin])

  const [editModal, setEditModal] = useState(null) // { student, record }
  const [scheduleStudentId, setScheduleStudentId] = useState('')
  const [excelOpen, setExcelOpen] = useState(false)

  return (
    <div className="py-6 space-y-6">
      {/* 긴급 알림 */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Siren size={16} className="text-red-500" />
            <span className="text-red-500 font-bold text-sm">긴급 확인 필요</span>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {notifications.length}
            </span>
          </div>
          {notifications.map((n) => (
            <div key={n.id} className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-700">{n.message}</p>
                <p className="text-[11px] text-red-400 mt-0.5">{n.date} · {hhmm(n.createdAt)}</p>
              </div>
              <button
                onClick={() => resolveAttendanceNotification(n.id).catch(() => {})}
                className="flex-shrink-0 px-3 py-2 bg-white border border-red-200 rounded-xl text-xs font-bold text-red-600 active:scale-95 transition-all"
              >
                확인
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 키오스크 진입 */}
      <button
        onClick={() => navigate(isAdmin ? '/admin/kiosk' : '/manager/kiosk')}
        className="w-full bg-indigo-500 text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all"
      >
        <MonitorSmartphone size={20} />
        등·하원 키오스크 열기
      </button>

      {/* 출결 엑셀 추출 */}
      <button
        onClick={() => setExcelOpen(true)}
        className="w-full bg-emerald-500 text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all"
      >
        <FileSpreadsheet size={20} />
        출결 엑셀 추출
      </button>

      <AttendanceExcelModal open={excelOpen} onClose={() => setExcelOpen(false)} />

      {/* 오늘 현황판 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">오늘 출결 현황</h3>
        <div className="space-y-4">
          {BOARD_GROUPS.map(({ key, label, chip, card }) => {
            const entries = board[key] ?? []
            if (entries.length === 0) return null
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${chip}`}>{label}</span>
                  <span className="text-xs text-gray-400">{entries.length}명</span>
                </div>
                {entries.map(({ student, record, schedule }) => (
                  <div
                    key={student.id}
                    className={`rounded-2xl border p-3 flex items-center gap-3 ${card}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{student.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {schedule && `예정 ${schedule.arrivalTime}~${schedule.departureTime}`}
                        {record?.checkInAt && ` · 등원 ${hhmm(record.checkInAt)}`}
                        {record?.checkOutAt && ` · 하원 ${hhmm(record.checkOutAt)}`}
                        {record?.note && ` · ${record.note}`}
                      </p>
                    </div>
                    {record && (
                      <button
                        onClick={() => setEditModal({ student, record })}
                        className="flex-shrink-0 p-2 text-gray-300 hover:text-gray-500"
                        aria-label="출결 정정"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
          {BOARD_GROUPS.every(({ key }) => (board[key] ?? []).length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">
              {isAdmin ? '학생이 없습니다' : '담당 학생이 없습니다'}
            </p>
          )}
        </div>
      </div>

      {/* 시간표 편집 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock size={16} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-gray-700">등·하원 시간표</h3>
        </div>
        <select
          value={scheduleStudentId}
          onChange={(e) => setScheduleStudentId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">학생을 선택하세요</option>
          {myStudents.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
          ))}
        </select>
        {scheduleStudentId && (
          <ScheduleEditor
            key={scheduleStudentId}
            studentId={scheduleStudentId}
            data={data}
            onSave={saveSchedule}
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

// 요일 7칸 시간표 편집기 — key=studentId 로 학생 변경 시 리마운트
function ScheduleEditor({ studentId, data, onSave }) {
  const [week, setWeek] = useState(() =>
    getWeeklySchedule(data, studentId).map((s) => ({
      enabled: !!s,
      arrivalTime: s?.arrivalTime ?? '15:00',
      departureTime: s?.departureTime ?? '19:00',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const setDay = (i, patch) => {
    setWeek((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  // 첫 등원 요일의 시간을 나머지 등원 요일 전체에 복사
  const copyToAll = () => {
    const src = week.find((d) => d.enabled)
    if (!src) return
    setWeek((prev) => prev.map((d) =>
      d.enabled ? { ...d, arrivalTime: src.arrivalTime, departureTime: src.departureTime } : d
    ))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const days = week
        .map((d, dayOfWeek) => ({ ...d, dayOfWeek }))
        .filter((d) => d.enabled && d.arrivalTime && d.departureTime)
        .map(({ dayOfWeek, arrivalTime, departureTime }) => ({ dayOfWeek, arrivalTime, departureTime }))
      await onSave({ studentId, days })
      setSavedAt(Date.now())
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      {/* 월(1)~토(6) → 일(0) 순으로 표시 */}
      {[1, 2, 3, 4, 5, 6, 0].map((i) => {
        const d = week[i]
        return (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setDay(i, { enabled: !d.enabled })}
              className={`w-9 h-9 rounded-xl text-sm font-bold flex-shrink-0 transition-all ${
                d.enabled ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-300'
              }`}
            >
              {dayLabel(i)}
            </button>
            {d.enabled ? (
              <>
                <input
                  type="time"
                  value={d.arrivalTime}
                  onChange={(e) => setDay(i, { arrivalTime: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-lg p-2 text-sm min-w-0"
                />
                <span className="text-gray-300 text-xs flex-shrink-0">~</span>
                <input
                  type="time"
                  value={d.departureTime}
                  onChange={(e) => setDay(i, { departureTime: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-lg p-2 text-sm min-w-0"
                />
              </>
            ) : (
              <span className="flex-1 text-xs text-gray-300 pl-1">등원 안 함</span>
            )}
          </div>
        )
      })}
      <div className="flex gap-2 pt-1">
        <button
          onClick={copyToAll}
          className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          <Copy size={14} /> 전 요일 복사
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 bg-indigo-500 text-white rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-40"
        >
          {saving ? '저장 중...' : '시간표 저장'}
        </button>
      </div>
      {savedAt && !saving && (
        <p className="text-[11px] text-emerald-600 text-center flex items-center justify-center gap-1">
          <CheckCheck size={12} /> 저장되었습니다
        </p>
      )}
    </div>
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
