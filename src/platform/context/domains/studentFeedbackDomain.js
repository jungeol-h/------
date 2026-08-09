// [Write] 학생 피드백 도메인 — 수시 코멘트 CRUD (2026-08 클라이언트 요청:
// "과제 내기 옆에 피드백 — 수시로 기록 내용에 대한 코멘트").
// 상담 기록(counseling_records)과 별개의 가벼운 기록. 종합성장리포트의
// '피드백 내용' 섹션이 소비한다. 순수 필드 매핑 CRUD라 crudKit으로 선언.

import { useMemo } from 'react'
import { toStudentFeedback } from '../../lib/supabaseHelpers.js'
import { makeAdder, makeUpdater, makeDeleter } from './crudKit.js'

const FEEDBACK = {
  table: 'student_feedbacks',
  collection: 'studentFeedbacks',
  fieldMap: {
    date: 'date',
    content: 'content',
  },
}

export function useStudentFeedbackDomain(setData) {
  return useMemo(() => ({
    addStudentFeedback: makeAdder(setData, {
      ...FEEDBACK, prefix: 'sfb', toLocal: toStudentFeedback, label: 'addStudentFeedback',
      toRow: ({ studentId, authorId = null, authorName = '', date, content }) => ({
        student_id: studentId,
        author_id: authorId,
        author_name: authorName,
        date,
        content,
      }),
    }),
    updateStudentFeedback: makeUpdater(setData, { ...FEEDBACK, label: 'updateStudentFeedback' }),
    deleteStudentFeedback: makeDeleter(setData, { ...FEEDBACK, label: 'deleteStudentFeedback' }),
  }), [setData])
}
