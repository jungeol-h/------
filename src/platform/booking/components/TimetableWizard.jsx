// 타임테이블 일괄 생성 마법사 (관리자·강사 공용) — 명세 5.2·5.3 + 2026-07-27 개선.
// 타임블럭 템플릿(A/B/C… — 요일·운영시간·휴식 프리셋, admin_config 저장)을 불러와
// 기간·강사만 고르면 되도록 한다 ("일정마다 매번 설정을 다시 해야 한다" 해소).
// 슬롯 단위(40분/20분)는 프로그램(slotMinutes)이 정한다.
// lockEducatorId: 강사 셀프 개설 모드 — 담당 강사를 본인으로 고정하고 배정된
// 프로그램만 노출. 생성 상태(작성중/즉시 예약공개)는 체크박스로 선택한다.

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import ModalShell from '../../components/common/ModalShell.jsx'
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

export default function TimetableWizard({ onClose, lockEducatorId = null }) {
  const { config, userNames, createSlotBatch, saveTimetableTemplates, actor } = useBooking()
  const isAdmin = actor.role === 'admin'
  const templates = config.templates ?? []

  // 강사 모드: 배정된 프로그램만 (관리자는 전체 활성 프로그램)
  const programs = useMemo(() => {
    const active = config.programs.filter((p) => p.active)
    if (!lockEducatorId) return active
    const mine = new Set(
      config.educators
        .filter((e) => e.educatorId === lockEducatorId && e.active)
        .map((e) => e.programId),
    )
    return active.filter((p) => mine.has(p.id))
  }, [config.programs, config.educators, lockEducatorId])

  const [form, setForm] = useState({
    programId: programs[0]?.id ?? '',
    educatorId: lockEducatorId ?? '',
    subjectId: '',
    from: todayStr(),
    to: addDaysStr(todayStr(), 27),
    weekdays: [1, 2, 3, 4, 5],
    dayStart: '16:00',
    dayEnd: '21:00',
    capacity: null,
    breakStart: '',
    breakEnd: '',
    excludeDates: '', // 휴무일 (쉼표 구분, 명세 5.2)
    publishNow: !!lockEducatorId, // 강사 셀프 개설은 즉시 공개가 기본
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

  const preview = useMemo(() => {
    if (!program) return []
    return generateSlots({
      from: form.from,
      to: form.to,
      weekdays: form.weekdays,
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
    })
  }, [program, form, excludeDates])

  const previewDays = useMemo(() => new Set(preview.map((s) => s.date)).size, [preview])

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
          from: form.from, to: form.to, weekdays: form.weekdays,
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

  if (lockEducatorId && programs.length === 0) {
    return (
      <ModalShell title="타임테이블 생성" onClose={onClose} maxWidth="max-w-xl">
        <p className="py-8 text-center text-sm text-gray-400">
          배정된 프로그램이 없습니다. 관리자에게 프로그램 배정을 요청해 주세요.
        </p>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="타임테이블 생성" onClose={onClose} maxWidth="max-w-xl">
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
        <label className="text-xs text-gray-500 col-span-2">
          프로그램
          <select value={form.programId} onChange={set('programId')} className={`${FIELD} w-full mt-1`}>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.slotMinutes}분)</option>)}
          </select>
        </label>
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
          시작일
          <input type="date" value={form.from} onChange={set('from')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          종료일
          <input type="date" value={form.to} onChange={set('to')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          운영 시작
          <input
            type="time"
            value={form.dayStart}
            onChange={(e) => { setAppliedTemplateId(null); set('dayStart')(e) }}
            className={`${FIELD} w-full mt-1`}
          />
        </label>
        <label className="text-xs text-gray-500">
          운영 종료
          <input
            type="time"
            value={form.dayEnd}
            onChange={(e) => { setAppliedTemplateId(null); set('dayEnd')(e) }}
            className={`${FIELD} w-full mt-1`}
          />
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
          checked={form.publishNow}
          onChange={(e) => setForm((f) => ({ ...f, publishNow: e.target.checked }))}
        />
        생성 즉시 예약공개 (미체크 시 작성중으로 생성 — 검토 후 공개)
      </label>

      <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        미리보기: <b>{previewDays}일 × 슬롯 {preview.length}개</b>가{' '}
        <b>{form.publishNow ? '예약공개' : '작성중'}</b> 상태로 생성됩니다.
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
