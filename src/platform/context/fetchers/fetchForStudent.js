// 학생 역할 초기 데이터 fetch — 본인 데이터 + 본인 학년의 공개 회차.

import { supabase } from '../../lib/supabase.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toTodoItem, toCareerDesignResult, toLearningDiagnosisResult,
  toAssignment, toQuizSet, toQuizQuestion, toQuizAttempt,
  collectRows,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'

export async function fetchForStudent(userId) {
  const [userRes, assnRes, mindRes, learningRes, tasksRes, todoRes, diaryRes, careerRes, diagRes, attemptsRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).limit(1),
    supabase.from('assignments').select('*').eq('student_id', userId),
    supabase.from('mind_records').select('*', { count: 'exact' }).eq('student_id', userId).order('date', { ascending: false }).limit(2000),
    supabase.from('learning_records').select('*', { count: 'exact' }).eq('student_id', userId).order('date', { ascending: false }).limit(3000),
    supabase.from('tasks').select('*').eq('student_id', userId),
    supabase.from('todo_items').select('*', { count: 'exact' }).eq('student_id', userId).order('date', { ascending: false }).limit(1000),
    supabase.from('diary_records').select('*', { count: 'exact' }).eq('student_id', userId).order('date', { ascending: false }).limit(1000),
    supabase.from('career_results').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('diagnosis_results').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('quiz_attempts').select('*').eq('student_id', userId),
  ])

  const errors = []
  const meta = {}
  const recordMeta = (res, table) => {
    if (res?.error || res?.count == null) return
    meta[table] = { fetched: (res.data ?? []).length, total: res.count }
  }
  recordMeta(mindRes, 'mind_records')
  recordMeta(learningRes, 'learning_records')
  recordMeta(todoRes, 'todo_items')
  recordMeta(diaryRes, 'diary_records')

  const userRows = collectRows(userRes, 'users', errors)
  const me = userRows[0]
  const myGrade = me?.grade ?? ''
  // 학생 본인 학년의 회차만 노출
  const setsRes = myGrade
    ? await supabase.from('quiz_sets').select('*').eq('grade', myGrade).eq('is_published', true).order('round')
    : { data: [] }
  const setRows = collectRows(setsRes, 'quiz_sets', errors)
  const setIds = setRows.map((s) => s.id)
  const questionsRes = setIds.length > 0
    ? await supabase.from('quiz_questions').select('*').in('quiz_set_id', setIds).order('order_no')
    : { data: [] }

  return {
    ...EMPTY,
    students: userRows.map(toUser),
    assignments: collectRows(assnRes, 'assignments', errors).map(toAssignment),
    mindRecords: collectRows(mindRes, 'mind_records', errors).map(toMindRecord),
    learningRecords: collectRows(learningRes, 'learning_records', errors).map(toLearningRecord),
    tasks: collectRows(tasksRes, 'tasks', errors).map(toTask),
    todoItems: collectRows(todoRes, 'todo_items', errors).map(toTodoItem),
    diaryRecords: collectRows(diaryRes, 'diary_records', errors).map(toDiaryRecord),
    careerDesignResults: collectRows(careerRes, 'career_results', errors).map(toCareerDesignResult),
    learningDiagnosisResults: collectRows(diagRes, 'diagnosis_results', errors).map(toLearningDiagnosisResult),
    quizSets: setRows.map(toQuizSet),
    quizQuestions: collectRows(questionsRes, 'quiz_questions', errors).map(toQuizQuestion),
    quizAttempts: collectRows(attemptsRes, 'quiz_attempts', errors).map(toQuizAttempt),
    _fetchErrors: errors,
    _fetchMeta: meta,
  }
}
