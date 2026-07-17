// 최소 xlsx "읽기" 유틸 — 외부 의존성 없음 (네이티브 DecompressionStream + DOMParser).
//
// 왜 직접 구현했나: 한컴 한셀(HCell)이 저장한 xlsx는 모든 OOXML 태그에 네임스페이스
// 접두사(x:)가 붙는데, exceljs는 로드 중 크래시하고 SheetJS(0.18.5)는 빈 시트를 돌려준다
// (2026-07 안동NAVI 신청서 실파일로 확인). DOMParser는 네임스페이스를 정식으로 처리하므로
// 한셀·엑셀·구글시트 어느 쪽 저장본이든 읽힌다. 범위: 첫 시트 · 셀 문자열 값만
// (학생 일괄 등록 용도로 충분 — 수식은 캐시된 결과, 날짜는 시리얼 숫자 문자열로 나온다).
//
// 쓰기(내보내기)는 기존대로 exceljs를 쓴다 — 이 파일은 읽기 전용.

const EOCD_SIG = 0x06054b50 // End of Central Directory
const CDIR_SIG = 0x02014b50 // Central Directory 엔트리
const LOCAL_HEADER_SIZE = 30

async function inflateRaw(bytes) {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const stream = source.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// zip에서 wanted(name => boolean)에 해당하는 엔트리만 풀어 Map<name, string>으로.
// zip64·암호화 미지원 (xlsx는 해당 없음).
async function unzipTexts(arrayBuffer, wanted) {
  const bytes = new Uint8Array(arrayBuffer)
  const view = new DataView(arrayBuffer)

  // EOCD를 뒤에서부터 스캔 (주석 최대 64KB)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('zip 형식이 아닙니다 (xlsx 파일인지 확인해 주세요).')
  const entryCount = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true) // central directory 시작 오프셋

  const decoder = new TextDecoder('utf-8')
  const out = new Map()
  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(p, true) !== CDIR_SIG) throw new Error('zip 목록이 손상됐습니다.')
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen

    if (!wanted(name)) continue
    // 로컬 헤더의 name/extra 길이는 central directory와 다를 수 있어 다시 읽는다
    const lNameLen = view.getUint16(localOffset + 26, true)
    const lExtraLen = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + LOCAL_HEADER_SIZE + lNameLen + lExtraLen
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize)
    const data = method === 8 ? await inflateRaw(compressed) : compressed
    out.set(name, decoder.decode(data))
  }
  return out
}

const parseXml = (text) => new DOMParser().parseFromString(text, 'application/xml')

// 태그 이름만으로 검색 — 네임스페이스 접두사(x: 등) 유무와 무관
const byTag = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag))

// <si>/<is> 안의 모든 <t>를 이어붙인다 (서식 있는 텍스트 run 대응)
const textOf = (node) => byTag(node, 't').map((t) => t.textContent).join('')

// 'BC12' → 열 인덱스 (0-based)
function colIndex(ref) {
  let col = 0
  for (const ch of ref) {
    if (ch >= 'A' && ch <= 'Z') col = col * 26 + (ch.charCodeAt(0) - 64)
    else break
  }
  return col - 1
}

// 첫 워크시트의 zip 내 경로 — workbook.xml 시트 순서 + rels 매핑으로 찾는다
function firstSheetPath(files) {
  const wbXml = files.get('xl/workbook.xml')
  const relsXml = files.get('xl/_rels/workbook.xml.rels')
  if (wbXml && relsXml) {
    const sheet = byTag(parseXml(wbXml), 'sheet')[0]
    const rid = sheet?.getAttribute('r:id') ||
      sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    if (rid) {
      const rel = byTag(parseXml(relsXml), 'Relationship')
        .find((r) => r.getAttribute('Id') === rid)
      const target = rel?.getAttribute('Target')
      if (target) return target.startsWith('/') ? target.slice(1) : `xl/${target}`
    }
  }
  return 'xl/worksheets/sheet1.xml' // 관례상 기본 경로
}

// xlsx ArrayBuffer → 첫 시트를 문자열 2차원 배열로 (studentImport.parseStudentSheet 입력형)
export async function readFirstSheetAoa(arrayBuffer) {
  const files = await unzipTexts(arrayBuffer, (n) =>
    n === 'xl/workbook.xml' ||
    n === 'xl/_rels/workbook.xml.rels' ||
    n === 'xl/sharedStrings.xml' ||
    (n.startsWith('xl/worksheets/') && n.endsWith('.xml'))
  )

  const sheetXml = files.get(firstSheetPath(files)) ??
    files.get([...files.keys()].find((n) => n.startsWith('xl/worksheets/')))
  if (!sheetXml) throw new Error('시트를 찾지 못했습니다.')

  const shared = files.has('xl/sharedStrings.xml')
    ? byTag(parseXml(files.get('xl/sharedStrings.xml')), 'si').map(textOf)
    : []

  const aoa = []
  for (const row of byTag(parseXml(sheetXml), 'row')) {
    const rowIdx = Number(row.getAttribute('r') || aoa.length + 1) - 1
    const cells = []
    let autoCol = 0
    for (const c of byTag(row, 'c')) {
      const ref = c.getAttribute('r')
      const col = ref ? colIndex(ref) : autoCol
      autoCol = col + 1
      const type = c.getAttribute('t')
      let value = ''
      if (type === 's') value = shared[Number(byTag(c, 'v')[0]?.textContent)] ?? ''
      else if (type === 'inlineStr') value = textOf(c)
      else value = byTag(c, 'v')[0]?.textContent ?? ''
      cells[col] = value
    }
    aoa[rowIdx] = cells
  }
  return aoa
}
