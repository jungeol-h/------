// 복수 담당업무 교직원 매핑 — 계정 이중화 없이 보고서·기록 작성 UI에서 업무를
// 분리하기 위한 프론트 상수 (DB 변경 없음).
//
// 2026-08-02 클라이언트 확정: 황광희는 국어·진로진학컨설팅 두 업무의 월간 보고서가
// 각각 나가야 하고, 자기주도학습코칭은 보고서 출력 대상이 아니다. 두 duty 어디에도
// 속하지 않는 유형(자기주도학습코칭·검사·생활적응·기타)은 duty 보고서에 포함되지 않는다.
//
// duty.type: 보고서 모달의 유형 필터(filterType)로 쓰는 대표 유형 — 구 체계 기록은
// MonthlyReportModal의 LEGACY_TYPE_ALIASES가 함께 잡는다(subject_learning→study 등).
// duty.types: 이 업무로 간주하는 유형 전체(구 체계 포함) — 작성 폼의 업무 배지 판정용.

export const EDUCATOR_DUTIES = {
  'a-hwang': [
    { key: 'korean', label: '국어', reportDuty: '국어 컨설팅', type: 'subject_learning', types: ['subject_learning', 'study'] },
    { key: 'career', label: '진로진학컨설팅', reportDuty: '진로진학 컨설팅', type: 'career_path', types: ['career_path', 'career'] },
  ],
}

// 해당 교직원이 복수 담당업무인가 — 작성 폼의 유형 명시 선택 강제 여부.
export function hasMultipleDuties(educatorId) {
  return (EDUCATOR_DUTIES[educatorId]?.length ?? 0) > 1
}

// 상담유형이 속하는 duty. 없으면 null(어느 업무 보고서에도 포함되지 않는 유형).
export function dutyOfType(educatorId, type) {
  return EDUCATOR_DUTIES[educatorId]?.find((d) => d.types.includes(type)) ?? null
}
