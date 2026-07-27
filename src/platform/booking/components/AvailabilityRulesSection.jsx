// 강사 주간 가용시간 규칙 — 선언 패러다임의 관리 UI (강사·관리자 공용).
// "월·수 16~20시 코칭"처럼 반복 규칙을 저장하면 RPC가 내일~지평(기본 4주)
// 예약공개 슬롯을 유지하고 pg_cron이 매일 연장한다 (add-booking-availability.sql).
// educatorId를 주면 강사 모드(본인 고정), 없으면 관리자 모드(전체 강사).
// 개별 휴무는 슬롯 삭제가 아니라 규칙의 휴무일(exclude_dates)로 표현한다 —
// 규칙을 다시 저장하면 미예약 파생 슬롯이 재생성되기 때문.

import { useMemo, useState } from 'react'
import { CalendarClock, CalendarPlus, Pencil, Repeat, Trash2 } from 'lucide-react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { useBooking } from '../BookingContext.jsx'
import { bookingMessage } from '../bookingMessages.js'
import { generateSlots } from '../slotGeneration.js'
import TimetableWizard from './TimetableWizard.jsx'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'
const WEEKDAYS = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' },
  { value: 4, label: '목' }, { value: 5, label: '금' }, { value: 6, label: '토' },
  { value: 0, label: '일' },
]
const DAY_LABEL = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' }

// 주간 슬롯 수 미리보기 — 고정된 한 주(2026-01-05 월 ~ 01-11 일)에 규칙을 적용
function weeklySlotCount({ weekdays, dayStart, dayEnd, slotMinutes, breakStart, breakEnd }) {
  return generateSlots({
    from: '2026-01-05', to: '2026-01-11',
    weekdays, dayStart, dayEnd, slotMinutes,
    breaks: breakStart && breakEnd ? [{ start: breakStart, end: breakEnd }] : [],
  }).length
}

