import { toPng } from 'html-to-image'

export async function captureChart(node, options = {}) {
  if (!node) return null
  try {
    return await toPng(node, {
      pixelRatio: options.pixelRatio ?? 2,
      backgroundColor: options.backgroundColor ?? '#ffffff',
      cacheBust: true,
      width: options.width,
      height: options.height,
    })
  } catch (err) {
    console.error('captureChart failed:', err)
    return null
  }
}
