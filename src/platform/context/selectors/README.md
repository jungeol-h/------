# selectors/ — 지표·판정 도메인 지식

전부 `(data, ...) => 결과` 순수함수. React 의존 없음 → vitest로 직접 테스트한다.

이 문서는 **지표·판정의 비즈니스 규칙과 그 근거**를 남기는 곳이다 (기획 원본은
`docs/99. 보관됨/기획 원본(2026-07 반영완료)/개념 정리/`에 보관, 핵심만 여기로 이관됨).
임계값은 클라이언트 피드백에 따라 조정될 수 있게 이름 있는 상수로 분리돼 있다 —
**현행 값은 코드의 상수가 정본**이고, 아래 수치는 클라이언트와 확정한 기준이므로
상수를 바꿀 때는 클라이언트 합의와 이 문서 갱신이 함께 가야 한다.

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

## 파일 찾기

파일명이 곧 도메인이다 (`attendance*` 출결, `indices` 자기주도지수, `riskDetection` 마인드,
`weeklyLearning` 주간 학습, `*Report`/`report` 리포트 데이터 조립, `workPlans` 업무계획 …) —
목록은 폴더를 직접 볼 것. 이름만으로 안 보이는 것만 적는다:

- `learningRecords.js` — 학습기록 기본 유틸. **selectors 중 최다 피참조** — 수정 파급이 가장 크다.
- `studentIndicators.js` — 관리자 학생 탭 지표. **1-pass Map 구조를 유지할 것**
  (학생 수×기록 수 이중루프 금지).
- `reconciliation.js` — 출결-학습 대사(reconcile): 두 도메인 기록의 모순 탐지.
