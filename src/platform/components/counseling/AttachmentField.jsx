import { useRef } from 'react'
import { Paperclip, X, FileText } from 'lucide-react'
import { validatePdf, MAX_ATTACHMENTS, MAX_ATTACHMENT_MB, counselingFileUrl } from '../../lib/counselingFiles.js'

function sizeLabel(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`
}

// 업무보고 PDF 첨부 입력 — 작성/수정 폼 공용.
// existing: 저장된 첨부 메타 [{ path, name, size }] (수정 모드), onRemoveExisting(path)
// pending: 업로드 대기 File[], onChangePending(File[])
// 업로드는 저장 시점에 폼이 수행한다(여기선 선택·검증만).
export function AttachmentField({ existing = [], onRemoveExisting, pending = [], onChangePending }) {
  const inputRef = useRef(null)
  const total = existing.length + pending.length

  const handlePick = (e) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // 같은 파일 재선택 허용
    if (picked.length === 0) return
    const next = [...pending]
    for (const file of picked) {
      if (existing.length + next.length >= MAX_ATTACHMENTS) {
        alert(`첨부는 최대 ${MAX_ATTACHMENTS}개까지 가능해요.`)
        break
      }
      const problem = validatePdf(file)
      if (problem) {
        alert(`${file.name}: ${problem}`)
        continue
      }
      next.push(file)
    }
    onChangePending(next)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">파일 첨부 (PDF, 최대 {MAX_ATTACHMENTS}개 · 개당 {MAX_ATTACHMENT_MB}MB)</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={total >= MAX_ATTACHMENTS}
          className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 disabled:text-gray-300"
        >
          <Paperclip size={13} />
          PDF 추가
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handlePick}
          className="hidden"
        />
      </div>
      {(existing.length > 0 || pending.length > 0) && (
        <ul className="space-y-1">
          {existing.map((a) => (
            <li key={a.path} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <FileText size={13} className="text-red-400 flex-shrink-0" />
              <span className="text-xs text-gray-700 truncate flex-1">{a.name}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{sizeLabel(a.size)}</span>
              {onRemoveExisting && (
                <button type="button" onClick={() => onRemoveExisting(a.path)} className="p-0.5 text-gray-400 hover:text-red-500" aria-label="첨부 제거">
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
          {pending.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 bg-blue-50/60 rounded-lg px-2.5 py-1.5">
              <FileText size={13} className="text-blue-400 flex-shrink-0" />
              <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{sizeLabel(file.size)} · 업로드 예정</span>
              <button
                type="button"
                onClick={() => onChangePending(pending.filter((_, idx) => idx !== i))}
                className="p-0.5 text-gray-400 hover:text-red-500"
                aria-label="첨부 취소"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 저장된 기록 카드의 첨부 칩 — 클릭 시 새 탭에서 PDF 열람.
export function AttachmentChips({ attachments }) {
  if (!attachments?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attachments.map((a) => (
        <a
          key={a.path}
          href={counselingFileUrl(a.path)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5 hover:bg-red-100"
        >
          <FileText size={11} />
          {a.name}
        </a>
      ))}
    </div>
  )
}
