import { useState, useCallback } from 'react'
import { Printer, Loader } from 'lucide-react'
import { reportError } from '../../lib/sentry.js'

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
      reportError(e, { where: 'DownloadPdfButton' })
      // 에러 메시지를 노출해 사용자 제보만으로 원인을 좁힐 수 있게 한다
      const detail = e?.message ? ` (${e.message})` : ''
      alert(`PDF 생성에 실패했습니다. 다시 시도해 주세요.${detail}`)
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
