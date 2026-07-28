import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { GROUP_OPTIONS } from '../../data/groups.js'
import {
  cleanText, normalizePhone, isValidPhone, LOGIN_ID_RE, humanizeSupabaseError,
} from './userFormUtils.js'
import { findDuplicateStudents, describeDuplicate } from '../../utils/studentDedup.js'

const GRADE_OPTIONS = ['중1', '중2', '중3']

export default function StudentFormModal({
  mode = 'create',
  initial,
  managers = [],
  initialManagerId = '',
  students = [],
  onSubmit,
  onClose,
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '')
  const [grade, setGrade] = useState(initial?.grade ?? '중1')
  const [group, setGroup] = useState(initial?.groups?.[0] ?? GROUP_OPTIONS[0]) // 학생은 단일 소속
  const [className, setClassName] = useState(initial?.className ?? '')
  const [school, setSchool] = useState(initial?.school ?? '')
  const [loginId, setLoginId] = useState(initial?.loginId ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [parentPhone, setParentPhone] = useState(initial?.parentPhone ?? '')
  const [resetPassword, setResetPassword] = useState(false) // edit 모드: 저장 시 비밀번호를 연락처로 초기화
  const [managerId, setManagerId] = useState(initialManagerId ?? '')
  const [enrolledAt, setEnrolledAt] = useState(initial?.enrolledAt ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [dupMatches, setDupMatches] = useState(null)
  const [dupConfirmed, setDupConfirmed] = useState(false)

  const isEdit = mode === 'edit'

  // 입력 핸들러: 전화번호는 입력 즉시 정규화(다듬어진 값만 state에 저장)
  const handleNameChange = (e) => {
    setName(e.target.value)
    setDupMatches(null)
    setDupConfirmed(false)
  }
  const handlePhoneChange = (e) => {
    setPhone(normalizePhone(e.target.value))
    setDupMatches(null)
    setDupConfirmed(false)
  }
  const handleParentPhoneChange = (e) => {
    setParentPhone(normalizePhone(e.target.value))
    setDupMatches(null)
    setDupConfirmed(false)
  }

  const canSubmit =
    cleanText(name) && grade && cleanText(loginId) && phone

  const handleSubmit = async () => {
    setErrorMsg('')

    // ── 1단계: 정규화 ──
    const nameClean = cleanText(name)
    const loginIdClean = cleanText(loginId)
    const schoolClean = cleanText(school)
    const classNameClean = cleanText(className)
    const phoneClean = normalizePhone(phone)
    const parentPhoneClean = normalizePhone(parentPhone)

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
    if (!phoneClean) {
      setErrorMsg('학생 연락처를 입력하세요.')
      return
    }
    if (!isValidPhone(phoneClean)) {
      setErrorMsg('학생 연락처는 010으로 시작하는 11자리 숫자여야 합니다.')
      return
    }
    if (parentPhoneClean && !isValidPhone(parentPhoneClean)) {
      setErrorMsg('학부모 연락처는 010으로 시작하는 11자리 숫자여야 합니다.')
      return
    }
    if (gender && gender !== 'M' && gender !== 'F') {
      setErrorMsg('성별 값이 잘못되었습니다.')
      return
    }

    const matches = findDuplicateStudents(students, {
      name: nameClean, phone: phoneClean, parentPhone: parentPhoneClean,
      excludeId: isEdit ? initial?.id : undefined,
    })
    if (matches.length > 0 && !dupConfirmed) {
      setDupMatches(matches)
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        name: nameClean,
        gender: gender || null,
        grade,
        groups: [group], // 저장은 배열 — users.group_names
        className: classNameClean,
        school: schoolClean,
        loginId: loginIdClean,
        phone: phoneClean,
        parentPhone: parentPhoneClean,
        resetPassword: isEdit ? resetPassword : undefined,
        managerId: managerId || null,
        enrolledAt: enrolledAt || null,
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
              onChange={handleNameChange}
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
            <label className="block text-[11px] font-bold text-gray-500 mb-1">소속 그룹 *</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              {GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
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
              <label className="block text-[11px] font-bold text-gray-500 mb-1">입학일</label>
              <input
                type="date"
                value={enrolledAt}
                onChange={(e) => setEnrolledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              />
              <p className="mt-1 text-[10px] text-gray-400">인원 현황 '신입학' 집계 기준</p>
            </div>
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
              <label className="block text-[11px] font-bold text-gray-500 mb-1">학생 연락처 *</label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={11}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="01012345678"
              />
              <p className="mt-1 text-[10px] text-gray-400">- 자동 제거됨 · 11자리</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">학부모 연락처</label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={parentPhone}
                onChange={handleParentPhoneChange}
                maxLength={11}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="01012345678"
              />
            </div>
          </div>

          {isEdit ? (
            <label className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetPassword}
                onChange={(e) => setResetPassword(e.target.checked)}
                className="w-4 h-4 mt-0.5"
              />
              <span className="text-xs text-gray-600">
                <span className="font-bold text-gray-700 block">비밀번호 초기화</span>
                저장 시 비밀번호가 학생 연락처로 재설정되고, 학생은 다음 로그인 때 새 비밀번호를 정합니다.
              </span>
            </label>
          ) : (
            <p className="text-[10px] text-gray-400">
              초기 비밀번호는 학생 연락처와 같게 설정되며, 학생이 첫 로그인 때 직접 바꿉니다.
            </p>
          )}

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

          {dupMatches?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 space-y-1.5">
              <p className="font-bold">이미 등록된 학생과 정보가 겹칩니다</p>
              <ul className="space-y-0.5">
                {dupMatches.map((match) => (
                  <li key={match.student.id}>{describeDuplicate(match)}</li>
                ))}
              </ul>
              {dupMatches.some((m) => m.samePerson) && (
                <p>
                  동일 학생이면 새로 등록하지 말고 기존 계정의 상태를 '재원'으로 되돌려 주세요.
                  (퇴원·신청취소 학생은 '비활성 포함' 필터로 목록에서 찾을 수 있습니다)
                </p>
              )}
              <label className="flex items-center gap-1.5 pt-0.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dupConfirmed}
                  onChange={(e) => setDupConfirmed(e.target.checked)}
                />
                동명이인/다른 학생임을 확인했습니다 — 계속 등록
              </label>
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
            disabled={!canSubmit || saving || (dupMatches?.length > 0 && !dupConfirmed)}
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
