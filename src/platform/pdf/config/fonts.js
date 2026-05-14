let registered = false
const fontCache = new Map()

function bufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function loadFontDataUrl(path) {
  if (fontCache.has(path)) return fontCache.get(path)
  const promise = fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`폰트 로드 실패: ${path} (${res.status})`)
      return res.arrayBuffer()
    })
    .then((buf) => `data:font/ttf;base64,${bufferToBase64(buf)}`)
  fontCache.set(path, promise)
  return promise
}

export async function ensureFontsRegistered() {
  if (registered) return
  const { Font } = await import('@react-pdf/renderer')
  const [regular, semibold, bold] = await Promise.all([
    loadFontDataUrl('/fonts/Pretendard-Regular.ttf'),
    loadFontDataUrl('/fonts/Pretendard-SemiBold.ttf'),
    loadFontDataUrl('/fonts/Pretendard-Bold.ttf'),
  ])
  Font.register({
    family: 'Pretendard',
    fonts: [
      { src: regular, fontWeight: 400 },
      { src: semibold, fontWeight: 600 },
      { src: bold, fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}