function RuleModal({ rule, educatorId, onClose }) {
  const { config, userNames, saveAvailabilityRule, actor } = useBooking()
  const isAdmin = actor.role === 'admin'
  const templates = config.templates ?? []

  // 강사 모드: 그 강사에게 배정된 프로그램만 / 관리자 모드: 전체 활성
  const programOptions = useMemo(() => {
    const active = config.programs.filter((p) => p.active)
    const owner = educatorId ?? rule?.educatorId
    if (isAdmin && !educatorId) return active
    const mine = new Set(
      config.educators.filter((e) => e.educatorId === owner && e.active).map((e) => e.programId),
    )
    return active.filter((p) => mine.has(p.id))
  }, [config.programs, config.educators, educatorId, rule, isAdmin])

  const [form, setForm] = useState(() => ({
    programId: rule?.programId ?? programOptions[0]?.id ?? '',
    educatorId: rule?.educatorId ?? educatorId ?? '',
    subjectId: rule?.subjectId ?? '',
    weekdays: rule?.weekdays ?? [1, 2, 3, 4, 5],
    dayStart: rule?.dayStart || '16:00',
    dayEnd: rule?.dayEnd || '21:00',
    breakStart: rule?.breakStart ?? '',
    breakEnd: rule?.breakEnd ?? '',
    capacity: rule?.capacity ?? '',
    excludeDates: (rule?.excludeDates ?? []).join(', '),
    active: rule?.active ?? true,
  }))
  const [busy, setBusy] = useState(false)
  const [failCode, setFailCode] = useState(null)

  const program = config.programs.find((p) => p.id === form.programId)
  const educatorOptions = config.educators.filter((e) => e.programId === form.programId && e.active)
  const subjectOptions = config.subjects.filter((s) => s.programId === form.programId && s.active)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggleDay = (d) => setForm((f) => ({
    ...f,
    weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d],
  }))

  const applyTemplate = (t) => setForm((f) => ({
    ...f,
    weekdays: [...t.weekdays],
    dayStart: t.dayStart,
    dayEnd: t.dayEnd,
    breakStart: t.breakStart ?? '',
    breakEnd: t.breakEnd ?? '',
  }))

  const excludeDates = useMemo(
    () => form.excludeDates.split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
    [form.excludeDates],
  )
  const perWeek = program ? weeklySlotCount({
    weekdays: form.weekdays, dayStart: form.dayStart, dayEnd: form.dayEnd,
    slotMinutes: program.slotMinutes, breakStart: form.breakStart, breakEnd: form.breakEnd,
  }) : 0

  const canSubmit = program && form.educatorId && form.weekdays.length > 0
    && form.dayStart < form.dayEnd

  const submit = async () => {
    if (!canSubmit || busy) return
    setBusy(true)
    setFailCode(null)
    try {
      const result = await saveAvailabilityRule({
        rule: {
          id: rule?.id,
          educatorId: form.educatorId,
          programId: form.programId,
          subjectId: form.subjectId || null,
          weekdays: form.weekdays,
          dayStart: form.dayStart,
          dayEnd: form.dayEnd,
          breakStart: form.breakStart,
          breakEnd: form.breakEnd,
          capacity: form.capacity === '' ? null : Number(form.capacity),
          excludeDates,
          active: form.active,
        },
      })
      if (result?.ok) onClose()
      else setFailCode(result?.code ?? 'ERROR')
    } catch {
      setFailCode('ERROR')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title={rule ? '가용시간 편집' : '가용시간 추가'} onClose={onClose}>
      {templates.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">타임블럭 템플릿 (클릭하면 요일·시간이 채워집니다)</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="px-2.5 h-7 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-600"
                title={`${t.dayStart}~${t.dayEnd}`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {programOptions.length === 0 && (
        <p className="text-xs text-orange-500 bg-orange-50 rounded-lg p-2">
          배정된 프로그램이 없습니다. 관리자에게 프로그램 배정을 요청해 주세요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 col-span-2">
          프로그램
          <select value={form.programId} onChange={set('programId')} className={`${FIELD} w-full mt-1`}>
            {programOptions.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slotMinutes}분)</option>)}
          </select>
        </label>
        {educatorId ? (
          <p className="text-xs text-gray-500 self-end pb-2 col-span-2">
            담당 강사: <b className="text-gray-700">{userNames[educatorId]?.name ?? '나'}</b> (본인)
          </p>
        ) : (
          <label className="text-xs text-gray-500">
            담당 강사
            <select value={form.educatorId} onChange={set('educatorId')} className={`${FIELD} w-full mt-1`}>
              <option value="">선택</option>
              {educatorOptions.map((e) => (
                <option key={e.id} value={e.educatorId}>{userNames[e.educatorId]?.name ?? e.educatorId}</option>
              ))}
            </select>
          </label>
        )}
        {program?.usesSubject && (
          <label className="text-xs text-gray-500">
            교과
            <select value={form.subjectId} onChange={set('subjectId')} className={`${FIELD} w-full mt-1`}>
              <option value="">미지정</option>
              {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs text-gray-500">
          운영 시작
          <input type="time" value={form.dayStart} onChange={set('dayStart')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          운영 종료
          <input type="time" value={form.dayEnd} onChange={set('dayEnd')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          휴식 시작 (선택)
          <input type="time" value={form.breakStart} onChange={set('breakStart')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          휴식 종료 (선택)
          <input type="time" value={form.breakEnd} onChange={set('breakEnd')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          슬롯 정원 (기본 {program?.defaultCapacity ?? 1})
          <input type="number" min="1" value={form.capacity} onChange={set('capacity')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          휴무일 (쉼표로 구분)
          <input
            type="text"
            value={form.excludeDates}
            onChange={set('excludeDates')}
            placeholder="예: 2026-07-30"
            className={`${FIELD} w-full mt-1`}
          />
        </label>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">운영 요일</p>
        <div className="flex gap-1.5">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`w-9 h-9 rounded-lg text-xs font-bold border ${
                form.weekdays.includes(d.value)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
        />
        활성 (끄면 예약 없는 미래 슬롯이 정리되고 자동 생성이 멈춥니다)
      </label>

      <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        저장하면 <b>주당 슬롯 {perWeek}개</b>가 내일부터 4주 앞까지 <b>예약공개</b> 상태로
        유지되고, 매일 자동으로 연장됩니다. 규칙을 수정하면 예약이 없는 파생 슬롯은
        새 규칙대로 다시 깔립니다 (예약된 시간은 보존).
      </div>

      {failCode && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode)}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !canSubmit}
        className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '저장 중...' : '저장하고 슬롯 반영'}
      </button>
    </ModalShell>
  )
}

// "예약 가능 시간"의 단일 홈 — 사용자 의도 기준 두 진입점만 노출한다:
// [+ 매주 반복](가용시간 규칙) / [+ 특정 날짜](일괄 생성 모달, intent='dated').
export default function AvailabilityRulesSection({ educatorId = null }) {
  const { config, availabilityRules, userNames, saveAvailabilityRule } = useBooking()
  const [editing, setEditing] = useState(null) // rule | 'new' | null
  const [datedOpen, setDatedOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  const rules = useMemo(() => {
    if (availabilityRules === null) return []
    return educatorId
      ? availabilityRules.filter((r) => r.educatorId === educatorId)
      : availabilityRules
  }, [availabilityRules, educatorId])

  const programName = (id) => config.programs.find((p) => p.id === id)?.name ?? id
  const subjectName = (id) => config.subjects.find((s) => s.id === id)?.name ?? ''

  const runRuleAction = async (rule, payload, failText) => {
    setBusyId(rule.id)
    setNotice(null)
    try {
      const result = await saveAvailabilityRule(payload)
      if (result?.ok) {
        const parts = []
        if (result.created > 0) parts.push(`슬롯 ${result.created}개 생성`)
        if (result.removed > 0) parts.push(`${result.removed}개 정리`)
        setNotice({ kind: 'ok', text: parts.length > 0 ? parts.join(' · ') : '반영되었습니다.' })
      } else {
        setNotice({ kind: 'error', text: bookingMessage(result?.code) })
      }
    } catch {
      setNotice({ kind: 'error', text: failText })
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = (rule) =>
    runRuleAction(rule, { rule: { ...rule, active: !rule.active } }, '상태 변경에 실패했습니다.')

  const remove = (rule) => {
    if (!window.confirm(
      `${programName(rule.programId)} 가용시간 규칙을 삭제할까요? 예약이 없는 미래 파생 슬롯도 함께 정리됩니다.`,
    )) return
    runRuleAction(rule, { rule: { id: rule.id }, del: true }, '삭제에 실패했습니다.')
  }

  if (availabilityRules === null) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-4 text-xs text-gray-400">
        주간 가용시간 기능 준비 중입니다 (scripts/add-booking-availability.sql 적용 필요).
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CalendarClock size={15} className="text-indigo-400" />
        <h4 className="text-sm font-bold text-gray-700">
          {educatorId ? '내 예약 가능 시간' : '강사 예약 가능 시간'}
        </h4>
        <span className="text-[11px] text-gray-400">매주 반복은 4주 앞까지 자동 유지·연장</span>
      </div>

      {notice && (
        <p className={`text-xs rounded-xl p-2.5 ${
          notice.kind === 'ok' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
        }`}>
          {notice.text}
        </p>
      )}

      {rules.map((rule) => (
        <div
          key={rule.id}
          className={`bg-white rounded-xl shadow-sm p-3 flex items-center gap-2 ${rule.active ? '' : 'opacity-60'}`}
        >
          <button
            type="button"
            onClick={() => toggleActive(rule)}
            disabled={busyId !== null}
            className={`flex-shrink-0 px-2 h-7 rounded-full text-[10px] font-bold border disabled:opacity-50 ${
              rule.active
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
            title="클릭하여 활성/비활성 전환"
          >
            {rule.active ? '자동 생성 중' : '중지됨'}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">
              {!educatorId && (
                <span className="text-gray-500 mr-1">{userNames[rule.educatorId]?.name ?? rule.educatorId} ·</span>
              )}
              {programName(rule.programId)}
              {rule.subjectId && <span className="ml-1 text-emerald-600">{subjectName(rule.subjectId)}</span>}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {rule.weekdays.map((d) => DAY_LABEL[d]).join('·')} {rule.dayStart}~{rule.dayEnd}
              {rule.breakStart && rule.breakEnd && ` (휴식 ${rule.breakStart}~${rule.breakEnd})`}
              {rule.capacity != null && ` · 정원 ${rule.capacity}`}
              {rule.excludeDates.length > 0 && ` · 휴무 ${rule.excludeDates.length}일`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(rule)}
            className="p-1.5 text-gray-400 hover:text-blue-600"
            aria-label="가용시간 편집"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => remove(rule)}
            disabled={busyId !== null}
            className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50"
            aria-label="가용시간 삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {rules.length === 0 && (
        <p className="text-[11px] text-gray-400 bg-white rounded-xl shadow-sm p-3">
          아직 등록된 반복 시간이 없습니다. 매주 같은 요일·시간에 예약을 받으려면
          &lsquo;매주 반복&rsquo;, 하루나 짧은 기간만 열려면 &lsquo;특정 날짜&rsquo;를 누르세요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="h-10 rounded-xl border border-dashed border-indigo-300 text-indigo-600 text-xs font-bold flex items-center justify-center gap-1"
        >
          <Repeat size={13} /> 매주 반복 추가
        </button>
        <button
          type="button"
          onClick={() => setDatedOpen(true)}
          className="h-10 rounded-xl border border-dashed border-blue-300 text-blue-600 text-xs font-bold flex items-center justify-center gap-1"
        >
          <CalendarPlus size={13} /> 특정 날짜 추가
        </button>
      </div>

      {editing && (
        <RuleModal
          rule={editing === 'new' ? null : editing}
          educatorId={educatorId}
          onClose={() => setEditing(null)}
        />
      )}
      {datedOpen && (
        <TimetableWizard
          intent="dated"
          lockEducatorId={educatorId}
          onClose={() => setDatedOpen(false)}
        />
      )}
    </div>
  )
}
