import { describe, it, expect } from 'vitest'
import { readFirstSheetAoa } from './xlsxRead.js'

// 픽스처는 base64로 내장 (scripts 없이 재생성: openpyxl / python zipfile로 만든 최소 파일)
// A: openpyxl 저장본 — 기본 네임스페이스, deflate 압축, 숫자 셀 포함
// B: 한컴 한셀(HCell) 스타일 — 모든 태그 x: 접두사, sharedStrings, 무압축(method 0)
import { OPENPYXL_B64, HCELL_B64 } from './xlsxRead.fixtures.js'

const toBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer

describe('readFirstSheetAoa', () => {
  it('일반(기본 네임스페이스·deflate) xlsx를 읽는다 — 숫자 셀은 문자열로', async () => {
    const aoa = await readFirstSheetAoa(toBuf(OPENPYXL_B64))
    expect(aoa[0]).toEqual(['상태', '학생', '학교', '학년', '학생연락처'])
    expect(aoa[1]).toEqual(['등록완료', '홍길동', '안동중', '1학년', '010-1111-2222'])
    expect(aoa[2][0]).toBe('신청취소')
    expect(aoa[2][4]).toBe('1012345678') // 숫자 셀 → 문자열
  })

  it('한셀 스타일(x: 접두사 태그·무압축) xlsx를 읽는다', async () => {
    const aoa = await readFirstSheetAoa(toBuf(HCELL_B64))
    expect(aoa).toEqual([
      ['상태', '학생', '학교'],
      ['등록완료', '홍길동', '안동중'],
    ])
  })

  it('zip이 아닌 파일은 명확한 에러를 낸다', async () => {
    await expect(readFirstSheetAoa(new Uint8Array(100).buffer)).rejects.toThrow(/xlsx/)
  })
})
