// 학부모 역할 초기 데이터 fetch — 연결된 자녀(들)의 활동 데이터(읽기 전용).
// parent_children 매핑으로 자녀 studentIds를 구한 뒤, 매니저 fetch와 동일한
// 형태의 활동 데이터를 자녀들 대상으로만 조회한다. 어떤 write도 하지 않는다.
//
// parent_children 테이블이 아직 DB에 없어도 collectRows가 에러를 _fetchErrors에
// 수집하고 []를 돌려주므로 앱이 죽지 않는다(자녀 0명과 동일하게 처리).

import { supabase } from '../../lib/supabase.js'
import {
  toUser, toMindRecord, toDiaryRecord, toLearningRecord, toTask,
  toTodoItem, toCounselingRecord, toAttendanceRecord, toAttendanceSchedule,
  toParentChild, collectRows,
} from '../../lib/supabaseHelpers.js'
import { EMPTY } from '../dataModel.js'

export async function fetchForParent(userId) {
  const errors = []
  const meta = {}

  const linkRes = await supabase
    .from('parent_children')
    .select('*')
    .eq('parent_id', userId)
  const linkRows = collectRows(linkRes, 'parent_children', errors)
  const parentChildren = linkRows.map(toParentChild)
  const studentIds = parentChildren.map((l) => l.studentId)

  if (studentIds.length === 0) {
    // 연결된 자녀가 없거나 테이블 미존재 — 빈 데이터(에러 아님).
    return { ...EMPTY, parentChildren, _fetchErrors: errors, _fetchMeta: meta }
  }

  // 상담 코멘트 작성자 표기용 교육자 목록
  const educatorRoles = ['manager', 'admin', 'instructor', 'consultant']
  // 출결 기록은 최근 90일
  const attendanceSince = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const [
    studentsRes, learningRes, mindRes, tasksRes, todoRes, diaryRes,
    attendanceRes, schedulesRes, counselingRes, educatorsRes,
  ] = await Promise.all([
    supabase.from('users').select('*').in('id', studentIds),
    supabase.from('learning_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(3000),
    supabase.from('mind_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(2000),
    supabase.from('tasks').select('*').in('student_id', studentIds),
    supabase.from('todo_items').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(1000),
    supabase.from('diary_records').select('*').in('student_id', studentIds).order('date', { ascending: false }).limit(2000),
    supabase.from('attendance_records').select('*').in('student_id', studentIds).gte('date', attendanceSince).order('date', { ascending: false }),
    supabase.from('attendance_schedules').select('*').in('student_id', studentIds),
    supabase.from('counseling_records').select('*').in('student_id', studentIds).order('date', { ascending: false }),
    supabase.from('users').select('id,name,role').in('role', educatorRoles),
  ])

  return {
    ...EMPTY,
    students: collectRows(studentsRes, 'users', errors).map(toUser),
    educators: collectRows(educatorsRes, 'users', errors).map(toUser),
    learningRecords: collectRows(learningRes, 'learning_records', errors).map(toLearningRecord),
    mindRecords: collectRows(mindRes, 'mind_records', errors).map(toMindRecord),
    tasks: collectRows(tasksRes, 'tasks', errors).map(toTask),
    todoItems: collectRows(todoRes, 'todo_items', errors).map(toTodoItem),
    diaryRecords: collectRows(diaryRes, 'diary_records', errors).map(toDiaryRecord),
    attendanceRecords: collectRows(attendanceRes, 'attendance_records', errors).map(toAttendanceRecord),
    attendanceSchedules: collectRows(schedulesRes, 'attendance_schedules', errors).map(toAttendanceSchedule),
    counselingRecords: collectRows(counselingRes, 'counseling_records', errors).map(toCounselingRecord),
    parentChildren,
    _fetchErrors: errors,
    _fetchMeta: meta,
  }
}
