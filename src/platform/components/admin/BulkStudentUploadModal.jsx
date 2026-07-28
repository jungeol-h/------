// 학생 일괄 등록 모달 — 신청서 엑셀(xlsx) 업로드 → 미리보기 → 등록.
// 파싱 규칙은 utils/studentImport.js(순수함수, 테스트 있음) 참고:
// '취소' 상태는 신청취소로 등록되고, 재제출 중복·동명이인·기존 아이디 충돌을 자동 처리한다.
// xlsx 읽기는 utils/xlsxRead.js — exceljs/SheetJS가 한셀(HCell) 저장본을 못 읽어 자체 구현.
import { useState } from 'react'
import { Upload, AlertTriangle } from 'lucide-react'
import ModalShell from '../common/ModalShell.jsx'
import { useData } from '../../context/DataContext.jsx'
import { GROUP_OPTIONS } from '../../data/groups.js'
import { STUDENT_STATUS_LABELS } from '../../data/studentStatus.js'
import { parseStudentSheet } from '../../utils/studentImport.js'
import { readFirstSheetAoa } from '../../utils/xlsxRead.js'
import { formatPhone } from '../../utils/formatPhone.js'

export default function BulkStudentUploadModal({ onClose }) {
  const { data, bulkCreateStudents } = useData()
  const [group, setGroup] = useState('') // 명시 선택 강제 — 잘못된 기본값으로 수십 명 오등록 방지
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState(null) // parseStudentSheet 결과
  const [checked, setChecked] = useState([]) // include 가능한 행의 선택 여부 (rows와 같은 길이)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { inserted, skipped }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 재선택 허용
    if (!file) return
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const aoa = await readFirstSheetAoa(await file.arrayBuffer())
      const existingLoginIds = [...data.students, ...data.educators]
        .map((u) => u.loginId)
        .filter(Boolean)
      // data.students는 퇴원·신청취소 포함 전체 — 전화번호·이름 동일인 검사용
      const res = parseStudentSheet(aoa, { existingLoginIds, existingStudents: data.students })
      if (!res.ok) {
        setError(res.error)
        setParsed(null)
        return
      }
      setFileName(file.name)
      setParsed(res)
      setChecked(res.rows.map((r) => r.include))
    } catch (err) {
      setError(err?.message || '파일을 읽지 못했습니다. xlsx 파일인지 확인해 주세요.')
      setParsed(null)
    } finally {
      setBusy(false)
    }
  }

  const selectedRows = parsed
    ? parsed.rows.filter((r, i) => r.include && checked[i])
    : []

  const handleRegister = async () => {
    if (!group || selectedRows.length === 0) return
    if (!window.confirm(`${selectedRows.length}명을 '${group}' 소속으로 등록할까요?`)) return
    setBusy(true)
    setError('')
    try {
      const payload = selectedRows.map((r) => ({
        loginId: r.loginId,
        name: r.name,
        school: r.school,
        grade: r.grade,
        className: r.grade, // 반 미지정 시 학년과 동일 (시드 관행)
        // 초기 비밀번호 = 학생 연락처(도메인에서 해시). 형식 오류면 연락처 없이 등록 —
        // 수정 화면에서 바로잡은 뒤 '비밀번호 초기화'로 로그인 가능해진다.
        phone: r.phoneValid ? r.phone : '',
        parentPhone: r.parentPhoneValid ? r.parentPhone : '',
        gender: r.gender,
        status: r.status,
        groups: [group],
      }))
      const res = await bulkCreateStudents(payload)
      setResult(res)
    } catch (err) {
      setError(err?.message || '등록 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="학생 일괄 등록" onClose={onClose} maxWidth="max-w-3xl">
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            <span className="font-bold text-emerald-600">{result.inserted}명</span> 등록 완료
            {result.skipped > 0 && (
              <span className="text-gray-500"> · {result.skipped}명은 이미 등록돼 있어 건너뜀</span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            학생 로그인: 아이디 = 이름(동명이인은 이름(학교)), 초기 비밀번호 = 학생 전화번호.
            첫 로그인 때 새 비밀번호를 정하게 됩니다.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            닫기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            신청서 엑셀(xlsx)을 올리면 이름·학교·학년·연락처 칼럼을 자동으로 찾아 등록합니다.
            상태에 &lsquo;취소&rsquo;가 있는 학생은 신청취소로, 나머지는 전원 재원으로 들어갑니다.
          </p>

          <div className="flex gap-2">
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
            >
              <option value="">소속 그룹 선택</option>
              {GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 cursor-pointer hover:border-emerald-400 hover:text-emerald-600">
              <Upload size={14} />
              {fileName || '엑셀 파일 선택 (.xlsx)'}
              <input type="file" accept=".xlsx" onChange={handleFile} className="hidden" />
            </label>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle size={13} className="flex-shrink-0" /> {error}
            </p>
          )}

          {parsed && (
            <>
              <p className="text-xs text-gray-600">
                {parsed.summary.total}행 중{' '}
                <span className="font-semibold text-gray-800">{selectedRows.length}명 등록 예정</span>
                {parsed.summary.excluded > 0 && ` · ${parsed.summary.excluded}행 자동 제외`}
                {parsed.summary.cancelled > 0 && ` · 신청취소 ${parsed.summary.cancelled}명 포함`}
              </p>
              <div className="border border-gray-100 rounded-xl overflow-x-auto max-h-[45vh] overflow-y-auto">
                <table className="w-full text-xs min-w-[560px]">
                  <thead className="sticky top-0 bg-gray-50 text-gray-400">
                    <tr>
                      <th className="px-2 py-1.5 w-8"></th>
                      <th className="px-2 py-1.5 text-left">이름(아이디)</th>
                      <th className="px-2 py-1.5 text-left">학교·학년</th>
                      <th className="px-2 py-1.5 text-left">학생 연락처</th>
                      <th className="px-2 py-1.5 text-left">학부모 연락처</th>
                      <th className="px-2 py-1.5 text-left">상태</th>
                      <th className="px-2 py-1.5 text-left">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((r, i) => (
                      <tr key={i} className={`border-t border-gray-50 ${r.include ? '' : 'opacity-40'}`}>
                        <td className="px-2 py-1.5 text-center">
                          {r.include && (
                            <input
                              type="checkbox"
                              checked={checked[i]}
                              onChange={(e) =>
                                setChecked((prev) => prev.map((c, j) => (j === i ? e.target.checked : c)))
                              }
                              className="w-3.5 h-3.5"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-semibold text-gray-800 whitespace-nowrap">
                          {r.loginId !== r.name ? r.loginId : r.name}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                          {r.school}{r.grade ? ` ${r.grade}` : ''}
                        </td>
                        <td className={`px-2 py-1.5 whitespace-nowrap ${r.phoneValid ? 'text-gray-600' : 'text-red-500'}`}>
                          {formatPhone(r.phone) || r.phone || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                          {formatPhone(r.parentPhone) || '-'}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {r.status === 'cancelled' ? (
                            <span className="text-amber-600 font-semibold">{STUDENT_STATUS_LABELS.cancelled}</span>
                          ) : (
                            <span className="text-gray-500">{STUDENT_STATUS_LABELS.active}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-gray-400">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleRegister}
                disabled={busy || !group || selectedRows.length === 0}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? '등록 중…' : !group ? '소속 그룹을 선택하세요' : `${selectedRows.length}명 등록`}
              </button>
            </>
          )}
        </div>
      )}
    </ModalShell>
  )
}
