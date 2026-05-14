import { ensureFontsRegistered } from '../config/fonts'

export async function downloadPdf(documentElement, filename) {
  await ensureFontsRegistered()
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(documentElement).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
