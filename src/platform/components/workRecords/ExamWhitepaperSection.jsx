import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Paperclip } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import ExamKeySelect from '../examReports/ExamKeySelect.jsx'
import ExamAnalysisForm from './ExamAnalysisForm.jsx'
import ExamBestCaseForm from './ExamBestCaseForm.jsx'
import { GRADES } from '../../data/grades.js'
import { examKeyLabel, normalizeSchool, sameExamKey } from '../../utils/examTerms.js'
import { removeExamPapers } from '../../lib/examPaperFiles.js'
import { educatorDisplayName } from '../../utils/educatorName.js'
import { isActiveStudent } from '../../data/studentStatus.js'

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'

const dateOf = (iso) => (iso ?? '').slice(0, 10)
const byUpdatedDesc = (a, b) => ((a.updatedAt ?? '') < (b.updatedAt ?? '') ? 1 : -1)

function AnalysisTab({ readOnly }) {
  const { data, deleteExamAnalysis } = useData()
  const { currentUser } = useAuth()
  const [keyFilter, setKeyFilter] = useState(null)
  const [school, setSchool] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [modal, setModal] = useState(null) // { record?, notice? } | null
  const [formSeq, setFormSeq] = useState(0)

  const all = data.examAnalyses
  const schools = useMemo(() => {
    const set = new Set()
    data.students.forEach((s) => s.school && set.add(normalizeSchool(s.school)))
    all.forEach((a) => a.school && set.add(normalizeSchool(a.school)))
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [data.students, all])
  const subjects = useMemo(
    () => [...new Set(all.map((a) => a.subject))].sort((a, b) => a.localeCompare(b, 'ko')),
    [all]
  )

  const list = useMemo(
    () => all
      .filter((a) =>
        (!keyFilter || sameExamKey(a, keyFilter)) &&
        (!school || a.school === school) &&
        (!grade || a.grade === grade) &&
        (!subject || a.subject === subject))
      .sort(byUpdatedDesc),
    [all, keyFilter, school, grade, subject]
  )

  const canDelete = (a) =>
    !readOnly && (a.authorId === currentUser?.id || currentUser?.role === 'admin')

  const handleDelete = async (a) => {
    if (!window.confirm('이 시험지 분석을 삭제할까요?')) return
    try {
      await deleteExamAnalysis(a.id)
      removeExamPapers(a.attachments.map((f) => f.path))
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const switchToEdit = (record, notice) => {
    setFormSeq((n) => n + 1)
    setModal({ record, notice })
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-2 gap-3">
        <ExamKeySelect value={keyFilter} onChange={setKeyFilter} allowAll className="w-full" />
        <select value={school} onChange={(e) => setSchool(e.target.value)} className={fieldClass}>
          <option value="">전체 학교</option>
          {schools.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className={fieldClass}>
          <option value="">전체 학년</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>
          <option value="">전체 과목</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">
          시험지 분석
          <span className="ml-1.5 text-sm font-semibold text-gray-400">{list.length}건</span>
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setModal({})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:scale-95 transition"
          >
            <Plus size={14} />
            새 분석
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="text-center text-gray-400 py-12">시험지 분석이 없어요 📝</div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3">
              <button type="button" onClick={() => setModal({ record: a })} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-gray-900">
                  {a.school} · {a.grade} · {a.subject}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{examKeyLabel(a)}</p>
                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span>마지막 수정 {a.updatedByName || '-'} · {dateOf(a.updatedAt)}</span>
                  {a.attachments.length > 0 && (
                    <span className="inline-flex items-center gap-0.5"><Paperclip size={11} />{a.attachments.length}</span>
                  )}
                </p>
              </button>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!readOnly && (
                  <button type="button" onClick={() => setModal({ record: a })} className="p-1.5 text-gray-400 hover:text-blue-600" aria-label="수정">
                    <Pencil size={15} />
                  </button>
                )}
                {canDelete(a) && (
                  <button type="button" onClick={() => handleDelete(a)} className="p-1.5 text-gray-400 hover:text-red-500" aria-label="삭제">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ExamAnalysisForm
          key={`${modal.record?.id ?? 'new'}-${formSeq}`}
          record={modal.record}
          notice={modal.notice}
          initialKey={keyFilter ?? undefined}
          existing={all}
          schools={schools}
          readOnly={readOnly}
          onClose={() => setModal(null)}
          onSwitchToEdit={switchToEdit}
          onSaved={() => setModal(null)}
        />
      )}
    </div>
  )
}

function BestCaseTab({ readOnly }) {
  const { data, deleteExamBestCase } = useData()
  const { currentUser } = useAuth()
  const [keyFilter, setKeyFilter] = useState(null)
  const [authorId, setAuthorId] = useState('')
  const [modal, setModal] = useState(null)
  const [viewing, setViewing] = useState(null)

  const all = data.examBestCases
  const studentById = useMemo(() => new Map(data.students.map((s) => [s.id, s])), [data.students])
  const formStudents = useMemo(() => data.students.filter(isActiveStudent), [data.students])
  const authors = useMemo(() => {
    const ids = new Set(all.map((c) => c.authorId))
    return data.educators.filter((e) => ids.has(e.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
  }, [all, data.educators])

  const list = useMemo(
    () => all
      .filter((c) => (!keyFilter || sameExamKey(c, keyFilter)) && (!authorId || c.authorId === authorId))
      .sort(byUpdatedDesc),
    [all, keyFilter, authorId]
  )

  const canManage = (c) =>
    !readOnly && (c.authorId === currentUser?.id || currentUser?.role === 'admin')

  const handleDelete = async (c) => {
    if (!window.confirm('이 우수사례를 삭제할까요?')) return
    try {
      await deleteExamBestCase(c.id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const authorLabel = (c) => {
    const e = data.educators.find((x) => x.id === c.authorId)
    return e ? educatorDisplayName(e) : c.authorName || '-'
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-2 gap-3">
        <ExamKeySelect value={keyFilter} onChange={setKeyFilter} allowAll className="w-full" />
        <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={fieldClass}>
          <option value="">전체 강사</option>
          {authors.map((e) => <option key={e.id} value={e.id}>{educatorDisplayName(e)}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">
          우수사례
          <span className="ml-1.5 text-sm font-semibold text-gray-400">{list.length}건</span>
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setModal({})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:scale-95 transition"
          >
            <Plus size={14} />
            새 우수사례
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="text-center text-gray-400 py-12">우수사례가 없어요 🏅</div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const s = studentById.get(c.studentId)
            const open = viewing === c.id
            return (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => setViewing(open ? null : c.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-gray-900">
                      {s?.name ?? '(학생)'}
                      <span className="ml-1.5 text-xs font-medium text-gray-500">{s?.school} {s?.grade}</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {c.subject}{c.score && ` · ${c.score}`} · {examKeyLabel(c)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">작성 {authorLabel(c)}</p>
                  </button>
                  {canManage(c) && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => setModal({ record: c })} className="p-1.5 text-gray-400 hover:text-blue-600" aria-label="수정">
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => handleDelete(c)} className="p-1.5 text-gray-400 hover:text-red-500" aria-label="삭제">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {open && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-sm text-gray-700">
                    {c.prepPeriod && <p><span className="text-xs text-gray-400 mr-1.5">대비 기간</span>{c.prepPeriod}</p>}
                    <p className="whitespace-pre-wrap">{c.process}</p>
                    {c.keyPoint && (
                      <p className="whitespace-pre-wrap bg-emerald-50 rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-emerald-700 mr-1.5">성공 포인트</span>{c.keyPoint}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <ExamBestCaseForm
          record={modal.record}
          initialKey={keyFilter ?? undefined}
          students={formStudents}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
    </div>
  )
}

// 내신백서 메뉴 — [시험지 분석] [우수사례]. viewer는 열람 전용.
export default function ExamWhitepaperSection({ readOnly = false }) {
  const [tab, setTab] = useState('analysis')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {[['analysis', '시험지 분석'], ['best', '우수사례']].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-9 rounded-lg text-xs font-bold transition-colors ${
              tab === k ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === 'analysis' ? <AnalysisTab readOnly={readOnly} /> : <BestCaseTab readOnly={readOnly} />}
    </div>
  )
}
