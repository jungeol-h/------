// [Write] 확인평가 도메인 CRUD — 회차(quizSet)·문제(quizQuestion)·응시(quizAttempt).
// deleteQuizSet의 다중 테이블 정리는 DB CASCADE의 로컬 미러링이라 한 도메인에 둔다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toQuizSet, toQuizQuestion, toQuizAttempt } from '../../lib/supabaseHelpers.js'
import { gradeAttempt, answerPoints, answerEarned } from '../../utils/quizGrading.js'
import { shuffleQuestionsOrder } from '../../utils/quizShuffle.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

const sortSets = (a, b) =>
  (a.grade ?? '').localeCompare(b.grade ?? '') ||
  (a.subject ?? '').localeCompare(b.subject ?? '') ||
  (a.round ?? 0) - (b.round ?? 0)

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
      const { error } = await withWriteRetry(
        () => supabase.from('quiz_attempts').insert(row),
        { label: 'submitQuizAttempt' }
      )
      if (error) {
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

  // 교사 수동 채점 — gradingByQid 값이 boolean이면 단답 정오(earned = 정답 ? 배점 : 0),
  // 숫자면 서술형 득점(0~배점 클램프, 만점이면 isCorrect true), null이면 채점 대기로 되돌림.
  // score(득점 합)·total(배점 합)을 함께 재계산해 UPDATE. 구 답안(points 스냅샷 없음)은
  // 문항에서 배점을 찾아(없으면 1점) 백필해 저장한다. 갱신된 attempt를 반환한다.
  const updateQuizAttemptGrading = useCallback(
    async (attemptId, gradingByQid) => {
      const attempt = data.quizAttempts.find((a) => a.id === attemptId)
      if (!attempt) throw new Error('응시 기록을 찾지 못했습니다.')
      const newAnswers = attempt.answers.map((a) => {
        const grade = gradingByQid[a.questionId]
        if (grade === undefined) return a
        const pts = Number.isFinite(a.points)
          ? a.points
          : answerPoints(data.quizQuestions.find((q) => q.id === a.questionId))
        if (typeof grade === 'boolean') {
          return { ...a, points: pts, isCorrect: grade, earned: grade ? pts : 0 }
        }
        if (grade === null || !Number.isFinite(grade)) {
          return { ...a, points: pts, isCorrect: null, earned: null }
        }
        const earned = Math.min(Math.max(grade, 0), pts)
        return { ...a, points: pts, isCorrect: earned >= pts, earned }
      })
      const newScore = newAnswers.reduce((sum, a) => sum + (answerEarned(a) ?? 0), 0)
      const newTotal = newAnswers.reduce((sum, a) => sum + answerPoints(a), 0)
      const { error } = await withWriteRetry(
        () => supabase
          .from('quiz_attempts')
          .update({ answers: newAnswers, score: newScore, total: newTotal })
          .eq('id', attemptId),
        { label: 'updateQuizAttemptGrading' }
      )
      if (error) throw error
      const updated = { ...attempt, answers: newAnswers, score: newScore, total: newTotal }
      setData((prev) => ({
        ...prev,
        quizAttempts: prev.quizAttempts.map((a) => (a.id === attemptId ? updated : a)),
      }))
      return updated
    },
    [data.quizAttempts, data.quizQuestions, setData]
  )

  // 점수전용 회차의 점수 직접 입력 — 학생 응시 없이 강사/관리자가 기록.
  // unique(student_id, quiz_set_id) 기준 upsert라 재입력이 곧 수정이다.
  const upsertScoreOnlyAttempt = useCallback(
    async (studentId, quizSetId, score) => {
      const set = data.quizSets.find((s) => s.id === quizSetId)
      if (!set?.isScoreOnly || !Number.isFinite(set.maxScore) || set.maxScore <= 0) {
        throw new Error('점수전용 회차가 아니거나 만점이 설정되지 않았습니다.')
      }
      if (!Number.isFinite(score) || score < 0 || score > set.maxScore) {
        throw new Error(`점수는 0~${set.maxScore} 사이여야 합니다.`)
      }
      const existing = data.quizAttempts.find(
        (a) => a.studentId === studentId && a.quizSetId === quizSetId
      )
      const row = {
        id: existing?.id ?? makeId('qa-'),
        student_id: studentId,
        quiz_set_id: quizSetId,
        answers: [],
        score,
        total: set.maxScore,
        submitted_at: new Date().toISOString(),
      }
      const { error } = await withWriteRetry(
        () => supabase
          .from('quiz_attempts')
          .upsert(row, { onConflict: 'student_id,quiz_set_id' }),
        { label: 'upsertScoreOnlyAttempt' }
      )
      if (error) throw error
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
    [data.quizSets, data.quizAttempts, setData]
  )

  // 회차 신규 생성 — isScoreOnly: 외부시험 점수전용 회차 (문제 없이 max_score 만점 기준)
  const createQuizSet = useCallback(
    async ({ title, grade, subject = '국어', round, source = '', description = '', isPublished = true, isScoreOnly = false, maxScore = null }) => {
      const row = {
        id: makeId('qs-'),
        title,
        grade,
        subject,
        round,
        source,
        description,
        is_published: isPublished,
        is_score_only: isScoreOnly,
        max_score: isScoreOnly ? maxScore : null,
        created_at: new Date().toISOString(),
      }
      const { error } = await withWriteRetry(
        () => supabase.from('quiz_sets').insert(row),
        { label: 'createQuizSet' }
      )
      if (error) throw error
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
      if (patch.subject !== undefined) snake.subject = patch.subject
      if (patch.round !== undefined) snake.round = patch.round
      if (patch.source !== undefined) snake.source = patch.source
      if (patch.description !== undefined) snake.description = patch.description
      if (patch.isPublished !== undefined) snake.is_published = patch.isPublished
      if (patch.isScoreOnly !== undefined) snake.is_score_only = patch.isScoreOnly
      if (patch.maxScore !== undefined) snake.max_score = patch.maxScore

      const { error } = await withWriteRetry(
        () => supabase.from('quiz_sets').update(snake).eq('id', setId),
        { label: 'updateQuizSet' }
      )
      if (error) throw error
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

      // 회차 번호는 (학년, 과목) 안에서만 이어진다 — 과목별 독립 출제
      const sameGroupMaxRound = data.quizSets
        .filter((s) => s.grade === source.grade && s.subject === source.subject)
        .reduce((max, s) => Math.max(max, s.round ?? 0), 0)
      const newRound = sameGroupMaxRound + 1
      const newSetId = makeId('qs-')
      const newSetRow = {
        id: newSetId,
        title: `${source.title} (순서 셔플)`,
        grade: source.grade,
        subject: source.subject ?? '국어',
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
        type: q.type ?? 'short',
        question: q.question,
        accepted_answers: q.acceptedAnswers,
        explanation: q.explanation ?? '',
        hint: q.hint ?? '',
        points: q.points ?? 1,
        // 첨부 메타는 복제하되 실파일은 원본과 path 공유 (삭제는 best-effort라 수용)
        attachments: q.attachments ?? [],
      }))

      const { error: setErr } = await withWriteRetry(
        () => supabase.from('quiz_sets').insert(newSetRow),
        { label: 'duplicateQuizSetShuffled' }
      )
      if (setErr) throw setErr

      const { error: qErr } = await withWriteRetry(
        () => supabase.from('quiz_questions').insert(newQuestionRows),
        { label: 'duplicateQuizSetShuffled' }
      )
      if (qErr) {
        // 문제 insert 실패 시 방금 만든 회차 롤백 (CASCADE 미사용 가정 안전장치)
        await withWriteRetry(
          () => supabase.from('quiz_sets').delete().eq('id', newSetId),
          { label: 'duplicateQuizSetShuffled' }
        )
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
      const { error } = await withWriteRetry(
        () => supabase.from('quiz_sets').delete().eq('id', setId),
        { label: 'deleteQuizSet' }
      )
      if (error) throw error
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
    async ({ quizSetId, orderNo, type = 'short', question, acceptedAnswers, explanation = '', hint = '', points = 1, attachments = [] }) => {
      const row = {
        id: makeId('qq-'),
        quiz_set_id: quizSetId,
        order_no: orderNo,
        type,
        question,
        accepted_answers: acceptedAnswers,
        explanation,
        hint,
        points,
        attachments,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('quiz_questions').insert(row),
        { label: 'createQuizQuestion' }
      )
      if (error) throw error
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
      if (patch.type !== undefined) snake.type = patch.type
      if (patch.question !== undefined) snake.question = patch.question
      if (patch.acceptedAnswers !== undefined) snake.accepted_answers = patch.acceptedAnswers
      if (patch.explanation !== undefined) snake.explanation = patch.explanation
      if (patch.hint !== undefined) snake.hint = patch.hint
      if (patch.points !== undefined) snake.points = patch.points
      if (patch.attachments !== undefined) snake.attachments = patch.attachments

      const { error } = await withWriteRetry(
        () => supabase.from('quiz_questions').update(snake).eq('id', questionId),
        { label: 'updateQuizQuestion' }
      )
      if (error) throw error
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
      const { error } = await withWriteRetry(
        () => supabase.from('quiz_questions').delete().eq('id', questionId),
        { label: 'deleteQuizQuestion' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        quizQuestions: prev.quizQuestions.filter((q) => q.id !== questionId),
      }))
    },
    [setData]
  )

  return {
    submitQuizAttempt,
    updateQuizAttemptGrading,
    upsertScoreOnlyAttempt,
    createQuizSet,
    updateQuizSet,
    duplicateQuizSetShuffled,
    deleteQuizSet,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
  }
}
