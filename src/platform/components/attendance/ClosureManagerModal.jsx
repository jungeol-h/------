// 휴무기간(방학·임시휴무) 관리 모달 — 출결 탭에서 열림 (2026-08 클라이언트 요청).
// 기간 등록/삭제와, 이미 잘못 생성된 자동 결석 기록·알림의 소급 정리를 담당한다.
// 휴무기간 자체의 자동 결석 판정 중단은 DB judge_attendance() 가드가 수행한다
// (scripts/add-center-closures.sql). 정리는 자동 생성분(source='auto'·미등원)만
// 지우고 수동 정정·실등원 기록은 보존한다 — centerClosureDomain 참고.

import { useState } from 'react'
import { Eraser, Trash2 } from 'lucide-react'
import ModalShell from '../common/ModalShell.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

const fieldClass =
  'w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300'

const fmtMD = (dateStr) => {
  const [, m, d] = (dateStr ?? '').split('-').map(Number)
  return m && d ? `${m}/${d}` : dateStr
}

export default function ClosureManagerModal({ onClose }) {
  const { currentUser } = useAuth()
  const { data, addCenterClosure, deleteCenterClosure, purgeClosureAbsences } = useData()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [label, setLabel] = useState('')
  const [purgeOnSave, setPurgeOnSave] = useState(true)
  const [busy, setBusy] = useState(false)

  const closures = [...data.centerClosures].sort((a, b) =>
    b.startDate.localeCompare(a.startDate))
  const rangeValid = startDate && endDate && endDate >= startDate

  const handleAdd = async () => {
    if (!rangeValid || busy) return
    setBusy(true)
    try {
      await addCenterClosure({
        startDate, endDate, label: label.trim(), createdBy: currentUser?.id ?? null,
      })
      if (purgeOnSave) {
        const count = await purgeClosureAbsences(startDate, endDate)
        alert(`휴무기간을 등록하고 자동 결석 기록 ${count}건을 삭제했습니다.\n(자동 생성분만 삭제되며 수동 정정·실등원 기록은 보존됩니다)`)
      }
      setStartDate('')
      setEndDate('')
      setLabel('')
    } catch (e) {
      console.warn('[ClosureManagerModal] 등록 실패', e)
      alert('휴무기간 등록에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (closure) => {
    if (busy) return
    if (!window.confirm(
      `'${closure.label || '휴무기간'}' (${fmtMD(closure.startDate)}~${fmtMD(closure.endDate)})을 삭제할까요?\n삭제하면 이 기간의 자동 결석 판정이 다시 동작합니다.`,
    )) return
    setBusy(true)
    try {
      await deleteCenterClosure(closure.id)
    } catch (e) {
      console.warn('[ClosureManagerModal] 삭제 실패', e)
      alert('휴무기간 삭제에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handlePurge = async (closure) => {
    if (busy) return
    if (!window.confirm(
      `${fmtMD(closure.startDate)}~${fmtMD(closure.endDate)} 기간의 자동 결석 기록·미등원 알림을 삭제할까요?\n자동 생성분만 삭제되며 수동 정정·실등원 기록은 보존됩니다.`,
    )) return
    setBusy(true)
    try {
      const count = await purgeClosureAbsences(closure.startDate, closure.endDate)
      alert(`자동 결석 기록 ${count}건을 삭제했습니다.\n(자동 생성분만 삭제되며 수동 정정·실등원 기록은 보존됩니다)`)
    } catch (e) {
      console.warn('[ClosureManagerModal] 결석기록 정리 실패', e)
      alert('결석 기록 정리에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="휴무기간 관리" onClose={onClose}>
      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl p-3">
        휴무기간에는 자동 결석 판정(pg_cron)이 중단됩니다. 이미 잘못 생성된 결석
        기록은 아래 &lsquo;기간 내 결석기록 정리&rsquo;로 삭제할 수 있습니다.
      </p>

      {/* 기존 휴무기간 목록 */}
      <div className="space-y-2">
        {closures.map((c) => (
          <div key={c.id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{c.label || '휴무기간'}</p>
              <p className="text-xs text-gray-500">{fmtMD(c.startDate)} ~ {fmtMD(c.endDate)}</p>
            </div>
            <button
              onClick={() => handlePurge(c)}
              disabled={busy}
              className="flex-shrink-0 px-2.5 py-2 bg-white border border-amber-200 rounded-xl text-[11px] font-bold text-amber-600 flex items-center gap-1 active:scale-95 transition-all disabled:opacity-40"
            >
              <Eraser size={13} />
              기간 내 결석기록 정리
            </button>
            <button
              onClick={() => handleDelete(c)}
              disabled={busy}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 disabled:opacity-40"
              aria-label="휴무기간 삭제"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {closures.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">등록된 휴무기간이 없습니다.</p>
        )}
      </div>

      {/* 추가 폼 */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <h4 className="text-sm font-bold text-gray-700">새 휴무기간 등록</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">이름</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 센터 방학"
            className={fieldClass}
          />
        </div>
        {startDate && endDate && !rangeValid && (
          <p className="text-xs text-red-500">종료일은 시작일과 같거나 늦어야 합니다.</p>
        )}
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={purgeOnSave}
            onChange={(e) => setPurgeOnSave(e.target.checked)}
          />
          기간 내 기존 자동 결석 기록·알림도 삭제
        </label>
        <button
          onClick={handleAdd}
          disabled={!rangeValid || busy}
          className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold active:scale-95 transition-all disabled:opacity-40"
        >
          {busy ? '처리 중...' : '휴무기간 등록'}
        </button>
      </div>
    </ModalShell>
  )
}
