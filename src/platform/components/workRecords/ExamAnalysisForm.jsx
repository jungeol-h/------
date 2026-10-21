import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import ModalShell from '../common/ModalShell.jsx'
import TimeField from '../common/TimeField.jsx'
import ExamKeySelect from '../examReports/ExamKeySelect.jsx'
import { AttachmentField } from '../counseling/AttachmentField.jsx'
import { SUBJECTS } from '../../data/subjects.js'
import { GRADES } from '../../data/grades.js'
import { defaultExamKey, normalizeSchool, sameExamKey } from '../../utils/examTerms.js'
import {
  validateExamPaper, uploadExamPapers, removeExamPapers, MAX_EXAM_PAPER_MB,
} from '../../lib/examPaperFiles.js'

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-500'

const LEVELS = ['상', '중', '하']
const QUESTION_TYPES = ['주관식', '객관식', '서·논술형', '혼합']
const OTHER = '__other'

const emptySections = () => ({
  typeAnalysis: '',
  diffHigh: { items: '', count: '' },
  diffMid: { items: '', count: '' },
  diffLow: { items: '', count: '' },
  diffBasis: '',
  hardest: { no: '', points: '', concept: '', summary: '', reason: '', solution: '' },
  prep: { priority: '', materials: '', practice: '' },
  wrongNote: '',
})

function mergeSections(s = {}) {
  const e = emptySections()
  return {
    ...e, ...s,
    diffHigh: { ...e.diffHigh, ...s.diffHigh },
    diffMid: { ...e.diffMid, ...s.diffMid },
    diffLow: { ...e.diffLow, ...s.diffLow },
    hardest: { ...e.hardest, ...s.hardest },
    prep: { ...e.prep, ...s.prep },
  }
}

const norm = (v) => (v ?? '').trim()

function SectionTitle({ no, children }) {
  return (
    <h4 className="text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
      {no && <span className="text-blue-600 mr-1.5">{no}</span>}{children}
    </h4>
  )
}

