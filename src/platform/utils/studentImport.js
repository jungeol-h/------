// 학생 명단 엑셀(구글폼 응답 등) → 일괄 등록 행 파서. exceljs/DOM 무의존 순수함수.
//
// parseStudentSheet(aoa, { existingLoginIds })
// - aoa: 시트 전체를 문자열 2차원 배열로 (빈 셀은 ''/null 허용)
// - existingLoginIds: 이미 DB에 있는 login_id 집합 (학생+교직원 전부)
//
// 반환: { ok, error?, headerRowIndex?, rows?: [행], summary? }
// 행: { name, school, grade, phone, phoneValid, parentPhone, parentPhoneValid,
//       status('active'|'cancelled'), loginId, gender, include, note }
//
// 판정 규칙 (2026-07-17 안동NAVI 4기 신청서 기준으로 확정):
// - 상태 칼럼에 '취소' 포함 → 'cancelled'. '등록완료/미등록'은 시간표 등록 여부라 무시(전원 가입).
// - 같은 이름+같은 학교 중복 행 = 동일인 재제출 → 마지막 제출 채택 (구글폼은 재제출이 정정).
// - 같은 이름+다른 학교 = 동명이인 → login_id를 '이름(학교)'로 구분.
// - login_id가 이미 DB에 있으면 제외 (동명이인이면 학생 추가에서 별도 아이디로 수동 등록).

const INVISIBLE_RE = new RegExp('\\u200B|\\u200C|\\u200D|\\uFEFF|\\u00A0', 'g')
const FULLWIDTH_DIGITS = /[０-９]/g
const toHalfDigit = (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)

// 보이지 않는 문자 제거 + 연속 공백/개행 1칸으로 + trim
export function cleanText(v) {
  return String(v ?? '')
    .replace(INVISIBLE_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizePhone(v) {
  return String(v ?? '')
    .replace(FULLWIDTH_DIGITS, toHalfDigit)
    .replace(/\D/g, '')
}

export const isValidPhone = (v) => /^010\d{8}$/.test(v)

// '1학년'|'중1'|'1' → '중1'. 1~3 밖이거나 없으면 ''.
export function normalizeGrade(v) {
  const m = /([1-3])/.exec(cleanText(v))
  return m ? `중${m[1]}` : ''
}

// 헤더 행에서 칼럼 인덱스 매핑. 왼쪽 우선(신청서 오른쪽의 추천인·동의서 장문 헤더 회피).
function mapColumns(headerCells) {
  const cells = headerCells.map(cleanText)
  const findCol = (test) => cells.findIndex((c) => c && test(c))
  return {
    name: findCol((c) => (/이름|성명/.test(c) || c === '학생') && !/학부모|보호자|추천/.test(c)),
    school: findCol((c) => /학교/.test(c) && !/추천/.test(c)),
    grade: findCol((c) => /학년/.test(c) && !/추천/.test(c)),
    phone: findCol((c) => /(학생|본인).*(연락처|전화)|^(연락처|전화번호)$/.test(c)),
    parentPhone: findCol((c) => /(학부모|보호자).*(연락처|전화)/.test(c)),
    status: findCol((c) => /등록\s*확정|등록\s*상태|^상태$/.test(c)),
  }
}

// 이름+학교 칼럼이 함께 있는 첫 행을 헤더로 본다 (제목·안내문 행 건너뜀).
function findHeaderRow(aoa, scanLimit = 10) {
  for (let i = 0; i < Math.min(aoa.length, scanLimit); i++) {
    const cols = mapColumns(aoa[i] ?? [])
    if (cols.name >= 0 && cols.school >= 0) return { index: i, cols }
  }
  return null
}

export function parseStudentSheet(aoa, { existingLoginIds } = {}) {
  const existing = new Set(existingLoginIds ?? [])
  const header = findHeaderRow(aoa ?? [])
  if (!header) {
    return { ok: false, error: '헤더 행을 찾지 못했습니다. 학생 이름·학교 칼럼이 있는 시트인지 확인해 주세요.' }
  }
  const { cols } = header

  const cell = (row, idx) => (idx >= 0 ? cleanText(row[idx]) : '')
  const parsed = []
  for (let i = header.index + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? []
    const name = cell(row, cols.name)
    if (!name) continue
    const school = cell(row, cols.school)
    const phone = normalizePhone(cell(row, cols.phone))
    const parentPhone = normalizePhone(cell(row, cols.parentPhone))
    parsed.push({
      name,
      school,
      grade: normalizeGrade(cell(row, cols.grade)),
      phone,
      phoneValid: isValidPhone(phone),
      parentPhone,
      parentPhoneValid: isValidPhone(parentPhone),
      status: /취소/.test(cell(row, cols.status)) ? 'cancelled' : 'active',
      gender: /여중|여고/.test(school) ? 'F' : null,
      include: true,
      note: '',
    })
  }

  // 동일인 재제출(이름+학교 중복) → 마지막 제출만 채택
  const lastByPerson = new Map()
  parsed.forEach((r, idx) => lastByPerson.set(`${r.name}|${r.school}`, idx))
  parsed.forEach((r, idx) => {
    if (lastByPerson.get(`${r.name}|${r.school}`) !== idx) {
      r.include = false
      r.note = '재제출 중복 — 마지막 제출을 채택'
    }
  })

  // 동명이인(이름 같고 학교 다름) → login_id '이름(학교)'
  const schoolsByName = new Map()
  parsed.filter((r) => r.include).forEach((r) => {
    if (!schoolsByName.has(r.name)) schoolsByName.set(r.name, new Set())
    schoolsByName.get(r.name).add(r.school)
  })
  parsed.forEach((r) => {
    const dup = (schoolsByName.get(r.name)?.size ?? 0) > 1
    r.loginId = dup && r.school ? `${r.name}(${r.school})` : r.name
    if (r.include && dup) r.note = '동명이인 — 아이디를 이름(학교)로 구분'
  })

  // 이미 등록된 login_id 제외
  parsed.forEach((r) => {
    if (r.include && existing.has(r.loginId)) {
      r.include = false
      r.note = '이미 등록된 아이디 — 제외 (동명이인이면 학생 추가에서 수동 등록)'
    }
  })

  // 전화번호 경고 (등록은 허용 — 비밀번호가 자리표시 값이 된다)
  parsed.forEach((r) => {
    if (r.include && !r.phoneValid) {
      r.note = [r.note, '학생 전화번호 형식 오류 — 확인 필요'].filter(Boolean).join(' · ')
    }
  })

  const included = parsed.filter((r) => r.include)
  return {
    ok: true,
    headerRowIndex: header.index,
    rows: parsed,
    summary: {
      total: parsed.length,
      included: included.length,
      excluded: parsed.length - included.length,
      cancelled: included.filter((r) => r.status === 'cancelled').length,
    },
  }
}
