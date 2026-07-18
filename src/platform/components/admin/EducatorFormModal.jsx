// 교직원 계정 추가/수정 모달 — StudentFormModal의 자체 오버레이 패턴을 따른다
// (ModalShell 미사용은 의도된 예외: 데스크톱 중앙 정렬 + 고정 헤더/푸터).
// login_id = 이름, 비밀번호 = 전화번호(숫자만) 관례 (seed-staff-accounts.sql).

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { GROUP_OPTIONS } from '../../data/groups.js'
import { QUIZ_SUBJECTS } from '../../utils/quizSubjects.js'
import {
  cleanText, normalizePhone, isValidPhone, LOGIN_ID_RE, humanizeSupabaseError,
} from './userFormUtils.js'

// 역할 옵션 — admin은 UI에서 생성/수정 불가 (educatorDomain 화이트리스트와 일치)
const ROLE_OPTIONS = [
  { value: 'manager', label: '학습매니저' },
  { value: 'instructor', label: '교과강사' },
  { value: 'consultant', label: '컨설턴트' },
  { value: 'viewer', label: '열람자' },
]

export default function EducatorFormModal({ mode = 'create', initial, onSubmit, onClose }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? 'instructor')
  const [loginId, setLoginId] = useState(initial?.loginId ?? '')
  // create 모드에서 이름 입력이 login_id 기본값으로 따라가는지 여부 — 수동 수정 시 끊는다
  const [loginIdTouched, setLoginIdTouched] = useState(mode === 'edit')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [groups, setGroups] = useState(() => new Set(initial?.groups ?? []))
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isEdit = mode === 'edit'

  const handleNameChange = (e) => {
    setName(e.target.value)
    if (!loginIdTouched) setLoginId(e.target.value)
  }
  const handleLoginIdChange = (e) => {
    setLoginIdTouched(true)
    setLoginId(e.target.value)
  }
  const handlePasswordChange = (e) => setPassword(normalizePhone(e.target.value))
  const toggleGroup = (g) => {
    setGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  const canSubmit = cleanText(name) && role && cleanText(loginId) && password

  const handleSubmit = async () => {
    setErrorMsg('')

    const nameClean = cleanText(name)
    const loginIdClean = cleanText(loginId)
    const pwClean = normalizePhone(password)

    if (!nameClean) {
      setErrorMsg('이름을 입력하세요.')
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

    setSaving(true)
    try {
      await onSubmit({
        name: nameClean,
        role,
        loginId: loginIdClean,
        password: pwClean,
        subject: role === 'instructor' ? subject : '',
        groups: [...groups],
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
            {isEdit ? '교육자 정보 수정' : '새 교육자 추가'}
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
            <label className="block text-[11px] font-bold text-gray-500 mb-1">역할 *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {role === 'instructor' && (
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">담당 과목</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                <option value="">미지정</option>
                {QUIZ_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-gray-400">확인평가 출제·모니터링이 이 과목으로 스코프됩니다</p>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">소속 그룹</label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_OPTIONS.map((g) => (
                <label
                  key={g}
                  className={`px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer select-none ${
                    groups.has(g)
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={groups.has(g)}
                    onChange={() => toggleGroup(g)}
                    className="hidden"
                  />
                  {g}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-gray-400">미선택 = 전체 그룹 열람</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">login_id (로그인 ID) *</label>
            <input
              type="text"
              value={loginId}
              onChange={handleLoginIdChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="관례: 이름 그대로 (동명이인은 다르게)"
            />
            <p className="mt-1 text-[10px] text-gray-400">한글·영문·숫자·밑줄(_)만 사용</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">비밀번호 (연락처) *</label>
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
            <p className="mt-1 text-[10px] text-gray-400">관례: 본인 전화번호 · - 자동 제거됨 · 11자리</p>
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
            {saving ? '저장 중…' : isEdit ? '저장' : '계정 생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