// 내신 시험지 분석 보고서 작성/수정 모달. record 있으면 수정.
// notice: 상위에서 중복 감지로 수정 모드 전환 시 띄우는 안내문.
export default function ExamAnalysisForm({
  record, initialKey, existing = [], schools = [], readOnly = false, notice = '',
  onClose, onSwitchToEdit, onSaved,
}) {
  const { data, addExamAnalysis, updateExamAnalysis, refetchExamAnalysis } = useData()
  const { currentUser } = useAuth()
  const isEdit = !!record
  const [key, setKey] = useState(() =>
    record ? { examYear: record.examYear, semester: record.semester, examType: record.examType }
      : (initialKey ?? defaultExamKey()))
  const [school, setSchool] = useState(record?.school ?? '')
  const [grade, setGrade] = useState(record?.grade ?? '')
  const [subjectSel, setSubjectSel] = useState(() =>
    !record ? '' : SUBJECTS.includes(record.subject) ? record.subject : OTHER)
  const [subjectEtc, setSubjectEtc] = useState(() =>
    record && !SUBJECTS.includes(record.subject) ? record.subject : '')
  const [examDate, setExamDate] = useState(record?.examDate ?? '')
  const [startTime, setStartTime] = useState(record?.startTime ?? '')
  const [endTime, setEndTime] = useState(record?.endTime ?? '')
  const [publisher, setPublisher] = useState(record?.publisher ?? '')
  const [totalQuestions, setTotalQuestions] = useState(record?.totalQuestions ?? '')
  const [difficulty, setDifficulty] = useState(record?.difficulty ?? '')
  const [questionTypes, setQuestionTypes] = useState(record?.questionTypes ?? [])
  const [scope, setScope] = useState(record?.scope ?? '')
  const [sec, setSec] = useState(() => mergeSections(record?.sections))
  const [existingAtt, setExistingAtt] = useState(record?.attachments ?? [])
  const [pending, setPending] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(notice)

  const subject = subjectSel === OTHER ? norm(subjectEtc) : subjectSel
  const author = data.educators.find((e) => e.id === record?.authorId)

  // 새 폼에서 키 필드가 바뀌어 기존 분석과 겹치면 수정 모드로 전환
  const checkDup = (next) => {
    if (isEdit || readOnly) return
    const k = next.key ?? key
    const sc = normalizeSchool(next.school ?? school)
    const gr = next.grade ?? grade
    const sj = next.subject ?? subject
    if (!sc || !gr || !sj) return
    const hit = existing.find((a) =>
      a.school === sc && a.grade === gr && a.subject === sj && sameExamKey(a, k))
    if (hit) onSwitchToEdit?.(hit, '이미 작성된 분석이 있어 불러왔어요')
  }

  const setH = (field) => (e) => setSec((s) => ({ ...s, hardest: { ...s.hardest, [field]: e.target.value } }))
  const setP = (field) => (e) => setSec((s) => ({ ...s, prep: { ...s.prep, [field]: e.target.value } }))
  const setD = (name, field) => (e) =>
    setSec((s) => ({ ...s, [name]: { ...s[name], [field]: e.target.value } }))
  const setS = (field) => (e) => setSec((s) => ({ ...s, [field]: e.target.value }))
  const toggleType = (t) =>
    setQuestionTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const canSave = !readOnly && !saving && normalizeSchool(school) && grade && subject

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setMsg('')
    let uploaded = []
    try {
      if (pending.length > 0) uploaded = await uploadExamPapers(pending, currentUser?.id)
      const attachments = [...existingAtt, ...uploaded]
      const body = {
        school: normalizeSchool(school), grade, subject,
        examYear: key.examYear, semester: key.semester, examType: key.examType,
        examDate: examDate || null, startTime, endTime,
        publisher: norm(publisher),
        totalQuestions: totalQuestions === '' ? null : Number(totalQuestions),
        difficulty, questionTypes, scope: norm(scope),
        sections: sec, attachments,
        updatedBy: currentUser?.id, updatedByName: currentUser?.name,
      }
      if (isEdit) {
        await updateExamAnalysis(record.id, { ...body, updatedAt: new Date().toISOString() })
        const kept = new Set(existingAtt.map((a) => a.path))
        removeExamPapers((record.attachments ?? []).filter((a) => !kept.has(a.path)).map((a) => a.path))
      } else {
        await addExamAnalysis({ ...body, authorId: currentUser?.id })
      }
      onSaved?.()
    } catch (err) {
      if (uploaded.length) removeExamPapers(uploaded.map((a) => a.path))
      if (err?.code === 'DUPLICATE') {
        const hit = await refetchExamAnalysis({
          school: normalizeSchool(school), grade, subject,
          examYear: key.examYear, semester: key.semester, examType: key.examType,
        }).catch(() => null)
        if (hit) onSwitchToEdit?.(hit, '이미 작성된 분석이 있어 불러왔어요')
        else setMsg('이미 작성된 분석이 있어요. 목록을 새로고침해 확인해주세요.')
      }
      // 그 외 실패는 전역 Toast
    } finally {
      setSaving(false)
    }
  }

  const ta = (value, onChange, rows = 3, placeholder = '') => (
    <textarea value={value} onChange={onChange} rows={rows} disabled={readOnly}
      placeholder={placeholder} className={`${fieldClass} w-full resize-none`} />
  )
  const label = (t) => <label className="text-xs text-gray-500 mb-1 block">{t}</label>

  return (
    <ModalShell title={isEdit ? '시험지 분석 수정' : '새 시험지 분석'} onClose={onClose} maxWidth="max-w-2xl">
      {msg && <div className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-xl px-3 py-2">{msg}</div>}
      <p className="text-[11px] text-gray-400 -mt-2">NAVI 내신 백서 강사용 · 내신 시험지 분석 보고서</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          {label('시험')}
          <ExamKeySelect value={key} className="w-full"
            onChange={(k) => { if (readOnly || !k) return; setKey(k); checkDup({ key: k }) }} />
        </div>
        <div>
          {label('학교명')}
          <input list="exam-school-list" value={school} disabled={readOnly}
            onChange={(e) => setSchool(e.target.value)}
            onBlur={() => { setSchool(normalizeSchool(school)); checkDup({ school: normalizeSchool(school) }) }}
            placeholder="예: 안동중" className={`${fieldClass} w-full`} />
          <datalist id="exam-school-list">
            {schools.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div>
          {label('학년')}
          <select value={grade} disabled={readOnly}
            onChange={(e) => { setGrade(e.target.value); checkDup({ grade: e.target.value }) }}
            className={`${fieldClass} w-full`}>
            <option value="">선택</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          {label('과목')}
          <div className="flex gap-2">
            <select value={subjectSel} disabled={readOnly}
              onChange={(e) => {
                setSubjectSel(e.target.value)
                if (e.target.value !== OTHER) checkDup({ subject: e.target.value })
              }}
              className={`${fieldClass} flex-1 min-w-0`}>
              <option value="">선택</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value={OTHER}>기타</option>
            </select>
            {subjectSel === OTHER && (
              <input value={subjectEtc} disabled={readOnly} placeholder="과목명"
                onChange={(e) => setSubjectEtc(e.target.value)}
                onBlur={() => checkDup({ subject: norm(subjectEtc) })}
                className={`${fieldClass} flex-1 min-w-0`} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          {label('시험 일자')}
          <input type="date" value={examDate} disabled={readOnly} onChange={(e) => setExamDate(e.target.value)} className={`${fieldClass} w-full`} />
        </div>
        <div>
          {label('시작')}
          <TimeField value={startTime} onChange={setStartTime} className={`${fieldClass} w-full`} />
        </div>
        <div>
          {label('종료')}
          <TimeField value={endTime} onChange={setEndTime} className={`${fieldClass} w-full`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          {label('작성 강사')}
          <div className={`${fieldClass} w-full bg-gray-50 text-gray-600 truncate`}>
            {isEdit ? (author?.name ?? '-') : (currentUser?.name ?? '-')}
          </div>
          {isEdit && record.updatedByName && (
            <p className="text-[10px] text-gray-400 mt-0.5">마지막 수정 {record.updatedByName}</p>
          )}
        </div>
        <div>
          {label('출판사')}
          <input value={publisher} disabled={readOnly} onChange={(e) => setPublisher(e.target.value)} className={`${fieldClass} w-full`} />
        </div>
        <div>
          {label('총 문항 수')}
          <input type="number" min="0" value={totalQuestions} disabled={readOnly}
            onChange={(e) => setTotalQuestions(e.target.value)} className={`${fieldClass} w-full`} />
        </div>
        <div>
          {label('난이도')}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
            {LEVELS.map((l) => (
              <button key={l} type="button" disabled={readOnly}
                onClick={() => setDifficulty(difficulty === l ? '' : l)}
                className={`h-8 rounded-lg text-xs font-bold ${difficulty === l ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {label('문항 유형 (복수 선택)')}
        <div className="flex flex-wrap gap-1.5">
          {QUESTION_TYPES.map((t) => (
            <button key={t} type="button" disabled={readOnly} onClick={() => toggleType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                questionTypes.includes(t) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        {label('시험범위')}
        {ta(scope, (e) => setScope(e.target.value), 2)}
      </div>

      <SectionTitle no="01">출제 경향과 문항 분석</SectionTitle>
      <div>
        {label('문제 유형 분석')}
        {ta(sec.typeAnalysis, setS('typeAnalysis'), 4, '주요 유형 · 핵심 개념 · 해당 문항 및 배점 · 출제 특징')}
      </div>
      <div>
        {label('문항 난이도 분석')}
        <div className="space-y-2">
          {[['상', 'diffHigh'], ['중', 'diffMid'], ['하', 'diffLow']].map(([l, name]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-6 text-sm font-bold text-gray-700 text-center">{l}</span>
              <input value={sec[name].items} disabled={readOnly} placeholder="문항 번호 (예: 18, 21, 서술형 2)"
                onChange={setD(name, 'items')} className={`${fieldClass} flex-1 min-w-0`} />
              <input type="number" min="0" value={sec[name].count} disabled={readOnly} placeholder="개수"
                onChange={setD(name, 'count')} className={`${fieldClass} w-20`} />
            </div>
          ))}
        </div>
      </div>
      <div>
        {label('판단 근거')}
        {ta(sec.diffBasis, setS('diffBasis'), 3)}
      </div>

      <SectionTitle no="02">가장 어려운 문제 소개</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <div>
          {label('문항 번호')}
          <input value={sec.hardest.no} disabled={readOnly} onChange={setH('no')} className={`${fieldClass} w-full`} />
        </div>
        <div>
          {label('배점')}
          <input value={sec.hardest.points} disabled={readOnly} onChange={setH('points')} className={`${fieldClass} w-full`} />
        </div>
      </div>
      <div>{label('핵심 개념')}<input value={sec.hardest.concept} disabled={readOnly} onChange={setH('concept')} className={`${fieldClass} w-full`} /></div>
      <div>{label('문제 요약')}{ta(sec.hardest.summary, setH('summary'), 3)}</div>
      <div>{label('어려운 이유')}{ta(sec.hardest.reason, setH('reason'), 3)}</div>
      <div>{label('핵심 풀이')}{ta(sec.hardest.solution, setH('solution'), 3)}</div>

      <SectionTitle no="03">효과적인 대비와 오답 지도</SectionTitle>
      <div>{label('효과적인 대비 방법 · 우선 학습 내용')}{ta(sec.prep.priority, setP('priority'), 3)}</div>
      <div>{label('활용할 자료')}{ta(sec.prep.materials, setP('materials'), 2)}</div>
      <div>{label('구체적인 실천 방법')}{ta(sec.prep.practice, setP('practice'), 3)}</div>
      <div>
        {label('오답노트 작성법')}
        {ta(sec.wrongNote, setS('wrongNote'), 4, '오답 원인 → 핵심 개념 → 풀이 재구성 → 재풀이 — 이 시험의 특징을 반영한 작성 순서와 확인 방법을 적습니다.')}
      </div>

      <SectionTitle>시험지 첨부</SectionTitle>
      {readOnly ? null : (
        <AttachmentField
          existing={existingAtt}
          onRemoveExisting={(path) => setExistingAtt((prev) => prev.filter((a) => a.path !== path))}
          pending={pending}
          onChangePending={setPending}
          accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
          validate={validateExamPaper}
          kindLabel="이미지/PDF"
          maxCount={10}
          maxMb={MAX_EXAM_PAPER_MB}
        />
      )}
      {readOnly && existingAtt.length === 0 && <p className="text-xs text-gray-400">첨부 없음</p>}

      {!readOnly && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={!canSave}
            className="py-2.5 px-6 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <CheckCheck size={16} />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}
    </ModalShell>
  )
}
