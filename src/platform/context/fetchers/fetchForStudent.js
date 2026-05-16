// 학생 역할 초기 데이터 fetch — 본인 데이터 + 본인 학년의 공개 회차.

import { supabase } from '../../lib/supabase.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toTodoItem, toCareerDesignResult, toLearningDiagnosisResult,
  toAssignment, toQuizSet, toQuizQuestion, toQuizAttempt,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'

export async function fetchForStudent(userId) {
  const [userRes, assnRes, mindRes, learningRes, tasksRes, todoRes, diaryRes, careerRes, diagRes, attemptsRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).limit(1),
    supabase.from('assignments').select('*').eq('student_id', userId),
    supabase.from('mind_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(50),
    supabase.from('learning_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(100),
    supabase.from('tasks').select('*').eq('student_id', userId),
    supabase.from('todo_items').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(30),
    supabase.from('diary_records').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(10),
    supabase.from('career_results').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('diagnosis_results').select('*').eq('student_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('quiz_attempts').select('*').eq('student_id', userId),
  ])

  const me = (userRes.data ?? [])[0]
  const myGrade = me?.grade ?? ''
  // 학생 본인 학년의 회차만 노출
  const setsRes = myGrade
    ? await supabase.from('quiz_sets').select('*').eq('grade', myGrade).eq('is_published', true).order('round')
    : { data: [] }
  const setIds = (setsRes.data ?? []).map((s) => s.id)
  const questionsRes = setIds.length > 0
    ? await supabase.from('quiz_questions').select('*').in('quiz_set_id', setIds).order('order_no')
    : { data: [] }

  return {
    ...EMPTY,
    students: (userRes.data ?? []).map(toUser),
    assignments: (assnRes.data ?? []).map(toAssignment),
    mindRecords: (mindRes.data ?? []).map(toMindRecord),
    learningRecords: (learningRes.data ?? []).map(toLearningRecord),
    tasks: (tasksRes.data ?? []).map(toTask),
    todoItems: (todoRes.data ?? []).map(toTodoItem),
    diaryRecords: (diaryRes.data ?? []).map(toDiaryRecord),
    careerDesignResults: (careerRes.data ?? []).map(toCareerDesignResult),
    learningDiagnosisResults: (diagRes.data ?? []).map(toLearningDiagnosisResult),
    quizSets: (setsRes.data ?? []).map(toQuizSet),
    quizQuestions: (questionsRes.data ?? []).map(toQuizQuestion),
    quizAttempts: (attemptsRes.data ?? []).map(toQuizAttempt),
  }
}
