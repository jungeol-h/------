// [Write] 나비 후기 도메인 — 계정당 1건(user_id unique)을 insert-or-update로 저장한다.
// 신규는 crudKit makeAdder, 기존 행 수정은 makeUpdater (규약: withWriteRetry → throw → setData 동기화).
// 로컬 캐시가 비어 있어도(fetch 실패·다른 기기에서 먼저 작성) unique 위반(23505)이면
// 서버의 기존 행을 찾아 수정으로 전환해 사용자가 '이미 있음' 오류를 보지 않게 한다.

import { useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toNaviReview } from '../../lib/supabaseHelpers.js'
import { normalizeNaviReview } from '../../utils/naviReview.js'
import { makeAdder, makeUpdater } from './crudKit.js'

const NAVI = {
  table: 'navi_reviews',
  collection: 'naviReviews',
  fieldMap: {
    authorRole: 'author_role',
    authorName: 'author_name',
    instructorReviews: 'instructor_reviews',
    toDirector: 'to_director',
    toSelf: 'to_self',
    mostHelpful: 'most_helpful',
    mostRegret: 'most_regret',
    updatedAt: 'updated_at',
  },
}

export function useNaviReviewsDomain(setData) {
  return useMemo(() => {
    const add = makeAdder(setData, {
      ...NAVI, prefix: 'nrv', toLocal: toNaviReview, label: 'addNaviReview',
      toRow: ({ userId, authorRole, authorName, instructorReviews, toDirector, toSelf, mostHelpful, mostRegret }) => ({
        user_id: userId,
        author_role: authorRole,
        author_name: authorName,
        instructor_reviews: instructorReviews,
        to_director: toDirector,
        to_self: toSelf,
        most_helpful: mostHelpful,
        most_regret: mostRegret,
      }),
    })
    const update = makeUpdater(setData, { ...NAVI, label: 'updateNaviReview' })

    // user: { id, name, role } (currentUser), existing: 로컬에 있는 본인 후기(없으면 null)
    const saveNaviReview = async (user, existing, input) => {
      const fields = normalizeNaviReview(input)
      const meta = { authorRole: user.role, authorName: user.name ?? '' }
      if (existing) {
        await update(existing.id, { ...fields, ...meta, updatedAt: new Date().toISOString() })
        return
      }
      try {
        await add({ userId: user.id, ...meta, ...fields })
      } catch (err) {
        if (err?.code !== '23505') throw err
        const { data: rows, error } = await supabase
          .from('navi_reviews').select('*').eq('user_id', user.id).limit(1)
        if (error || !rows?.[0]) throw err
        // 서버 행을 로컬에 먼저 올려 두고 수정 — makeUpdater가 로컬 행 기준으로 병합한다.
        setData((prev) => ({ ...prev, naviReviews: [toNaviReview(rows[0]), ...prev.naviReviews.filter((r) => r.userId !== user.id)] }))
        await update(rows[0].id, { ...fields, ...meta, updatedAt: new Date().toISOString() })
      }
    }

    return { saveNaviReview }
  }, [setData])
}
