// 내 정보(담당 업무·업무일정) 수정 모달 — Header의 '내 정보' 버튼에서 연다 (교직원 전용).
// 스테일 localStorage 세션에 subject/workSchedule이 없을 수 있어 마운트 시 DB 최신값을 프리필한다.
// ChangePasswordModal의 오버레이·done 패턴을 미러링.

import { useEffect, useState } from 'react'
import { X, UserCog, Loader } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'

export default function MyProfileModal({ onClose }) {
  const { currentUser, updateMyProfile } = useAuth()
  const [subject, setSubject] = useState(currentUser?.subject ?? '')
  const [workSchedule, setWorkSchedule] = useState(currentUser?.workSchedule ?? '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [done, setDone] = useState(false)

  // 마운트 시 DB 최신값 프리필 — 스테일 세션 가드
  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from('users')
      .select('subject, work_schedule')
      .eq('id', currentUser.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) {
          setSubject(data.subject ?? '')
          setWorkSchedule(data.work_schedule ?? '')
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [currentUser?.id])

  const handleSave = async () => {
    setErrorMsg('')
    setSaving(true)
    try {
      await updateMyProfile({
        subject: subject.trim(),
        workSchedule: workSchedule.trim(),
      })
      setDone(true)
    } catch (err) {
      setErrorMsg(err?.message ?? '저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <UserCog size={18} className="text-blue-500" />
            내 정보
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {done ? (
          <>
            <p className="text-sm text-gray-700 bg-emerald-50 rounded-xl px-4 py-3">
              내 정보가 저장되었습니다.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm"
            >
              닫기
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">담당 업무</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={loading}
                  placeholder="예: 비교과 계열심화 자연"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">업무일정</label>
                <input
                  type="text"
                  value={workSchedule}
                  onChange={(e) => setWorkSchedule(e.target.value)}
                  disabled={loading}
                  placeholder="예: 금 16:00~21:00 · 일 13:30~18:00"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              보고서(월간 컨설팅·수업)의 담당업무·업무일정 기본값으로 쓰입니다.
            </p>

            {errorMsg && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
            )}

            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold text-sm transition-colors"
            >
              {(loading || saving) ? <Loader size={16} className="animate-spin" /> : null}
              {loading ? '불러오는 중...' : saving ? '저장 중...' : '저장하기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
