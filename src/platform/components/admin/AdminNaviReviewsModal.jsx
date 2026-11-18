// 관리자 나비 후기 열람 모달 (읽기 전용) — 출력 양식은 클라이언트 공유 후 별도 구현 예정.
// 역할 필터(전체/학생/학부모/강사) + '강사별 모아보기' 토글(instructor_reviews를 강사 단위로 뒤집어 표시).

import { useMemo, useState } from 'react'
import ModalShell from '../common/ModalShell.jsx'
import { toDateStr } from '../../utils/dateUtils.js'
import {
  NAVI_ROLE_FILTERS, NAVI_ROLE_LABELS, NAVI_TEXT_SECTIONS,
  filterNaviReviewsByRole, groupNaviReviewsByEducator,
} from '../../utils/naviReview.js'

// ISO 타임스탬프 → 로컬(KST) 날짜 문자열 (toISOString().slice 금지 — dateUtils 사용)
const fmtDate = (iso) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? toDateStr(d) : ''
}

function Block({ label, text }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap mt-0.5">{text}</p>
    </div>
  )
}

export default function AdminNaviReviewsModal({ reviews, onClose }) {
  const [roleFilter, setRoleFilter] = useState('all')
  const [byEducator, setByEducator] = useState(false)

  const sorted = useMemo(
    () => [...reviews].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [reviews],
  )
  const filtered = useMemo(() => filterNaviReviewsByRole(sorted, roleFilter), [sorted, roleFilter])
  const groups = useMemo(() => groupNaviReviewsByEducator(filtered), [filtered])

  return (
    <ModalShell title={`나비 후기 ${reviews.length}건`} onClose={onClose}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {NAVI_ROLE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setRoleFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                roleFilter === f.key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
          <input type="checkbox" checked={byEducator} onChange={(e) => setByEducator(e.target.checked)} />
          강사별 모아보기
        </label>
      </div>

      {byEducator ? (
        groups.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">강사에게 남긴 후기가 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.educatorId} className="bg-gray-50 rounded-2xl p-3 space-y-2">
                <p className="text-sm font-bold text-gray-900">{g.educatorName} 강사님 <span className="text-xs font-normal text-gray-400">{g.items.length}건</span></p>
                {g.items.map((it) => (
                  <div key={it.reviewId} className="bg-white rounded-xl p-2.5">
                    <p className="text-[11px] text-gray-400 mb-0.5">
                      {it.authorName} · {NAVI_ROLE_LABELS[it.authorRole] ?? it.authorRole} · {fmtDate(it.updatedAt)}
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{it.content}</p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">후기가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id} className="bg-gray-50 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">
                  {r.authorName}
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {NAVI_ROLE_LABELS[r.authorRole] ?? r.authorRole}
                  </span>
                </p>
                <p className="text-[11px] text-gray-400">{fmtDate(r.updatedAt)}</p>
              </div>
              {r.instructorReviews.filter((x) => x.content).map((x) => (
                <Block key={x.educatorId} label={`${x.educatorName} 강사님께`} text={x.content} />
              ))}
              {NAVI_TEXT_SECTIONS.filter((s) => r[s.key]).map((s) => (
                <Block key={s.key} label={s.label} text={r[s.key]} />
              ))}
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  )
}
