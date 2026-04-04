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
    domain_scores: result.koreanDomainScores,
    domain_grades: result.koreanDomainGrades,
    core_indicators: result.koreanCoreIndicators,
    final_type: result.finalType,
    strength_domains: result.koreanStrengthDomains,
    weak_domains: result.koreanWeakDomains,
  })

  if (error) {
    console.error('결과 저장 실패:', error)
    throw error
  }
}
