# context/ — 데이터 계층 (4계층)

전역 상태는 `DataContext.jsx` 하나의 `data` 객체(컬렉션별 배열, 스키마는 `dataModel.js`의
`EMPTY`)로 관리한다. 서버 상태 라이브러리 없음 — fetch 후 로컬 배열을 직접 갱신한다.

```
AuthContext.jsx   로그인(users 테이블 평문 비교)·localStorage 세션 — lib/README.md 보안 부채 참고
DataContext.jsx   Provider 조립만. 역할별 fetch 라우팅 + 도메인 훅 병합 → useData()
├── fetchers/     역할별 초기 fetch (student/manager/admin/parent — instructor·consultant·viewer는 admin 공용)
├── domains/      [Write] 도메인별 CRUD 훅 — supabase 쓰기 + setData 로컬 동기화
└── selectors/    [Read] 순수함수 (data, ...) => 결과 — 페이지가 직접 import
```

## 데이터 흐름

1. 로그인 → `DataContext`가 역할별 fetcher 실행 → `data` 채움 (`dataReady=true`)
2. 페이지는 `useData()`로 `data`+쓰기 함수를 얻고, 파생값은 selector 순수함수로 계산
3. 쓰기 = 도메인 훅: DB 쓰기 성공 시 `setData`로 같은 모양을 로컬에 반영 (refetch 없음)
4. 수동 새로고침은 `refetch()` — `refreshing` 플래그만 켜져 전체 로더로 전환되지 않음

fetch 실패는 죽이지 않고 `data._fetchErrors`에 수집 → 화면 상단 배너.
(마이그레이션 미적용 시 이 배너가 뜬다 — `scripts/README.md` 참고)

## 새 도메인(테이블) 추가 체크리스트

1. `scripts/add-*.sql` 마이그레이션 작성 (멱등) — 적용 절차는 `scripts/README.md`
2. `lib/supabaseHelpers.js`에 `toXxx` 변환기 (snake→camel, 누락 컬럼 `??` 기본값)
3. `dataModel.js` `EMPTY`에 컬렉션 추가
4. 필요한 역할의 `fetchers/fetchForXxx.js`에 조회 추가 (제한 컬럼 원칙: 학생 fetch에는
   민감 컬럼 넣지 말 것 — fetchForStudent의 상담 조회 참고)
5. `domains/xxxDomain.js` 작성 — 순수 필드 매핑 CRUD면 **`domains/crudKit.js`의
   makeAdder/makeUpdater/makeDeleter로 선언** (모범: `workRecordsDomain.js`,
   `workPlanDomain.js`). 시그니처가 특수하면 직접 작성해도 되고, 그때도 규약
   (withWriteRetry → throw → setData 동기화)은 crudKit 헤더 주석대로 지킬 것
6. `DataContext.jsx`에 훅 연결 (import → 호출 → value 스프레드 → useMemo deps)
7. cross-domain 파생값이 필요하면 `selectors/`에 순수함수 추가 + vitest 단위테스트
   (`*.test.js` — 기존 selector 테스트 패턴 따라할 것)

## 알림(위험 신호) 설계 — 두 방식이 공존한다

- **위험 탐지 = 계산형**: 레코드를 만들지 않고 조회 시점에 selector로 계산
  (`selectors/riskDetection.js`, 관제탑형). 대시보드의 "주의 학생"이 이것.
- **코칭 기록 = 레코드형**: 교육자의 조치는 `alerts`·`counseling_records`에 남긴다
  (`domains/alertDomain.js`의 recordCoaching — 코칭 코멘트가 상담 기록으로도 등록).
- OS 푸시 알림은 **미구현** (인앱 배너만 존재). 구현 체크리스트는 루트 README 참고.
