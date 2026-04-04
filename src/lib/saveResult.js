import { supabase } from './supabase'

export async function saveDiagnosisResult(state) {
  const { studentName, school, grade, studentPhone, parentPhone, preSurvey, answers, result } = state

  const { error } = await supabase.from('diagnosis_results').insert({
    student_name: studentName,
    school,
    grade,
    student_phone: studentPhone,
    parent_phone: parentPhone || null,
    pre_survey: preSurvey,
    answers,
    domain_scores: result.domainScores,
    domain_grades: result.domainGrades,
    core_indicators: result.coreIndicators,
    final_type: result.finalType,
    strength_domains: result.strengthDomains,
    weak_domains: result.weakDomains,
  })

  if (error) {
    console.error('결과 저장 실패:', error)
    throw error
  }
}
