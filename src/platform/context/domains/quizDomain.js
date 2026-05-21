// [Write] 확인평가 도메인 CRUD — 회차(quizSet)·문제(quizQuestion)·응시(quizAttempt).
// deleteQuizSet의 다중 테이블 정리는 DB CASCADE의 로컬 미러링이라 한 도메인에 둔다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toQuizSet, toQuizQuestion, toQuizAttempt } from '../../lib/supabaseHelpers.js'
import { gradeAttempt } from '../../utils/quizGrading.js'
import { shuffleQuestionsOrder } from '../../utils/quizShuffle.js'
import { makeId } from '../dataModel.js'
import { reportError } from '../../lib/sentry.js'

const sortSets = (a, b) =>
  (a.grade ?? '').localeCompare(b.grade ?? '') || (a.round ?? 0) - (b.round ?? 0)

const sortQuestions = (a, b) => {
  if (a.quizSetId !== b.quizSetId)
    return (a.quizSetId ?? '').localeCompare(b.quizSetId ?? '')
  return (a.orderNo ?? 0) - (b.orderNo ?? 0)
}

export function useQuizDomain(data, setData) {
  // 확인평가 제출 — 채점 + insert + 로컬 반영
  const submitQuizAttempt = useCallback(
    async (studentId, quizSetId, rawByQid) => {
      const questions = data.quizQuestions
        .filter((q) => q.quizSetId === quizSetId)
        .sort((a, b) => a.orderNo - b.orderNo)
      if (questions.length === 0) {
        throw new Error('해당 회차의 문제를 불러오지 못했습니다.')
      }
      const { answers, score, total } = gradeAttempt(questions, rawByQid)
      const row = {
        id: makeId('qa-'),
        student_id: studentId,
        quiz_set_id: quizSetId,
        answers,
        score,
        total,
        submitted_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('quiz_attempts').insert(row)
      if (error) {
        reportError(error, { where: 'submitQuizAttempt', studentId, quizSetId })
        if (error.code === '23505') {
          throw new Error('이미 응시한 회차입니다. 결과 화면에서 확인하세요.')
        }
        throw error
      }
      const local = toQuizAttempt(row)
      setData((prev) => ({
        ...prev,
        quizAttempts: [
          local,
          ...prev.quizAttempts.filter(
            (a) => !(a.studentId === studentId && a.quizSetId === quizSetId)
          ),
        ],
      }))
      return local
    },
    [data.quizQuestions, setData]
  )

  // 회차 신규 생성
  const createQuizSet = useCallback(
    async ({ title, grade, round, source = '', description = '', isPublished = true }) => {
      const row = {
        id: makeId('qs-'),
        title,
        grade,
        round,
        source,
        description,
        is_published: isPublished,
        created_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('quiz_sets').insert(row)
      if (error) {
        reportError(error, { where: 'createQuizSet' })
        throw error
      }
      const local = toQuizSet(row)
      setData((prev) => ({
        ...prev,
        quizSets: [...prev.quizSets, local].sort(sortSets),
      }))
      return local
    },
    [setData]
  )

  // 회차 정보 수정 (배포 토글 포함)
  const updateQuizSet = useCallback(
    async (setId, patch) => {
      const snake = {}
      if (patch.title !== undefined) snake.title = patch.title
      if (patch.grade !== undefined) snake.grade = patch.grade
      if (patch.round !== undefined) snake.round = patch.round
      if (patch.source !== undefined) snake.source = patch.source
      if (patch.description !== undefined) snake.description = patch.description
      if (patch.isPublished !== undefined) snake.is_published = patch.isPublished

      const { error } = await supabase.from('quiz_sets').update(snake).eq('id', setId)
      if (error) {
        reportError(error, { where: 'updateQuizSet', setId })
        throw error
      }
      setData((prev) => ({
        ...prev,
        quizSets: prev.quizSets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
      }))
    },
    [setData]
  )

  // 회차 복제(순서 셔플) — 회차 1개 + 소속 문제 N개를 그대로 복제하되 문제 orderNo만 무작위로 재배치.
  // 새 회차: round=해당 학년 max+1, 제목 접미사 "(순서 셔플)", 미배포 시작.
  const duplicateQuizSetShuffled = useCallback(
    async (sourceSetId) => {
      const source = data.quizSets.find((s) => s.id === sourceSetId)
      if (!source) throw new Error('복제할 회차를 찾지 못했습니다.')
      const sourceQuestions = data.quizQuestions
        .filter((q) => q.quizSetId === sourceSetId)
        .sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
      if (sourceQuestions.length === 0) {
        throw new Error('소속 문제가 없는 회차는 복제할 수 없습니다.')
      }

      const sameGradeMaxRound = data.quizSets
        .filter((s) => s.grade === source.grade)
        .reduce((max, s) => Math.max(max, s.round ?? 0), 0)
      const newRound = sameGradeMaxRound + 1
      const newSetId = makeId('qs-')
      const newSetRow = {
        id: newSetId,
        title: `${source.title} (순서 셔플)`,
        grade: source.grade,
        round: newRound,
        source: source.source ?? '',
        description: source.description ?? '',
        is_published: false,
        created_at: new Date().toISOString(),
      }

      // 문제 순서 셔플 — orderNo만 1..N으로 재배치, 본문/정답/해설/힌트는 그대로
      const shuffled = shuffleQuestionsOrder(sourceQuestions)
      const newQuestionRows = shuffled.map((q) => ({
        id: makeId('qq-'),
        quiz_set_id: newSetId,
        order_no: q.orderNo,
        question: q.question,
        accepted_answers: q.acceptedAnswers,
        explanation: q.explanation ?? '',
        hint: q.hint ?? '',
      }))

      const { error: setErr } = await supabase.from('quiz_sets').insert(newSetRow)
      if (setErr) {
        reportError(setErr, { where: 'duplicateQuizSetShuffled.set', sourceSetId })
        throw setErr
      }
      const { error: qErr } = await supabase.from('quiz_questions').insert(newQuestionRows)
      if (qErr) {
        // 문제 insert 실패 시 방금 만든 회차 롤백 (CASCADE 미사용 가정 안전장치)
        await supabase.from('quiz_sets').delete().eq('id', newSetId)
        reportError(qErr, { where: 'duplicateQuizSetShuffled.questions', sourceSetId, newSetId })
        throw qErr
      }

      const localSet = toQuizSet(newSetRow)
      const localQuestions = newQuestionRows.map(toQuizQuestion)
      setData((prev) => ({
        ...prev,
        quizSets: [...prev.quizSets, localSet].sort(sortSets),
        quizQuestions: [...prev.quizQuestions, ...localQuestions].sort(sortQuestions),
      }))
      return localSet
    },
    [data.quizSets, data.quizQuestions, setData]
  )

  // 회차 삭제 (CASCADE로 문제/응시 함께 정리)
  const deleteQuizSet = useCallback(
    async (setId) => {
      const { error } = await supabase.from('quiz_sets').delete().eq('id', setId)
      if (error) {
        reportError(error, { where: 'deleteQuizSet', setId })
        throw error
      }
      setData((prev) => ({
        ...prev,
        quizSets: prev.quizSets.filter((s) => s.id !== setId),
        quizQuestions: prev.quizQuestions.filter((q) => q.quizSetId !== setId),
        quizAttempts: prev.quizAttempts.filter((a) => a.quizSetId !== setId),
      }))
    },
    [setData]
  )

  // 문제 신규 생성
  const createQuizQuestion = useCallback(
    async ({ quizSetId, orderNo, question, acceptedAnswers, explanation = '', hint = '' }) => {
      const row = {
        id: makeId('qq-'),
        quiz_set_id: quizSetId,
        order_no: orderNo,
        question,
        accepted_answers: acceptedAnswers,
        explanation,
        hint,
      }
      const { error } = await supabase.from('quiz_questions').insert(row)
      if (error) {
        reportError(error, { where: 'createQuizQuestion', quizSetId })
        throw error
      }
      const local = toQuizQuestion(row)
      setData((prev) => ({
        ...prev,
        quizQuestions: [...prev.quizQuestions, local].sort(sortQuestions),
      }))
      return local
    },
    [setData]
  )

  // 문제 수정
  const updateQuizQuestion = useCallback(
    async (questionId, patch) => {
      const snake = {}
      if (patch.orderNo !== undefined) snake.order_no = patch.orderNo
      if (patch.question !== undefined) snake.question = patch.question
      if (patch.acceptedAnswers !== undefined) snake.accepted_answers = patch.acceptedAnswers
      if (patch.explanation !== undefined) snake.explanation = patch.explanation
      if (patch.hint !== undefined) snake.hint = patch.hint

      const { error } = await supabase
        .from('quiz_questions')
        .update(snake)
        .eq('id', questionId)
      if (error) {
        reportError(error, { where: 'updateQuizQuestion', questionId })
        throw error
      }
      setData((prev) => ({
        ...prev,
        quizQuestions: prev.quizQuestions.map((q) =>
          q.id === questionId ? { ...q, ...patch } : q
        ),
      }))
    },
    [setData]
  )

  // 문제 삭제 (응시 기록의 answers는 그대로 유지 — 재채점 안 함)
  const deleteQuizQuestion = useCallback(
    async (questionId) => {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', questionId)
      if (error) {
        reportError(error, { where: 'deleteQuizQuestion', questionId })
        throw error
      }
      setData((prev) => ({
        ...prev,
        quizQuestions: prev.quizQuestions.filter((q) => q.id !== questionId),
      }))
    },
    [setData]
  )

  return {
    submitQuizAttempt,
    createQuizSet,
    updateQuizSet,
    duplicateQuizSetShuffled,
    deleteQuizSet,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
  }
}
