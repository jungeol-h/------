import { useState, useCallback } from 'react'
import { Printer, Loader } from 'lucide-react'

export default function DownloadPdfButton({
  onDownload,
  label = '보고서 PDF 다운로드',
  disabled = false,
  className = '',
}) {
  const [busy, setBusy] = useState(false)

  const handleClick = useCallback(async () => {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onDownload()
    } catch (e) {
      console.error('PDF export failed:', e)
      alert('PDF 생성에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }, [busy, disabled, onDownload])

  return (
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
  )
}
