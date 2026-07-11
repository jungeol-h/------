# selectors/ — 지표·판정 도메인 지식

전부 `(data, ...) => 결과` 순수함수. React 의존 없음 → vitest로 직접 테스트한다.
아래 수치는 기획 문서(보관: `docs/99. 보관됨/기획 원본(2026-07 반영완료)/개념 정리/`)에서
확정된 도메인 규칙이며, 임계값은 클라이언트 피드백에 따라 상수만 조정하면 되도록 분리돼 있다.

## 자기주도지수 (indices.js)

공식: 하루치 점수(0~20) = **학습시간 점수(0~10) + 자가평가 점수(0~10)** → 기록 있는
날들의 평균을 백분위(0~100) 환산.

- 학습시간 점수 구간표: 4h+ → 10 / 3h~3.5h+ → 9 / 2.5h+ → 7 / 2h+ → 5 / 1.5h+ → 3 / 1h+ → 1 / 미만 0
- 자가평가는 기획상 4종(학습량/집중도/만족도/효율성 각 10점)이지만 현재 스키마에는
  집중도(focus)만 있어 focus 단일 환산 — 스키마 확장 시 `selfEvalScore()`만 수정.

## 마인드 위험 판정 (riskDetection.js) — 기준이 2개다, 혼동 주의

마인드 자가점검: 주 3회, 기분/동기/자신감 각 -5~+5점.

| 용도 | 기준 | 사용처 |
|---|---|---|
| **코칭 위험 탐지** `evaluateMindLevel` | 합산 ≤ -6 또는 단일 ≤ -4 → warning, 합산 ≤ -9 또는 단일 ≤ -4 → danger | 매니저 홈 코칭 대상 |
| **관리자 주의 지표** `MIND_CAUTION_THRESHOLD = -3` | 최근 기록 세 지표 중 하나라도 ≤ -3 | 관리자 홈 "마인드 주의" |

## 출결·학습 주의 판정

- 출결 주의: 최근 **30일 결석 3회 이상** (`attendanceStats.js`의
  `ATTENDANCE_CAUTION_DAYS`/`ATTENDANCE_CAUTION_ABSENT_THRESHOLD`)
- 학습 주의: 최근 **7일 계획 이행률 60% 미만** (`weeklyLearning.js`의 `LEARNING_CAUTION_RATE`)
- 출결 자동 판정(지각/무단결석 확정)은 클라이언트가 아니라 **DB의 pg_cron**이 수행
  (`supabase_attendance_migration.sql`의 `judge_attendance()` — 등원예정 10분 경과 긴급알림,
  30분 경과 무단결석 확정).

## 파일 지도

| 파일 | 내용 |
|---|---|
| `learningRecords.js` | 학습기록 기본 유틸(actualMinutes 등) — selectors 중 최다 피참조 |
| `weeklyLearning.js` | 최근 7일 학습시간·이행률 (+ 학습 주의) |
| `indices.js` | 자기주도지수 |
| `riskDetection.js` | 마인드 위험/주의 |
| `attendance.js` / `attendanceStats.js` | 출결 요약·누적 통계 (+ 출결 주의) |
| `studentIndicators.js` | 관리자 학생 탭 지표 컬럼 (1-pass Map — 학생 수×기록 수 이중루프 금지) |
| `adminStats.js` | 관리자 통계 섹션 (누적 출결 60일·1인당 학습 30일·업무횟수) |
| `homeMessages.js` | 학생 홈 코멘트 말풍선 (상담 followUp·과제 마감·업무계획 태그) |
| `reflectionReport.js` | 종합 성장 리포트 데이터 조립 (getTaskSummary/getQuizSummary 포함) |
| `report.js` / `studentView.js` / `learningRecords.js` | 일일 리포트·학생 화면 파생값 |
| `reconciliation.js` | 출결-학습 대사(reconcile) |
| `workPlans.js` | 업무계획 파생값 |
