import { toPng } from 'html-to-image'
import { reportError } from '../../lib/sentry.js'

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
    reportError(err, { where: 'captureChart' })
    return null
  }
}
