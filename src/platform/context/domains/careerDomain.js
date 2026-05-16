// [Write] 진로설계 + 학습진단 결과 도메인 CRUD. 둘 다 학생당 1개 유지
// (기존 레코드 삭제 후 삽입). 결과 저장이라는 같은 성격이라 한 도메인에 둔다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  toCareerDesignResult,
  toLearningDiagnosisResult,
} from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'

export function useCareerDomain(setData) {
  // 진로설계 결과 저장 (학생당 1개)
  const saveCareerDesignResult = useCallback(
    async (studentId, {
      selectedVerbs, selectedActivities, selectedCategories,
      primaryCat, typeName, finalScores, fields,
    }) => {
      const row = {
        id: makeId('cr'),
        student_id: studentId,
        date: new Date().toISOString().slice(0, 10),
        selected_verbs: selectedVerbs,
        selected_activities: selectedActivities,
        selected_categories: selectedCategories,
        primary_cat: primaryCat,
        type_name: typeName,
        final_scores: finalScores,
        fields,
      }
      await supabase.from('career_results').delete().eq('student_id', studentId)
      const { error } = await supabase.from('career_results').insert(row)
      if (error) {
        console.error('saveCareerDesignResult insert error:', error)
        throw error
      }
      setData((prev) => ({
        ...prev,
        careerDesignResults: [
          ...prev.careerDesignResults.filter((r) => r.studentId !== studentId),
          toCareerDesignResult(row),
        ],
      }))
    },
    [setData]
  )

  // 학습진단 결과 저장 (학생당 1개)
  const saveLearningDiagnosisResult = useCallback(
    async (studentId, resultData) => {
      const row = {
        id: makeId('dr'),
        student_id: studentId,
        date: new Date().toISOString().slice(0, 10),
        answers: resultData.answers ?? [],
        domain_scores: resultData.domainScores ?? {},
        stage_scores: resultData.stageScores ?? {},
        stage_grades: resultData.stageGrades ?? {},
        state_types: resultData.stateTypes ?? {},
        type_name: resultData.typeName ?? '',
      }
      await supabase.from('diagnosis_results').delete().eq('student_id', studentId)
      const { error } = await supabase.from('diagnosis_results').insert(row)
      if (error) {
        console.error('saveLearningDiagnosisResult insert error:', error)
        throw error
      }
      setData((prev) => ({
        ...prev,
        learningDiagnosisResults: [
          ...prev.learningDiagnosisResults.filter((r) => r.studentId !== studentId),
          toLearningDiagnosisResult(row),
        ],
      }))
    },
    [setData]
  )

  return { saveCareerDesignResult, saveLearningDiagnosisResult }
}
