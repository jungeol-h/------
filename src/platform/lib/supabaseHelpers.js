// Supabase DB row(snake_case) → DataContext 형식(camelCase) 변환 헬퍼

export const toUser = (row) => ({
  id: row.id,
  loginId: row.login_id,
  name: row.name,
  role: row.role,
  school: row.school ?? '',
  grade: row.grade ?? '',
  selfIndex: row.self_index ?? 70,
  riskLevel: row.risk_level ?? 'normal',
  status: row.status ?? 'active',
})

export const toMindRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  mood: row.mood,
  motivation: row.motivation,
  confidence: row.confidence,
  memo: row.memo ?? '',
})

export const toDiaryRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  praise: row.praise ?? '',
  reflection: row.reflection ?? '',
  resolution: row.resolution ?? '',
})

export const toLearningRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  subject: row.subject,
  duration: row.duration,
  focus: row.focus,
})

export const toTask = (row) => ({
  id: row.id,
  studentId: row.student_id,
  title: row.title,
  subject: row.subject,
  dueDate: row.due_date,
  dueTime: row.due_time ?? '23:59',
  status: row.status ?? 'pending',
  assignerName: row.assigner_name ?? '',
})

export const toCounselingRecord = (row) => ({
  id: row.id,
  studentId: row.student_id,
  educatorId: row.manager_id,
  date: row.date,
  comment: row.content,
  type: row.type ?? 'study',
})

export const toAlert = (row) => ({
  id: row.id,
  studentId: row.student_id,
  managerId: row.manager_id,
  type: row.type ?? 'mind',
  level: row.severity ?? 'warning',
  message: row.message,
  detail: row.detail ?? '',
  date: row.date,
  resolved: row.resolved ?? false,
  coachingComment: row.coaching_comment ?? '',
})

export const toTodoItem = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  subject: row.subject,
  plannedMin: row.planned_min,
  done: row.done ?? false,
})

export const toCareerDesignResult = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  selectedVerbs: row.selected_verbs ?? [],
  selectedActivities: row.selected_activities ?? [],
  selectedCategories: row.selected_categories ?? [],
  primaryCat: row.primary_cat ?? '',
  typeName: row.type_name ?? '',
  finalScores: row.final_scores ?? {},
  fields: row.fields ?? [],
})

export const toLearningDiagnosisResult = (row) => ({
  id: row.id,
  studentId: row.student_id,
  date: row.date,
  answers: row.answers ?? [],
  domainScores: row.domain_scores ?? {},
  stageScores: row.stage_scores ?? {},
  stageGrades: row.stage_grades ?? {},
  stateTypes: row.state_types ?? {},
  typeName: row.type_name ?? '',
})

// flat 형식 [{ educatorId, studentId }] — 기존 컴포넌트 코드와 호환
export const toAssignment = (row) => ({
  educatorId: row.educator_id,
  studentId: row.student_id,
})
