import { useState } from 'react'
import { X, Save } from 'lucide-react'

const GRADE_OPTIONS = ['중1', '중2', '중3']
const LOGIN_ID_RE = /^[가-힣A-Za-z0-9_]+$/

// 보이지 않는 문자(ZWSP/ZWNJ/ZWJ/BOM/NBSP) 제거 + 양 끝 공백 trim
// (ZWJ는 character class에 넣으면 결합 시퀀스로 오인되므로 alternation 사용)
const INVISIBLE_RE = new RegExp('\\u200B|\\u200C|\\u200D|\\uFEFF|\\u00A0', 'g')
const cleanText = (v) => (v ?? '').replace(INVISIBLE_RE, '').trim()

// 전화번호 정규화: 전각숫자→반각, 숫자 외 모두 제거
const FULLWIDTH_DIGITS = /[０-９]/g
const toHalfDigit = (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
const normalizePhone = (v) =>
  (v ?? '').replace(FULLWIDTH_DIGITS, toHalfDigit).replace(/\D/g, '')
const isValidPhone = (v) => /^010\d{8}$/.test(v)

// Supabase 에러 메시지 한국어화
function humanizeSupabaseError(err) {
  if (!err) return '저장 중 오류가 발생했습니다.'
  const code = err.code
  const msg = err.message || ''
  if (code === '23505' || /duplicate key/i.test(msg)) {
    return '이미 사용 중인 login_id입니다.'
  }
  if (code === '23514' || /check constraint/i.test(msg)) {
    return '학년·반·성별 값이 허용 범위를 벗어났습니다.'
  }
  if (code === '23502' || /not[- ]null/i.test(msg)) {
    return '필수 항목이 비어 있습니다.'
  }
  if (code === '22P02' || /invalid input syntax/i.test(msg)) {
    return '입력 형식이 잘못되었습니다.'
  }
  if (code === '23503' || /foreign key/i.test(msg)) {
    return '담당 매니저 정보가 올바르지 않습니다.'
  }
  return msg || '저장 중 오류가 발생했습니다.'
}

export default function StudentFormModal({
  mode = 'create',
  initial,
  managers = [],
  initialManagerId = '',
  onSubmit,
  onClose,
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '')
  const [grade, setGrade] = useState(initial?.grade ?? '중1')
  const [className, setClassName] = useState(initial?.className ?? '')
  const [school, setSchool] = useState(initial?.school ?? '')
  const [loginId, setLoginId] = useState(initial?.loginId ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [parentPassword, setParentPassword] = useState(initial?.parentPassword ?? '')
  const [managerId, setManagerId] = useState(initialManagerId ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isEdit = mode === 'edit'

  // 입력 핸들러: 전화번호는 입력 즉시 정규화(다듬어진 값만 state에 저장)
  const handlePasswordChange = (e) => setPassword(normalizePhone(e.target.value))
  const handleParentPwChange = (e) => setParentPassword(normalizePhone(e.target.value))

  const canSubmit =
    cleanText(name) && grade && cleanText(loginId) && password

  const handleSubmit = async () => {
    setErrorMsg('')

    // ── 1단계: 정규화 ──
    const nameClean = cleanText(name)
    const loginIdClean = cleanText(loginId)
    const schoolClean = cleanText(school)
    const classNameClean = cleanText(className)
    const pwClean = normalizePhone(password)
    const parentPwClean = normalizePhone(parentPassword)

    // ── 2단계: 검증 ──
    if (!nameClean) {
      setErrorMsg('이름을 입력하세요.')
      return
    }
    if (!grade) {
      setErrorMsg('학년을 선택하세요.')
      return
    }
    if (!loginIdClean) {
      setErrorMsg('로그인 ID를 입력하세요.')
      return
    }
    if (!LOGIN_ID_RE.test(loginIdClean)) {
      setErrorMsg('로그인 ID는 한글·영문·숫자·밑줄(_)만 사용할 수 있습니다.')
      return
    }
    if (!pwClean) {
      setErrorMsg('비밀번호를 입력하세요.')
      return
    }
    if (!isValidPhone(pwClean)) {
      setErrorMsg('비밀번호는 010으로 시작하는 11자리 숫자여야 합니다.')
      return
    }
    if (parentPwClean && !isValidPhone(parentPwClean)) {
      setErrorMsg('학부모 비밀번호는 010으로 시작하는 11자리 숫자여야 합니다.')
      return
    }
    if (gender && gender !== 'M' && gender !== 'F') {
      setErrorMsg('성별 값이 잘못되었습니다.')
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        name: nameClean,
        gender: gender || null,
        grade,
        className: classNameClean,
        school: schoolClean,
        loginId: loginIdClean,
        password: pwClean,
        parentPassword: parentPwClean,
        managerId: managerId || null,
      })
      onClose()
    } catch (err) {
      setErrorMsg(humanizeSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">
            {isEdit ? '학생 정보 수정' : '새 학생 추가'}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="예: 홍길동"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">성별</label>
            <div className="flex gap-2">
              {[
                { value: 'M', label: '남' },
                { value: 'F', label: '여' },
                { value: '', label: '미지정' },
              ].map((opt) => (
                <label
                  key={opt.value || 'none'}
                  className={`flex-1 py-2 rounded-lg border text-sm font-semibold text-center cursor-pointer select-none ${
                    gender === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={opt.value}
                    checked={gender === opt.value}
                    onChange={() => setGender(opt.value)}
                    className="hidden"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">학년 *</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">반</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="예: 중2A"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">학교</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="예: 안동중학교"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">login_id (로그인 ID) *</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="동명이인은 다르게 (예: 홍길동남)"
            />
            <p className="mt-1 text-[10px] text-gray-400">한글·영문·숫자·밑줄(_)만 사용</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">비밀번호 *</label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={password}
                onChange={handlePasswordChange}
                maxLength={11}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="01012345678"
              />
              <p className="mt-1 text-[10px] text-gray-400">- 자동 제거됨 · 11자리</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">학부모 비밀번호</label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={parentPassword}
                onChange={handleParentPwChange}
                maxLength={11}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="01012345678"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">담당 매니저</label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value="">미배정</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
