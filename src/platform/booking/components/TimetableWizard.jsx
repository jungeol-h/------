// 특정 날짜·기간의 슬롯 일괄 생성 모달 (관리자·강사 공용) — 명세 5.2·5.3.
// "매주 반복"은 가용시간 규칙(AvailabilityRulesSection)이 담당하고, 이 모달은
// 날짜가 정해진 두 의도만 다룬다 (사용자 어휘 기준으로 진입점 분리, 2026-07-27):
//  - intent='dated'   특정 날짜(하루~짧은 기간)에 예약 시간 추가 — 즉시 공개 기본
//  - intent='prebook' 접수제(사전예약형) 프로그램의 슬롯 준비 — 작성중 생성 후
//                     검토·일괄 공개, 오픈기간과 세트 (관리자 전용 진입)
// 타임블럭 템플릿(요일·시간창 프리셋)을 공유하고, 슬롯 단위는 프로그램 소관.
// lockEducatorId: 강사 모드 — 본인 고정, 배정된 프로그램만.

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import ModalShell from '../../components/common/ModalShell.jsx'
import TimeField from '../../components/common/TimeField.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { makeId } from '../../context/dataModel.js'
import { addDaysStr } from '../bookingRules.js'
import { generateSlots } from '../slotGeneration.js'
import { useBooking } from '../BookingContext.jsx'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'
const WEEKDAYS = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' },
  { value: 4, label: '목' }, { value: 5, label: '금' }, { value: 6, label: '토' },
  { value: 0, label: '일' },
]

