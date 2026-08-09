// 학습일지 첨부 모달 — 관리자 학생 명단 '일지' 컬럼에서 열림 (2026-08 클라이언트 요청).
// 학생별 학습일지 파일(이미지/PDF)을 첨부·열람·삭제한다. 메타는 users.study_journals(jsonb),
// 실파일은 lib/studyJournalFiles.js('study-journals' 버킷). viewer는 readOnly로 열람만.
import { useState, useRef } from 'react'
import { Paperclip, X, FileText } from 'lucide-react'
import ModalShell from '../common/ModalShell.jsx'
import { AttachmentChips } from '../counseling/AttachmentField.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  validateStudyJournalFile, uploadStudyJournalFiles, studyJournalFileUrl,
  removeStudyJournalFiles, MAX_STUDY_JOURNALS, MAX_STUDY_JOURNAL_MB,
} from '../../lib/studyJournalFiles.js'

function sizeLabel(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`
}

export default function StudyJournalModal({ student, readOnly = false, onClose }) {
  const { setStudentJournals } = useData()
  const { currentUser } = useAuth()
  const inputRef = useRef(null)
  const [pending, setPending] = useState([]) // 업로드 대기 File[]
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total }

  const journals = student?.studyJournals ?? []
  const total = journals.length + pending.length

  const handlePick = (e) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // 같은 파일 재선택 허용
    if (picked.length === 0) return
    const next = [...pending]
    for (const file of picked) {
      if (journals.length + next.length >= MAX_STUDY_JOURNALS) {
        alert(`첨부는 최대 ${MAX_STUDY_JOURNALS}개까지 가능해요.`)
        break
      }
      const problem = validateStudyJournalFile(file)
      if (problem) {
        alert(`${file.name}: ${problem}`)
        continue
      }
      next.push(file)
    }
    setPending(next)
  }

  // 기존 첨부 삭제 — 실파일 정리(best-effort) 후 메타 갱신
  const handleRemove = async (path) => {
    if (!window.confirm('이 학습일지 첨부를 삭제할까요?')) return
    try {
      await removeStudyJournalFiles([path])
      await setStudentJournals(student.id, journals.filter((j) => j.path !== path))
    } catch {
      alert('첨부 삭제 중 오류가 발생했습니다.')
    }
  }

  // 대기 파일 업로드 → 기존 메타에 append 저장
  const handleSave = async () => {
    if (pending.length === 0 || busy) return
    setBusy(true)
    try {
      const uploaded = await uploadStudyJournalFiles(
        pending, currentUser?.id, (done, t) => setProgress({ done, total: t })
      )
      await setStudentJournals(student.id, [...journals, ...uploaded])
      setPending([])
    } catch {
      alert('학습일지 업로드 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <ModalShell title={`${student?.name ?? ''} 학습일지`} onClose={onClose} maxWidth="max-w-md">
      {/* 저장된 첨부 — 칩 클릭 시 새 탭 열람 */}
      <div>
        <p className="text-xs text-gray-500 font-semibold mb-1">첨부된 학습일지 ({journals.length}개)</p>
        {journals.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">첨부된 학습일지가 없습니다.</p>
        ) : readOnly ? (
          <AttachmentChips attachments={journals} fileUrl={studyJournalFileUrl} />
        ) : (
          <ul className="space-y-1">
            {journals.map((j) => (
              <li key={j.path} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                <FileText size={13} className="text-red-400 flex-shrink-0" />
                <a
                  href={studyJournalFileUrl(j.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gray-700 truncate flex-1 hover:text-blue-600 hover:underline"
                >
                  {j.name}
                </a>
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {sizeLabel(j.size)}{j.uploadedAt ? ` · ${j.uploadedAt.slice(0, 10)}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(j.path)}
                  disabled={busy}
                  className="p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-40"
                  aria-label="첨부 삭제"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 추가 업로드 (viewer 제외) */}
      {!readOnly && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              이미지/PDF · 최대 {MAX_STUDY_JOURNALS}개 · 개당 {MAX_STUDY_JOURNAL_MB}MB
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy || total >= MAX_STUDY_JOURNALS}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:text-gray-300"
            >
              <Paperclip size={13} />
              파일 추가
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
              multiple
              onChange={handlePick}
              className="hidden"
            />
          </div>
          {pending.length > 0 && (
            <ul className="space-y-1">
              {pending.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center gap-2 bg-blue-50/60 rounded-lg px-2.5 py-1.5">
                  <FileText size={13} className="text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{sizeLabel(file.size)} · 업로드 예정</span>
                  <button
                    type="button"
                    onClick={() => setPending(pending.filter((_, idx) => idx !== i))}
                    disabled={busy}
                    className="p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-40"
                    aria-label="첨부 취소"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || pending.length === 0}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            {busy
              ? `업로드 중…${progress ? ` (${progress.done}/${progress.total})` : ''}`
              : `저장${pending.length > 0 ? ` (${pending.length}개)` : ''}`}
          </button>
        </div>
      )}
    </ModalShell>
  )
}
