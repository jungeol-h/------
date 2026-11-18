// 진로 설계 검사 계열 코드 → 한글 라벨. PDF 요약 리포트가 페이지 컴포넌트
// (pages/student/CareerDesignTab)를 import하지 않고 쓰도록 분리한 순수 상수.
// CareerDesignTab의 CATEGORIES와 같은 7계열 — 계열 추가 시 두 곳 함께 수정.
export const CAREER_CATEGORY_LABELS = {
  HUMANITIES: '인문',
  SOCIAL: '사회',
  ENGINEERING: '공학',
  NATURAL: '자연',
  HEALTH: '보건',
  EDUCATION: '교육',
  ARTS_SPORTS: '예체능',
}