export default function TimetableWizard({
  onClose, lockEducatorId = null, intent = 'dated', lockProgramId = null,
}) {
  const { config, userNames, slots, createSlotBatch, saveTimetableTemplates, actor } = useBooking()
  const isAdmin = actor.role === 'admin'
  const templates = config.templates ?? []
  const isPrebook = intent === 'prebook'

  // 강사 모드: 배정된 프로그램만 / 접수제 모드: 사전예약형 프로그램만
  // lockProgramId: 프로그램 카드에서 진입 — 그 프로그램으로 고정
  const programs = useMemo(() => {
    let list = config.programs.filter((p) => p.active)
    if (lockProgramId) return list.filter((p) => p.id === lockProgramId)
    if (isPrebook) list = list.filter((p) => p.requiresOpenPeriod)
    if (!lockEducatorId) return list
    const mine = new Set(
      config.educators
        .filter((e) => e.educatorId === lockEducatorId && e.active)
        .map((e) => e.programId),
    )
    return list.filter((p) => mine.has(p.id))
  }, [config.programs, config.educators, lockEducatorId, isPrebook, lockProgramId])

  const [form, setForm] = useState({
    programId: programs[0]?.id ?? '',
    educatorId: lockEducatorId ?? '',
    subjectId: '',
    from: todayStr(),
    // dated: 하루가 기본 (기간으로 늘릴 수 있음) / prebook: 4주 배치가 기본
    to: isPrebook ? addDaysStr(todayStr(), 27) : todayStr(),
    weekdays: isPrebook ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6],
    dayStart: '16:00',
    dayEnd: '21:00',
    capacity: null,
    breakStart: '',
    breakEnd: '',
    excludeDates: '', // 휴무일 (쉼표 구분, 명세 5.2)
    publishNow: !isPrebook, // dated는 즉시 공개, prebook은 검토 후 공개가 기본
  })
  const [appliedTemplateId, setAppliedTemplateId] = useState(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const program = programs.find((p) => p.id === form.programId)
  const educatorOptions = config.educators.filter((e) => e.programId === form.programId && e.active)
  const subjectOptions = config.subjects.filter((s) => s.programId === form.programId && s.active)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setTime = (key) => (v) => setForm((f) => ({ ...f, [key]: v }))
  const toggleDay = (d) => {
    setAppliedTemplateId(null)
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d],
    }))
  }

  const applyTemplate = (t) => {
    setAppliedTemplateId(t.id)
    setForm((f) => ({
      ...f,
      weekdays: [...t.weekdays],
      dayStart: t.dayStart,
      dayEnd: t.dayEnd,
      breakStart: t.breakStart ?? '',
      breakEnd: t.breakEnd ?? '',
    }))
  }

  const handleSaveTemplate = async () => {
    const name = templateName.trim()
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      const next = [...templates, {
        id: makeId('tpl'),
        name,
        weekdays: [...form.weekdays],
        dayStart: form.dayStart,
        dayEnd: form.dayEnd,
        breakStart: form.breakStart,
        breakEnd: form.breakEnd,
      }]
      await saveTimetableTemplates(next)
      setTemplateName('')
      setSavingTemplate(false)
    } catch {
      setError('템플릿 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteTemplate = async (t) => {
    if (busy) return
    if (!window.confirm(`템플릿 "${t.name}"을 삭제할까요? 이미 생성된 슬롯에는 영향이 없습니다.`)) return
    setBusy(true)
    setError(null)
    try {
      await saveTimetableTemplates(templates.filter((x) => x.id !== t.id))
      if (appliedTemplateId === t.id) setAppliedTemplateId(null)
    } catch {
      setError('템플릿 삭제에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const excludeDates = useMemo(
    () => form.excludeDates.split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
    [form.excludeDates],
  )

  // 하루짜리는 요일 필터 무시 (generateSlots에서 빈 배열 = 전 요일)
  const effectiveWeekdays = useMemo(
    () => (form.from === form.to ? [] : form.weekdays),
    [form.from, form.to, form.weekdays],
  )

  // 담당 강사의 기존 슬롯(강사지정예약 포함, 취소 제외)과 겹치는 시간은 만들지
  // 않는다 — SQL 규칙 파생(_booking_generate_rule_slots)과 같은 의미론 (2026-07-30)
  const blocked = useMemo(
    () => (form.educatorId
      ? slots.filter((s) => s.educatorId === form.educatorId && s.status !== 'cancelled')
      : []),
    [slots, form.educatorId],
  )

  const preview = useMemo(() => {
    if (!program) return []
    return generateSlots({
      from: form.from,
      to: form.to,
      weekdays: effectiveWeekdays,
      dayStart: form.dayStart,
      dayEnd: form.dayEnd,
      slotMinutes: program.slotMinutes,
      capacity: Number(form.capacity) || program.defaultCapacity,
      educatorId: form.educatorId || null,
      subjectId: form.subjectId || null,
      breaks: form.breakStart && form.breakEnd
        ? [{ start: form.breakStart, end: form.breakEnd }]
        : [],
      excludeDates,
      blocked,
    })
  }, [program, form, excludeDates, effectiveWeekdays, blocked])

  const previewDays = useMemo(() => new Set(preview.map((s) => s.date)).size, [preview])

  // 겹침으로 제외된 슬롯 수 — 미리보기에 안내
  const blockedCount = useMemo(() => {
    if (!program || blocked.length === 0) return 0
    const without = generateSlots({
      from: form.from,
      to: form.to,
      weekdays: effectiveWeekdays,
      dayStart: form.dayStart,
      dayEnd: form.dayEnd,
      slotMinutes: program.slotMinutes,
      breaks: form.breakStart && form.breakEnd
        ? [{ start: form.breakStart, end: form.breakEnd }]
        : [],
      excludeDates,
    })
    return without.length - preview.length
  }, [program, form, excludeDates, effectiveWeekdays, blocked, preview])

  const submit = async () => {
    if (!program || busy) return
    if (preview.length === 0) {
      setError('생성될 슬롯이 없습니다. 입력값을 확인해 주세요.')
      return
    }
    setBusy(true)
    try {
      await createSlotBatch({
        programId: program.id,
        status: form.publishNow ? 'open' : 'draft',
        params: {
          from: form.from, to: form.to, weekdays: effectiveWeekdays,
          day_start: form.dayStart, day_end: form.dayEnd,
          slot_minutes: program.slotMinutes,
          educator_id: form.educatorId || null,
          subject_id: form.subjectId || null,
          exclude_dates: excludeDates,
          template_id: appliedTemplateId,
        },
        slots: preview,
      })
      onClose()
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const title = isPrebook ? '접수제 슬롯 준비' : '특정 날짜 예약시간 추가'

  if (programs.length === 0) {
    return (
      <ModalShell title={title} onClose={onClose} maxWidth="max-w-xl">
        <p className="py-8 text-center text-sm text-gray-400">
          {isPrebook
            ? '접수제(사전예약형) 프로그램이 없습니다. 프로그램 설정에서 사전예약을 켜 주세요.'
            : '배정된 프로그램이 없습니다. 관리자에게 프로그램 배정을 요청해 주세요.'}
        </p>
      </ModalShell>
    )
  }

  return (
    <ModalShell title={title} onClose={onClose} maxWidth="max-w-xl">
      {isPrebook && (
        <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
          접수제 슬롯은 <b>작성중</b>으로 만들어 검토한 뒤, 슬롯 목록에서 접수 시작에 맞춰
          일괄 <b>예약공개</b>로 전환합니다. 접수기간은 프로그램 메뉴의 예약 오픈기간에서 등록하세요.
        </p>
      )}
      {/* 타임블럭 템플릿 — 요일·운영시간·휴식 프리셋 */}
      <div>
        <p className="text-xs text-gray-500 mb-1">타임블럭 템플릿 (클릭하면 요일·시간이 채워집니다)</p>
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <span
              key={t.id}
              className={`inline-flex items-center rounded-full border text-[11px] font-bold overflow-hidden ${
                appliedTemplateId === t.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              <button
                type="button"
                onClick={() => applyTemplate(t)}
                className="px-2.5 h-7"
                title={`${t.dayStart}~${t.dayEnd}`}
              >
                {t.name}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(t)}
                  className={`pr-2 ${appliedTemplateId === t.id ? 'text-blue-200' : 'text-gray-300'} hover:text-red-500`}
                  aria-label={`템플릿 ${t.name} 삭제`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          {isAdmin && !savingTemplate && (
            <button
              type="button"
              onClick={() => setSavingTemplate(true)}
              className="px-2.5 h-7 rounded-full border border-dashed border-blue-300 text-blue-600 text-[11px] font-bold"
            >
              + 현재 설정을 템플릿으로
            </button>
          )}
        </div>
        {isAdmin && savingTemplate && (
          <div className="flex gap-1.5 mt-1.5">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="템플릿 이름 (예: C · 방학 오전형)"
              className={`${FIELD} flex-1`}
            />
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={busy || !templateName.trim()}
              className="px-3 h-10 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setSavingTemplate(false)}
              className="px-3 h-10 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold"
            >
              취소
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {lockProgramId ? (
          <p className="text-xs text-gray-500 col-span-2 pb-1">
            프로그램: <b className="text-gray-700">{program?.name}</b> ({program?.slotMinutes}분 단위)
          </p>
        ) : (
          <label className="text-xs text-gray-500 col-span-2">
            프로그램
            <select value={form.programId} onChange={set('programId')} className={`${FIELD} w-full mt-1`}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slotMinutes}분)</option>)}
            </select>
          </label>
        )}
        {lockEducatorId ? (
          <p className="text-xs text-gray-500 self-end pb-2">
            담당 강사: <b className="text-gray-700">{userNames[lockEducatorId]?.name ?? '나'}</b> (본인)
          </p>
        ) : (
          <label className="text-xs text-gray-500">
            담당 강사
            <select value={form.educatorId} onChange={set('educatorId')} className={`${FIELD} w-full mt-1`}>
              <option value="">미지정</option>
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
          날짜 (시작)
          <input type="date" value={form.from} onChange={set('from')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          날짜 (종료 — 하루면 시작과 동일)
          <input type="date" value={form.to} onChange={set('to')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          운영 시작
          <TimeField
            value={form.dayStart}
            onChange={(v) => { setAppliedTemplateId(null); setTime('dayStart')(v) }}
            className={`${FIELD} w-full mt-1`}
          />
        </label>
        <label className="text-xs text-gray-500">
          운영 종료
          <TimeField
            value={form.dayEnd}
            onChange={(v) => { setAppliedTemplateId(null); setTime('dayEnd')(v) }}
            className={`${FIELD} w-full mt-1`}
          />
        </label>
        <label className="text-xs text-gray-500">
          휴식 시작 (선택)
          <TimeField value={form.breakStart} onChange={setTime('breakStart')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          휴식 종료 (선택)
          <TimeField value={form.breakEnd} onChange={setTime('breakEnd')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          슬롯 정원 (기본 {program?.defaultCapacity ?? 1})
          <input type="number" min="1" value={form.capacity ?? ''} onChange={set('capacity')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500 col-span-2">
          휴무일 (선택 — 쉼표로 구분)
          <input
            type="text"
            value={form.excludeDates}
            onChange={set('excludeDates')}
            placeholder="예: 2026-07-30, 2026-08-14"
            className={`${FIELD} w-full mt-1`}
          />
        </label>
      </div>

      {/* 하루짜리 dated에는 요일 선택이 무의미 — 기간일 때만 노출 */}
      {form.from !== form.to && (
        <div>
          <p className="text-xs text-gray-500 mb-1">기간 중 운영 요일</p>
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
      )}

      {/* 접수제는 항상 작성중 생성 (검토 → 접수 시작에 일괄 공개) — 선택지 자체를 숨긴다 */}
      {!isPrebook && (
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={form.publishNow}
            onChange={(e) => setForm((f) => ({ ...f, publishNow: e.target.checked }))}
          />
          생성 즉시 예약공개 (미체크 시 작성중으로 생성 — 검토 후 공개)
        </label>
      )}

      <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        미리보기: <b>{previewDays}일 × 슬롯 {preview.length}개</b>가{' '}
        <b>{form.publishNow ? '예약공개' : '작성중'}</b> 상태로 생성됩니다.
        {blockedCount > 0 && (
          <span className="block mt-1 text-orange-500">
            강사의 기존 슬롯·지정 예약과 겹치는 {blockedCount}개는 만들지 않습니다.
          </span>
        )}
        {preview.length > 0 && (
          <span className="block mt-1 text-gray-400">
            예: {preview[0].date} {preview[0].startTime}~{preview[0].endTime} ...
          </span>
        )}
      </div>

      {!form.educatorId && (
        <p className="text-[11px] text-orange-500">
          담당 강사가 미지정입니다 — 생성 후 운영현황의 일정 이상 목록에 표시됩니다.
        </p>
      )}
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || preview.length === 0}
        className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
      >
        {busy ? '생성 중...' : `슬롯 ${preview.length}개 생성`}
      </button>
    </ModalShell>
  )
}
