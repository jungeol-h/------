import { useState, useCallback } from 'react'
import { Printer, Loader } from 'lucide-react'
import { reportError } from '../../lib/sentry.js'
import PdfPreviewModal from './PdfPreviewModal.jsx'

// 리포트 PDF 버튼 — 클릭 → 문서 생성 → 미리보기 모달 → [PDF 저장] (2026-07 클라이언트 요청).
// buildDocument: async () => ({ element, filename }) — 호출부가 리포트 컴포넌트를 동적 import해 조립한다.
export default function DownloadPdfButton({
  buildDocument,
  label = '보고서 PDF',
  disabled = false,
  className = '',
}) {
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null) // { blob, filename }

  const handleClick = useCallback(async () => {
    if (busy || disabled) return
    setBusy(true)
    try {
      const { element, filename } = await buildDocument()
      const { renderPdfBlob } = await import('../utils/downloadPdf.js')
      const blob = await renderPdfBlob(element)
      setPreview({ blob, filename })
    } catch (e) {
      reportError(e, { where: 'DownloadPdfButton' })
      // 에러 메시지를 노출해 사용자 제보만으로 원인을 좁힐 수 있게 한다
      const detail = e?.message ? ` (${e.message})` : ''
      alert(`PDF 생성에 실패했습니다. 다시 시도해 주세요.${detail}`)
    } finally {
      setBusy(false)
    }
  }, [busy, disabled, buildDocument])

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition ${className}`}
      >
        {busy ? (
          <Loader size={14} className="animate-spin" />
        ) : (
          <Printer size={14} />
        )}
        {busy ? '생성 중…' : label}
      </button>
      {preview && (
        <PdfPreviewModal
          blob={preview.blob}
          filename={preview.filename}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}
