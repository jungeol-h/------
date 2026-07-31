// 학부모 홈 탭 (/parent/home) — 선택 자녀(child prop)의 오늘 요약 3카드:
// 등원 상태(classifyToday + 등/하원 시각), 학습 이행(todo 완료/전체 + 학습시간), 마인드 기록 합계.

import { CalendarCheck, BookOpen, Heart } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { classifyToday } from '../../context/selectors/attendance.js'
import { actualMinutes } from '../../context/selectors/learningRecords.js'
import { toDateStr } from '../../utils/dateUtils.js'
import { formatMinutes } from '../student/learningTabLogic.js'
import NoticeFeedCard from '../../components/common/NoticeFeedCard.jsx'

const STATUS_LABELS = {
  checked_out: { label: '하원 완료', color: 'text-gray-600 bg-gray-100' },
  early_leave: { label: '조퇴', color: 'text-amber-700 bg-amber-100' },
  present: { label: '등원', color: 'text-emerald-700 bg-emerald-100' },
  late: { label: '지각', color: 'text-orange-700 bg-orange-100' },
  absent: { label: '결석', color: 'text-red-700 bg-red-100' },
  not_arrived: { label: '등원 전', color: 'text-gray-500 bg-gray-100' },
  waiting: { label: '등원 전', color: 'text-gray-500 bg-gray-100' },
  no_schedule: { label: '오늘 예정 없음', color: 'text-gray-400 bg-gray-50' },
}

function fmtTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ParentHomeTab({ child }) {
  const { data } = useData()
  const now = new Date()
  const today = toDateStr(now)
  const dow = now.getDay()
  const studentId = child.id

  // ① 오늘 등원 상태
  const record = data.attendanceRecords.find(
    (r) => r.studentId === studentId && r.date === today
  ) ?? null
  const schedule = data.attendanceSchedules.find(
    (s) => s.studentId === studentId && s.dayOfWeek === dow
  ) ?? null
  const status = classifyToday({ record, schedule, now })
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.no_schedule
  const checkIn = fmtTime(record?.checkInAt)
  const checkOut = fmtTime(record?.checkOutAt)

  // ② 오늘 학습 이행 — 오늘 todo 완료/전체 + 오늘 학습시간
  const todayTodos = data.todoItems.filter(
    (t) => t.studentId === studentId && t.date === today
  )
  const doneTodos = todayTodos.filter((t) => t.done).length
  const todayMinutes = data.learningRecords
    .filter((r) => r.studentId === studentId && r.date === today)
    .reduce((sum, r) => sum + actualMinutes(r), 0)

  // ③ 오늘 마인드
  const todayMind = data.mindRecords.filter(
    (r) => r.studentId === studentId && r.date === today
  )
  const mindTotal = todayMind.reduce(
    (sum, r) => sum + (r.mood ?? 0) + (r.motivation ?? 0) + (r.confidence ?? 0),
    0
  )

  return (
    <div className="py-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{child.name} 오늘</h2>
        <p className="text-xs text-gray-500 mt-0.5">{today}</p>
      </div>

      {/* 알림 칸 — 자녀 선택과 무관한 계정 단위 데이터 */}
      <NoticeFeedCard audience="parent" />

      {/* ① 등원 상태 카드 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <CalendarCheck size={18} className="text-rose-500" />
          <h3 className="text-sm font-bold text-gray-700">오늘 등원</h3>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          <div className="text-right text-xs text-gray-500 space-y-0.5">
            <p>등원 {checkIn ?? '-'}</p>
            <p>하원 {checkOut ?? '-'}</p>
          </div>
        </div>
      </section>

      {/* ② 학습 이행 카드 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={18} className="text-blue-500" />
          <h3 className="text-sm font-bold text-gray-700">오늘 학습</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">계획 이행</p>
            <p className="text-2xl font-bold text-blue-600">
              {doneTodos}<span className="text-sm font-normal text-gray-400">/{todayTodos.length}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">학습시간</p>
            <p className="text-2xl font-bold text-emerald-600">{formatMinutes(todayMinutes)}</p>
          </div>
        </div>
      </section>

      {/* ③ 마인드 카드 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Heart size={18} className="text-pink-500" />
          <h3 className="text-sm font-bold text-gray-700">오늘 마인드</h3>
        </div>
        {todayMind.length > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">오늘 기록 완료</span>
            <span className="text-lg font-bold text-pink-600">
              합계 {mindTotal > 0 ? `+${mindTotal}` : mindTotal}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">오늘 마인드 기록이 아직 없습니다.</p>
        )}
      </section>
    </div>
  )
}
