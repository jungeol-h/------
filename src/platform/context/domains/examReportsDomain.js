// [Write] 내신백서 도메인 — 시험 후 피드백·시험지 분석·우수사례 CRUD (add-exam-reports.sql).
// 순수 필드 매핑 CRUD라 crudKit 팩토리로 선언한다.
// 피드백·분석은 시험당 1건(unique) — add에서 unique 위반(23505)이 나면
// err.code === 'DUPLICATE'로 던진다. 호출부는 로컬/refetch로 기존 행을 열어 수정 모드로 전환할 것.
// update 패치에는 호출부가 updatedBy / updatedByName / updatedAt을 넣는다 (fieldMap에 포함).

import { useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  toExamFeedback, toExamAnalysis, toExamBestCase,
} from '../../lib/supabaseHelpers.js'
import { makeAdder, makeUpdater, makeDeleter } from './crudKit.js'

const FEEDBACK = {
  table: 'exam_feedbacks',
  collection: 'examFeedbacks',
  fieldMap: {
    examYear: 'exam_year',
    semester: 'semester',
    examType: 'exam_type',
    school: 'school',
    grade: 'grade',
    className: 'class_name',
    writtenDate: 'written_date',
    subjects: 'subjects',
    actionPlan: 'action_plan',
    updatedBy: 'updated_by',
    updatedByName: 'updated_by_name',
    updatedAt: 'updated_at',
  },
}

const ANALYSIS = {
  table: 'exam_analyses',
  collection: 'examAnalyses',
  fieldMap: {
    school: 'school',
    grade: 'grade',
    subject: 'subject',
    examYear: 'exam_year',
    semester: 'semester',
    examType: 'exam_type',
    examDate: 'exam_date',
    startTime: 'start_time',
    endTime: 'end_time',
    publisher: 'publisher',
    totalQuestions: 'total_questions',
    difficulty: 'difficulty',
    questionTypes: 'question_types',
    scope: 'scope',
    sections: 'sections',
    attachments: 'attachments',
    updatedBy: 'updated_by',
    updatedByName: 'updated_by_name',
    updatedAt: 'updated_at',
  },
}

const BEST_CASE = {
  table: 'exam_best_cases',
  collection: 'examBestCases',
  fieldMap: {
    examYear: 'exam_year',
    semester: 'semester',
    examType: 'exam_type',
    subject: 'subject',
    score: 'score',
    prepPeriod: 'prep_period',
    process: 'process',
    keyPoint: 'key_point',
    updatedAt: 'updated_at',
  },
}

// crudKit는 error 객체를 그대로 throw한다 (code 보존). unique 위반만 DUPLICATE로 변환.
function wrapDuplicate(adder) {
  return async (input) => {
    try {
      return await adder(input)
    } catch (err) {
      if (err?.code === '23505') {
        const dup = new Error('이미 작성된 보고서가 있습니다')
        dup.code = 'DUPLICATE'
        dup.cause = err
        throw dup
      }
      throw err
    }
  }
}

export function useExamReportsDomain(setData) {
  return useMemo(() => {
    const now = () => new Date().toISOString()

    const addExamFeedback = makeAdder(setData, {
      ...FEEDBACK, prefix: 'exf', toLocal: toExamFeedback, label: 'addExamFeedback',
      toRow: ({ studentId, examYear, semester, examType, school = '', grade = '', className = '', writtenDate = null, subjects = [], actionPlan = '', updatedBy = null, updatedByName = '' }) => ({
        student_id: studentId,
        exam_year: examYear,
        semester,
        exam_type: examType,
        school,
        grade,
        class_name: className,
        written_date: writtenDate,
        subjects,
        action_plan: actionPlan,
        updated_by: updatedBy,
        updated_by_name: updatedByName,
        updated_at: now(),
      }),
    })

    const addExamAnalysis = makeAdder(setData, {
      ...ANALYSIS, prefix: 'exa', toLocal: toExamAnalysis, label: 'addExamAnalysis',
      toRow: ({ school, grade, subject, examYear, semester, examType, examDate = null, startTime = '', endTime = '', publisher = '', totalQuestions = null, difficulty = '', questionTypes = [], scope = '', sections = {}, attachments = [], authorId = null, updatedBy = null, updatedByName = '' }) => ({
        school,
        grade,
        subject,
        exam_year: examYear,
        semester,
        exam_type: examType,
        exam_date: examDate,
        start_time: startTime,
        end_time: endTime,
        publisher,
        total_questions: totalQuestions,
        difficulty,
        question_types: questionTypes,
        scope,
        sections,
        attachments,
        author_id: authorId,
        updated_by: updatedBy ?? authorId,
        updated_by_name: updatedByName,
        updated_at: now(),
      }),
    })

    const addExamBestCase = makeAdder(setData, {
      ...BEST_CASE, prefix: 'exb', toLocal: toExamBestCase, label: 'addExamBestCase',
      toRow: ({ studentId, authorId = null, authorName = '', examYear, semester, examType, subject = '', score = '', prepPeriod = '', process = '', keyPoint = '' }) => ({
        student_id: studentId,
        author_id: authorId,
        author_name: authorName,
        exam_year: examYear,
        semester,
        exam_type: examType,
        subject,
        score,
        prep_period: prepPeriod,
        process,
        key_point: keyPoint,
        updated_at: now(),
      }),
    })

    return {
      addExamFeedback: wrapDuplicate(addExamFeedback),
      updateExamFeedback: makeUpdater(setData, { ...FEEDBACK, label: 'updateExamFeedback' }),
      deleteExamFeedback: makeDeleter(setData, { ...FEEDBACK, label: 'deleteExamFeedback' }),

      addExamAnalysis: wrapDuplicate(addExamAnalysis),
      updateExamAnalysis: makeUpdater(setData, { ...ANALYSIS, label: 'updateExamAnalysis' }),
      deleteExamAnalysis: makeDeleter(setData, { ...ANALYSIS, label: 'deleteExamAnalysis' }),

      addExamBestCase,
      updateExamBestCase: makeUpdater(setData, { ...BEST_CASE, label: 'updateExamBestCase' }),
      deleteExamBestCase: makeDeleter(setData, { ...BEST_CASE, label: 'deleteExamBestCase' }),

      // 중복(DUPLICATE) 직후 기존 행을 로컬에 반영 — 로컬 병합(id 기준 교체/추가)
      refetchExamFeedback: async (studentId, { examYear, semester, examType }) => {
        const { data, error } = await supabase.from('exam_feedbacks').select('*')
          .eq('student_id', studentId).eq('exam_year', examYear)
          .eq('semester', semester).eq('exam_type', examType).limit(1)
        if (error) throw error
        const row = data?.[0] ? toExamFeedback(data[0]) : null
        if (row) setData((prev) => ({ ...prev, examFeedbacks: [row, ...prev.examFeedbacks.filter((r) => r.id !== row.id)] }))
        return row
      },
      refetchExamAnalysis: async ({ school, grade, subject, examYear, semester, examType }) => {
        const { data, error } = await supabase.from('exam_analyses').select('*')
          .eq('school', school).eq('grade', grade).eq('subject', subject)
          .eq('exam_year', examYear).eq('semester', semester).eq('exam_type', examType).limit(1)
        if (error) throw error
        const row = data?.[0] ? toExamAnalysis(data[0]) : null
        if (row) setData((prev) => ({ ...prev, examAnalyses: [row, ...prev.examAnalyses.filter((r) => r.id !== row.id)] }))
        return row
      },
    }
  }, [setData])
}
