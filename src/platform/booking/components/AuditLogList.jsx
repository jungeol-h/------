// 감사이력 열람 (관리자) — 명세 19. 조회 전용: 이 화면에도, 앱 어디에도
// booking_audit_logs를 수정·삭제하는 경로는 없다.

import { useCallback, useEffect, useState } from 'react'
import { todayStr } from '../../utils/dateUtils.js'
import { addDaysStr } from '../bookingRules.js'
import { useBooking } from '../BookingContext.jsx'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

const ENTITY_LABELS = {
  reservation: '예약', slot: '슬롯', record: '상담기록',
  program: '프로그램', subject: '교과', educator: '강사배정', open_period: '오픈기간',
}
const ACTION_LABELS = {
  create: '등록', change: '변경', cancel: '취소', update: '수정', delete: '삭제',
  attendance: '출결 처리', attendance_overdue: '출결 기한초과 처리',
  group_assign: '그룹 배정', slot_edit: '슬롯 편집', status_change: '상태 전환',
}

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AuditLogList() {
  const { fetchAuditLogs, userNames } = useBooking()
  const [filters, setFilters] = useState({
    entityType: '',
    overrideOnly: false,
    from: addDaysStr(todayStr(), -14),
    to: todayStr(),
  })
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchAuditLogs({
        entityType: filters.entityType || undefined,
        overrideOnly: filters.overrideOnly || undefined,
        from: filters.from ? `${filters.from}T00:00:00` : undefined,
        to: filters.to || undefined,
      })
      setLogs(rows)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [fetchAuditLogs, filters])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className={FIELD} />
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className={FIELD} />
        <select
          value={filters.entityType}
          onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
          className={FIELD}
        >
          <option value="">전체 대상</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={filters.overrideOnly}
            onChange={(e) => setFilters((f) => ({ ...f, overrideOnly: e.target.checked }))}
          />
          예외 처리만
        </label>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              className="w-full bg-white rounded-xl shadow-sm p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-800">
                  [{ENTITY_LABELS[log.entityType] ?? log.entityType}] {ACTION_LABELS[log.action] ?? log.action}
                  {log.isOverride && <span className="ml-1 text-[10px] text-purple-500">예외</span>}
                </p>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{fmt(log.createdAt)}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {userNames[log.actorId]?.name ?? log.actorId} ({log.actorRole})
                {log.reason ? ` · 사유: ${log.reason}` : ''}
              </p>
              {expanded === log.id && (
                <div className="mt-2 space-y-1">
                  {log.beforeData && (
                    <pre className="text-[10px] bg-gray-50 rounded-lg p-2 overflow-x-auto text-gray-500">
                      변경 전: {JSON.stringify(log.beforeData, null, 1)}
                    </pre>
                  )}
                  {log.afterData && (
                    <pre className="text-[10px] bg-gray-50 rounded-lg p-2 overflow-x-auto text-gray-500">
                      변경 후: {JSON.stringify(log.afterData, null, 1)}
                    </pre>
                  )}
                </div>
              )}
            </button>
          ))}
          {logs.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">이력이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
