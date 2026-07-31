// [Write] 공지·알림 도메인 — 관리자·강사가 작성하는 notices CRUD.
// kind='announcement'(공지, 대상 전체 고정)는 로그인 팝업, kind='notification'(알림)은
// 학생·학부모 홈 알림 칸에 누적 표시된다. 순수 필드 매핑 CRUD라 crudKit로 선언한다.

import { useMemo } from 'react'
import { toNotice } from '../../lib/supabaseHelpers.js'
import { makeAdder, makeUpdater, makeDeleter } from './crudKit.js'

const NOTICE = {
  table: 'notices',
  collection: 'notices',
  fieldMap: {
    kind: 'kind',
    audience: 'audience',
    title: 'title',
    content: 'content',
    createdBy: 'created_by',
    createdByName: 'created_by_name',
    active: 'active',
  },
}

export function useNoticeDomain(setData) {
  return useMemo(() => ({
    addNotice: makeAdder(setData, {
      ...NOTICE, prefix: 'ntc', toLocal: toNotice, label: 'addNotice',
      toRow: ({ kind = 'notification', audience = 'all', title = '', content, createdBy = null, createdByName = '', active = true }) => ({
        kind,
        audience,
        title,
        content,
        created_by: createdBy,
        created_by_name: createdByName,
        active,
      }),
    }),
    updateNotice: makeUpdater(setData, { ...NOTICE, label: 'updateNotice' }),
    deleteNotice: makeDeleter(setData, { ...NOTICE, label: 'deleteNotice' }),
  }), [setData])
}
