// 프로그램 등록·수정 모달 (관리자) — 명세 1.3·20.1: 시간 단위·정원·횟수 제한·
// 연속 허용·기한 기준·접수창·대상 그룹까지 전부 설정값. 소스코드 고정 금지.

import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { GROUP_OPTIONS } from '../../data/groups.js'
import { useBooking } from '../BookingContext.jsx'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

const SCOPE_OPTIONS = [
  { value: 'program', label: '프로그램 전체 합산' },
  { value: 'program_educator', label: '동일 강사별 합산' },
  { value: 'program_subject', label: '교과별 합산' },
]

export default function ProgramFormModal({ program, onClose }) {
  const { createProgram, updateProgram } = useBooking()
  const isEdit = Boolean(program)

  const [form, setForm] = useState({
    name: program?.name ?? '',
    slotMinutes: program?.slotMinutes ?? 20,
    defaultCapacity: program?.defaultCapacity ?? 1,
    dailyLimit: program?.dailyLimit ?? 1,
    dailyLimitScope: program?.dailyLimitScope ?? 'program',
    allowConsecutive: program?.allowConsecutive ?? true,
    allowGroup: program?.allowGroup ?? false,
    groupMin: program?.groupMin ?? 3,
    groupMax: program?.groupMax ?? 4,
    usesSubject: program?.usesSubject ?? false,
    requiresOpenPeriod: program?.requiresOpenPeriod ?? false,
    changeDeadlineType: program?.changeDeadlineType ?? 'minutes_before',
    changeDeadlineValue: program?.changeDeadlineValue ?? 60,
    bookingOpenLeadMinutes: program?.bookingOpenLeadMinutes ?? 60,
    bookingCloseLeadMinutes: program?.bookingCloseLeadMinutes ?? 60,
    targetGroupNames: program?.targetGroupNames ?? [],
    active: program?.active ?? true,
    sortOrder: program?.sortOrder ?? 0,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key, cast = (v) => v) => (e) => setForm((f) => ({ ...f, [key]: cast(e.target.value) }))
  const setCheck = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }))
  const toggleGroup = (g) => setForm((f) => ({
    ...f,
    targetGroupNames: f.targetGroupNames.includes(g)
      ? f.targetGroupNames.filter((x) => x !== g)
      : [...f.targetGroupNames, g],
  }))

  const submit = async () => {
    if (busy) return
    if (!form.name.trim()) {
      setError('프로그램명을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (isEdit) await updateProgram(program.id, form, program)
      else await createProgram(form)
      onClose()
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const num = (v) => Number(v) || 0

  return (
    <ModalShell title={isEdit ? '프로그램 수정' : '프로그램 등록'} onClose={onClose} maxWidth="max-w-xl">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 col-span-2">
          프로그램명
          <input type="text" value={form.name} onChange={set('name')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          시간 단위 (분)
          <input type="number" min="5" value={form.slotMinutes} onChange={set('slotMinutes', num)} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          기본 정원
          <input type="number" min="1" value={form.defaultCapacity} onChange={set('defaultCapacity', num)} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          하루 최대 예약 수
          <input type="number" min="1" value={form.dailyLimit} onChange={set('dailyLimit', num)} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          횟수 합산 기준
          <select value={form.dailyLimitScope} onChange={set('dailyLimitScope')} className={`${FIELD} w-full mt-1`}>
            {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          변경·취소 기한 기준
          <select value={form.changeDeadlineType} onChange={set('changeDeadlineType')} className={`${FIELD} w-full mt-1`}>
            <option value="minutes_before">시작 N분 전까지</option>
            <option value="days_before">상담일 N일 전까지</option>
          </select>
        </label>
        <label className="text-xs text-gray-500">
          기한 값 (N)
          <input type="number" min="0" value={form.changeDeadlineValue} onChange={set('changeDeadlineValue', num)} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          당일 접수 시작 (운영 시작 N분 전)
          <input type="number" min="0" value={form.bookingOpenLeadMinutes} onChange={set('bookingOpenLeadMinutes', num)} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          당일 접수 마감 (운영 종료 N분 전)
          <input type="number" min="0" value={form.bookingCloseLeadMinutes} onChange={set('bookingCloseLeadMinutes', num)} className={`${FIELD} w-full mt-1`} />
        </label>
      </div>

      <div className="space-y-1.5 text-sm text-gray-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.usesSubject} onChange={setCheck('usesSubject')} />
          교과 구분 사용 (국어·영어·수학 등)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!form.allowConsecutive} onChange={(e) => setForm((f) => ({ ...f, allowConsecutive: !e.target.checked }))} />
          연속예약 금지
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.allowGroup} onChange={setCheck('allowGroup')} />
          그룹상담 허용
        </label>
        {form.allowGroup && (
          <div className="flex items-center gap-2 pl-6 text-xs text-gray-500">
            그룹 규모
            <input type="number" min="2" value={form.groupMin} onChange={set('groupMin', num)} className={`${FIELD} w-16`} />
            ~
            <input type="number" min="2" value={form.groupMax} onChange={set('groupMax', num)} className={`${FIELD} w-16`} />
            명
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.requiresOpenPeriod} onChange={setCheck('requiresOpenPeriod')} />
          월 단위 사전예약 (오픈기간 설정 필요)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.active} onChange={setCheck('active')} />
          활성화
        </label>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">대상 그룹 (선택 없음 = 전체)</p>
        <div className="flex gap-2 flex-wrap">
          {GROUP_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGroup(g)}
              className={`px-3 h-8 rounded-full text-xs font-bold border ${
                form.targetGroupNames.includes(g)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '저장 중...' : '저장'}
      </button>
    </ModalShell>
  )
}
