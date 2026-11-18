// 나비 후기 작성·수정 폼 (ModalShell 하단 시트).
// 순서: 1) 강사별 후기(선택 칩 + 강사별 입력칸) 2) 센터장에게 3) 자신에게 4) 도움된 점 5) 아쉬운 점.
// 저장은 naviReviewsDomain.saveNaviReview (신규=insert, 기존=update). 실명으로 저장된다.

import { useEffect, useMemo, useState } from 'react'
import { X, Check } from 'lucide-react'
import ModalShell from './ModalShell.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { fetchNaviEducators } from '../../context/fetchers/fetchNaviReviews.js'
import {
  NAVI_TEXT_SECTIONS, hasNaviReviewContent, pickableEducators,
} from '../../utils/naviReview.js'

const TEXTAREA = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none'

export default function NaviReviewFormModal({ existing, onClose }) {
  const { currentUser } = useAuth()
  const { saveNaviReview } = useData()

  // 선택된 강사: [{ educatorId, educatorName, content }] — 선택 순서 유지
  const [picked, setPicked] = useState(() => (existing?.instructorReviews ?? []).map((r) => ({ ...r })))
  const [texts, setTexts] = useState(() => ({
    toDirector: existing?.toDirector ?? '',
    toSelf: existing?.toSelf ?? '',
    mostHelpful: existing?.mostHelpful ?? '',
    mostRegret: existing?.mostRegret ?? '',
  }))
  const [educators, setEducators] = useState(null) // null = 로딩 중
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 강사 목록은 폼이 열릴 때만 조회 (학생·학부모 fetch에는 직원 명단이 없다)
  useEffect(() => {
    let cancelled = false
    fetchNaviEducators()
      .then((rows) => { if (!cancelled) setEducators(pickableEducators(rows, currentUser?.id)) })
      .catch(() => { if (!cancelled) { setEducators([]); setLoadFailed(true) } })
    return () => { cancelled = true }
  }, [currentUser?.id])

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.educatorId)), [picked])

  const togglePick = (edu) => {
    setPicked((prev) => prev.some((p) => p.educatorId === edu.id)
      ? prev.filter((p) => p.educatorId !== edu.id)
      : [...prev, { educatorId: edu.id, educatorName: edu.name, content: '' }])
  }
  const setPickedContent = (id, content) =>
    setPicked((prev) => prev.map((p) => (p.educatorId === id ? { ...p, content } : p)))

  const canSave = hasNaviReviewContent({ instructorReviews: picked, ...texts })

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setError('')
    try {
      await saveNaviReview(currentUser, existing, { instructorReviews: picked, ...texts })
      onClose()
    } catch (err) {
      setError(err?.message ? `저장하지 못했습니다: ${err.message}` : '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  // 이미 저장된 후기에 있으나 현재 목록에 없는 강사(퇴직 등)도 칩으로 보여 해제할 수 있게 한다
  const chips = useMemo(() => {
    const base = (educators ?? []).map((e) => ({ id: e.id, name: e.name }))
    const ids = new Set(base.map((b) => b.id))
    picked.forEach((p) => { if (!ids.has(p.educatorId)) base.push({ id: p.educatorId, name: p.educatorName }) })
    return base
  }, [educators, picked])

  return (
    <ModalShell title={existing ? '나비 후기 수정' : '나비 후기 남기기'} onClose={onClose}>
      <p className="text-xs text-gray-500 -mt-2">
        실명으로 저장되며 센터 관리자만 볼 수 있어요. 쓰고 싶은 칸만 작성해도 됩니다.
      </p>

      <section className="space-y-2">
        <h4 className="text-sm font-bold text-gray-800">1. 강사님께 남기는 후기</h4>
        {educators === null ? (
          <p className="text-xs text-gray-400">강사 목록을 불러오는 중...</p>
        ) : chips.length === 0 ? (
          <p className="text-xs text-gray-400">
            {loadFailed ? '강사 목록을 불러오지 못했습니다.' : '선택할 수 있는 강사가 없습니다.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => {
              const on = pickedIds.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => togglePick({ id: c.id, name: c.name })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    on ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {on && <Check size={11} className="inline mr-1 -mt-0.5" />}{c.name}
                </button>
              )
            })}
          </div>
        )}
        {picked.map((p) => (
          <div key={p.educatorId} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">{p.educatorName} 강사님께</label>
              <button
                type="button"
                onClick={() => setPicked((prev) => prev.filter((x) => x.educatorId !== p.educatorId))}
                aria-label={`${p.educatorName} 강사님 후기 삭제`}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={p.content}
              onChange={(e) => setPickedContent(p.educatorId, e.target.value)}
              rows={3}
              placeholder={`${p.educatorName} 강사님께 전하고 싶은 말`}
              className={TEXTAREA}
            />
          </div>
        ))}
      </section>

      {NAVI_TEXT_SECTIONS.map((s, i) => (
        <section key={s.key} className="space-y-1">
          <label className="text-sm font-bold text-gray-800">{i + 2}. {s.label}</label>
          <textarea
            value={texts[s.key]}
            onChange={(e) => setTexts((prev) => ({ ...prev, [s.key]: e.target.value }))}
            rows={3}
            className={TEXTAREA}
          />
        </section>
      ))}

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full py-3 rounded-xl bg-amber-500 text-white text-sm font-bold disabled:opacity-40 active:scale-[0.99] transition"
      >
        {saving ? '저장 중...' : existing ? '후기 수정하기' : '후기 남기기'}
      </button>
      {!canSave && <p className="text-[11px] text-gray-400 text-center -mt-2">한 칸 이상 작성해 주세요.</p>}
    </ModalShell>
  )
}
