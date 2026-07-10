// 학생 역할 초기 데이터 fetch — 본인 데이터 + 본인 학년의 공개 회차.

import { supabase } from '../../lib/supabase.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toTodoItem, toCareerDesignResult, toLearningDiagnosisResult,
  toAssignment, toQuizSet, toQuizQuestion, toQuizAttempt,
  toAttendanceRecord, toAttendanceSchedule,
  toDailySelfScore, toCounselingRecord, toWorkPlan,
  collectRows,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'
import { toDateStr } from '../selectors/weeklyLearning.js'

export async function fetchForStudent(userId) {
  const todayStr = toDateStr(new Date())
  const [userRes, assnRes, mindRes, learningRes, tasksRes, todoRes, diaryRes, careerRes, diagRes, attemptsRes, attendanceRes, schedulesRes, loginCountRes, selfScoresRes, counselingRes, workPlansRes] = await Promise.all([
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
    supabase.from('attendance_records').select('*').eq('student_id', userId).order('date', { ascending: false }),
    supabase.from('attendance_schedules').select('*').eq('student_id', userId),
    // 로그인 횟수 — 행 전송 없이 count만
    supabase.from('login_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('daily_self_scores').select('*').eq('student_id', userId).order('date', { ascending: false }).limit(60),
    // 홈 말풍선용 — 상담 본문(content 등)은 학생에게 노출하지 않도록 제한 컬럼만
    supabase.from('counseling_records').select('id,student_id,date,type,follow_up,next_appointment').eq('student_id', userId).order('date', { ascending: false }).limit(10),
    // 본인이 태그된 예정 업무계획 (일정 리마인더용)
    supabase.from('work_plans').select('*').contains('student_ids', JSON.stringify([userId])).gte('plan_date', todayStr),
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
    attendanceRecords: collectRows(attendanceRes, 'attendance_records', errors).map(toAttendanceRecord),
    attendanceSchedules: collectRows(schedulesRes, 'attendance_schedules', errors).map(toAttendanceSchedule),
    loginCount: loginCountRes?.error ? null : loginCountRes?.count ?? null,
    dailySelfScores: collectRows(selfScoresRes, 'daily_self_scores', errors).map(toDailySelfScore),
    counselingRecords: collectRows(counselingRes, 'counseling_records', errors).map(toCounselingRecord),
    workPlans: collectRows(workPlansRes, 'work_plans', errors).map(toWorkPlan),
    _fetchErrors: errors,
    _fetchMeta: meta,
  }
}
