import { ensureFontsRegistered } from '../config/fonts'

// react-pdf 문서 엘리먼트 → Blob. 미리보기 모달과 저장이 공유한다.
export async function renderPdfBlob(documentElement) {
  await ensureFontsRegistered()
  const { pdf } = await import('@react-pdf/renderer')
  return pdf(documentElement).toBlob()
}

// Blob → 파일 다운로드 트리거.
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 즉시 다운로드 (미리보기 없이) — 레거시 호환용 조합.
export async function downloadPdf(documentElement, filename) {
  const blob = await renderPdfBlob(documentElement)
  saveBlob(blob, filename)
}
