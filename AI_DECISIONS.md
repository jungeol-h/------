#### [2026-06-03] 학생 선택을 검색형 콤보박스로 직접 구현(무라이브러리)

- **Context & Ambiguity:** 학생 수가 많아 일반 `select` 드롭다운 UX가 나쁘다는 지적. "검색·자동 드롭다운"을 요청했으나 라이브러리 사용 여부, 키보드 동작 범위, 선택 후 표시 방식은 미지정.
- **Your Choice & Action:** 새 의존성 없이 `StudentCombobox.jsx`를 직접 구현 — input 필터링 + 드롭다운 + 키보드 내비(↑↓/Enter/Esc) + 외부 클릭 닫기 + 선택 해제(X) 버튼. 항목 선택은 input `blur`보다 먼저 확정되도록 `onMouseDown`+`preventDefault`로 처리. 활성 인덱스 리셋은 effect 대신 상태 변경 지점(입력/열기/해제)에서 인라인 처리(React Compiler의 set-state-in-effect 경고 회피). `labelOf`는 모듈 스코프로 올려 `useMemo` 의존성 추론 충돌 제거.
- **Reasoning & Justification:** 베타 규모(50~60명)에 외부 콤보박스 라이브러리 도입은 과함 — 번들·의존성 증가 대비 이득 적음. 기존 코드도 라이브러리 없이 패턴을 직접 구현하는 결을 따름. `onMouseDown` 선택 확정은 input과 드롭다운이 공존할 때의 표준 회피책.
- **Potential Risk / Review Required:** (1) 모바일 터치에서 `onMouseDown`+`preventDefault` 동작과 가상키보드 상호작용을 실기기 확인 권장. (2) 매우 많은 학생(수백+) 시 필터 후 전체 렌더 — 현재 규모엔 무방하나 확장 시 가상 스크롤 필요. (3) 학교/학년이 비어도 라벨 정규식(`/\s+\)/`)으로 괄호 정리하나 엣지 케이스 표시 확인 요망.

#### [2026-06-03] 상담 탭을 모달 트리거에서 상시 노출 인라인 폼으로 전환

- **Context & Ambiguity:** "버튼→모달" 대신 탭 진입 시 작성 폼이 상단에 상시 노출되고 아래에 리스트가 오는 구조로 바꿔달라는 요청. 단 (1) 폼 저장 성공 시의 피드백 방식, (2) 학생상세(`StudentDetailPage`)가 쓰던 기존 `CounselingFormModal`의 거취, (3) 저장 후 폼 상태 유지 여부가 명시되지 않았다.
- **Your Choice & Action:** 매니저/관리자 탭이 거의 동일하므로 공용 `CounselingTabContent.jsx`로 추출하고 두 탭은 `students/records/showAuthor/authorId` props 차이만 넘기는 얇은 래퍼로 축소. 인라인 폼은 셀렉트 2개(피상담자·유형) 그리드 행 + 전폭 textarea + 우측 저장 버튼의 자연스러운 세로 스택. (초기엔 노션 PC 정책에 맞춰 가로 한 줄로 강제했으나 저장 버튼 overflow 버그가 생겨 사용자 지시로 가이드를 무시하고 세로 레이아웃으로 재구현.) 저장 성공 시 별도 성공 토스트 없이 **폼을 비워서**(학생·유형·내용 모두 초기화) 성공을 암시. `CounselingFormModal`은 학생상세에서 `fixedStudent`로 계속 쓰이므로 **삭제하지 않고 보존**.
- **Reasoning & Justification:** 기존 토스트 인프라는 에러 전용(성공 토스트 어휘 없음)이라 폼 클리어가 가장 결이 맞는 성공 신호다. 학생상세는 "특정 학생 고정" 맥락이라 셀렉트 없는 모달이 여전히 적절 — 공용 컴포넌트로 억지로 합치면 props 분기만 늘어 모달을 유지하는 편이 깔끔.
- **Potential Risk / Review Required:** (1) 저장 후 학생·유형까지 모두 비우므로 같은 학생을 연속 상담 기록할 때 매번 재선택해야 함 — 운영자가 불편해하면 학생/유형은 유지하는 편이 나을 수 있음. (2) textarea `resize-y`라 매우 길게 늘리면 가로 한 줄 정렬이 깨질 수 있으나 `items-stretch`로 허용 범위로 판단.

#### [2026-06-03] 미마운트 Provider 크래시 수정 + 에러 토스트 전역 브리지로 일원화

- **Context & Ambiguity:** `useFeedback must be used within FeedbackProvider` 런타임 크래시를 조사하니, `FeedbackProvider`/`ToastProvider`가 만들어져 있는데 `App.jsx` 트리에 **마운트되지 않은** 상태였다(최근 피드백 커밋이 Header에 FeedbackButton만 추가하고 Provider 배선을 누락). 또 `ToastProvider`(저장실패 토스트)는 어디서도 사용되지 않았고, 11곳이 인라인 `SaveErrorBox`로 에러를 표시 중이었다. "토스트로 일원화 + SaveErrorBox 제거"로 방향을 잡았는데, 모듈 함수인 `withWriteRetry`가 React context의 토스트 함수에 어떻게 닿을지가 관건이었다.
- **Your Choice & Action:** (1) `App.jsx`에 `FeedbackProvider > ToastProvider`로 라우트 트리를 감쌌다. (2) `supabaseRetry.js`에 모듈 레벨 슬롯(`registerErrorToast`)을 두고, `ToastProvider`가 mount 시 `useEffect`로 자신의 `showErrorToast`를 등록하게 했다. `withWriteRetry`는 최종 실패 시점(throw/return 양 경로)에서 `reportError` 직후 이 슬롯으로 토스트를 쏜다. (3) 11개 호출부의 `SaveErrorBox`+에러 state를 제거하고 catch는 빈 처리(또는 제어흐름용 `return` 유지)로 단순화. `SaveErrorBox.jsx` 파일 삭제.
- **Reasoning & Justification:** 전역 브리지는 `withWriteRetry`가 이미 모든 최종 실패를 중앙에서 처리하고 `sentryEventId`를 error에 부착("Toast UI의 신고 prefill용")하는 기존 설계의 자연스러운 seam이다. 호출부 11곳을 개별로 `showErrorToast` 호출로 바꾸는 방식보다 변경면이 좁고 누락 위험이 없다. context 접근 불가 문제는 등록 슬롯 패턴으로 우회.
- **Potential Risk / Review Required:** (1) 모듈 싱글톤 슬롯이라 `ToastProvider`가 두 번 마운트되면 마지막 것만 유효(현재 단일 마운트라 무방). (2) 진단/진로 탭의 일부 catch는 실패 시 `return`으로 결과단계 진입을 막는 제어흐름이 있었으므로 그 `return`은 보존했다 — 이 두 곳은 토스트로 알림 + 단계 미진입이 맞는지 확인 요망. (3) 로그인 화면 등 Provider 밖에서 발생하는 저장 실패는 토스트 핸들러 미등록이라 조용히 넘어간다(Sentry에는 기록됨).

#### [2026-06-03] counseling_records.manager_id를 "작성자 ID"로 재해석

- **Context & Ambiguity:** 상담 작성 권한을 매니저(담당 학생)뿐 아니라 관리자(전체)에게도 부여하기로 결정됐는데, `counseling_records` 테이블에는 `manager_id`(NOT NULL, FK users) 컬럼만 있고 관리자용 작성자 컬럼이 없다. 스키마를 바꿀지(작성자 컬럼 추가) 기존 컬럼을 재사용할지 모호했다.
- **Your Choice & Action:** 스키마 변경 없이 `manager_id`를 "작성자(매니저 또는 관리자) user id"로 의미 확장했다. `addCounselingRecord({ studentId, authorId, content, type })`가 `manager_id: authorId`로 insert한다. 변환기 `toCounselingRecord`가 이미 이 컬럼을 `educatorId`로 매핑하고 있어 코드상 이름도 자연스럽게 맞는다.
- **Reasoning & Justification:** FK가 `users(id)`라 관리자 id도 제약을 위반하지 않는다. 베타 운영 중 마이그레이션은 리스크이고, 컬럼 추가의 실익이 작다(작성자 역할은 `users.role`로 조회 가능). 기존 코칭 흐름(`recordCoaching`)도 동일 컬럼에 매니저 id를 넣고 있어 일관적이다.
- **Potential Risk / Review Required:** 컬럼명이 `manager_id`인데 실제로는 관리자도 들어가므로, 추후 "매니저가 작성한 것만" 집계하는 쿼리를 짜면 관리자 작성분이 섞일 수 있다. 작성자 역할 구분이 필요해지면 `educators`에서 role 조인으로 필터해야 함(관리자 탭은 이미 그렇게 작성자명만 표시).

#### [2026-06-03] 상담 카테고리에 'etc'(기타) 추가 + 공용 상수 추출

- **Context & Ambiguity:** 사용자는 "상담 항목을 자체적으로 마련"을 요구하면서 최소 구조(카테고리+자유서술)를 택했다. 기존 type은 `mind`/`career`/`study` 3종뿐이라 마인드 코칭 외 일반 상담을 분류할 칸이 부족했다. 항목을 얼마나 늘릴지는 명시되지 않았다.
- **Your Choice & Action:** `etc`(기타) 1종만 추가해 4종으로 했고, `CounselingTab`에 인라인돼 있던 `TYPE_LABELS`를 `src/platform/data/counselingTypes.js` 공용 상수(`COUNSELING_TYPES`, `COUNSELING_TYPE_LABELS`)로 추출해 작성 폼/매니저 탭/관리자 탭/학생상세 4곳에서 재사용했다.
- **Reasoning & Justification:** 최소 구조 요구에 맞춰 항목을 과하게 늘리지 않되, 분류 불가 케이스를 흡수할 `기타`만 더했다. 향후 확장은 이 상수 파일 한 곳만 수정하면 되도록 단일 출처화.
- **Potential Risk / Review Required:** DB `type` 기본값은 여전히 `study`라, UI 외 경로로 들어온 레코드가 `study`로 뭉칠 수 있다. 카테고리 체계를 더 세분화하려면 라벨뿐 아니라 사용자와 분류 기준 합의 필요.

#### [2026-06-03] 매니저 CounselingTab의 educatorId 필터 버그 수정

- **Context & Ambiguity:** 기존 `CounselingTab`은 `r.managerId === currentUser?.id`로 필터했으나, 변환기는 해당 필드를 `educatorId`로 매핑한다(=`r.managerId`는 항상 undefined). 즉 필터가 사실상 동작하지 않던 잠복 버그였다. 요청 범위(작성 기능)와 별개지만 같은 파일을 건드리는 김에 고칠지 판단이 필요했다.
- **Your Choice & Action:** `r.educatorId === currentUser?.id`로 수정했다. 작성 기능 추가와 함께 같은 탭에서 처리.
- **Reasoning & Justification:** 작성 기능을 붙이는 순간 이 필터가 실제로 의미를 가지게 되므로(매니저는 본인이 작성/담당한 상담만 봐야 함), 방치하면 신규 기능이 잘못된 데이터를 보여준다. 인접 코드의 명백한 결함이라 spontaneous refactoring 범위로 판단.
- **Potential Risk / Review Required:** 과거에 필터가 무력화돼 있던 동안 매니저가 "전체 상담"을 봐 왔을 가능성(데이터가 적어 드러나지 않았을 수 있음). 수정 후 매니저 화면에 본인 작성분만 나오는지, 기존 코칭으로 생성된 상담이 정상 표시되는지 확인 요망.

#### [2026-06-03] CounselingFormModal 단일 컴포넌트 재사용 + 학생상세는 탭 신설

- **Context & Ambiguity:** 작성 진입점을 "상담 탭 + 학생상세 양쪽"으로 하기로 했는데, 매니저/관리자/학생상세 3곳의 학생 선택 범위가 제각각(담당만/전체/고정 1명)이다. 모달을 3벌 만들지, 1벌로 분기할지 모호했다.
- **Your Choice & Action:** 모달 1개(`CounselingFormModal`)로 통일하고 `fixedStudent`(고정) vs `students`(드롭다운) prop으로 분기했다. 학생상세 페이지는 기존 탭 구조(`마인드/일기/.../진로설계`)에 `상담` 탭을 끝에 추가하는 방식으로 진입점을 마련했다(별도 모달 트리거 버튼을 본문에 흩뿌리지 않음).
- **Reasoning & Justification:** 마크업·저장 로직 중복을 피하고, 권한별 학생 목록 주입만 호출부 책임으로 분리. 학생상세는 이미 탭 패러다임이라 새 섹션을 탭으로 얹는 게 일관적이고 발견성이 좋다.
- **Potential Risk / Review Required:** 학생상세의 `상담` 탭은 매니저/관리자 공용 페이지에 모두 노출된다. 매니저가 담당 외 학생 상세에 접근하는 경로가 생기면 그 학생에게도 작성 가능해지므로, 라우팅 단의 접근 제어가 유일한 방어선이다(RLS는 anon_all). `project_security_debt` 범위.

#### [2026-05-27] 네트워크 실패 시 낙관적 업데이트 대신 자동 재시도 채택

- **Context & Ambiguity:** Mobile Safari 네트워크 일시 단절 시 사용자에게 "저장 안 됨"으로 보이는 UX 버그를 잡아야 했다. 후보는 (A) 낙관적 업데이트 + 롤백, (B) 짧은 백오프로 자동 재시도, (C) IndexedDB 오프라인 큐. 사용자는 B를 선택했다.
- **Your Choice & Action:** `withWriteRetry`로 통일된 재시도 래퍼를 만들고 23개 write 함수 전체에 적용. 백오프 [300, 800, 2000]ms 3회 후 실패하면 기존 `SaveErrorBox` 흐름으로 떨어진다.
- **Reasoning & Justification:** A는 23개 함수마다 롤백 로직 신규 도입이 필요해 새 버그 위험이 큼. C는 베타 규모(50-60명)에 비해 인프라 과투자. B는 코드 변경 최소이면서 가장 흔한 실패 모드(짧은 네트워크 깜빡임)를 잡는다. 사용자 체감 대기 한도(누적 3.1초)를 넘지 않도록 백오프 값 선정.
- **Potential Risk / Review Required:** 누적 3.1초 대기가 일부 액션(과제 토글 등)에서 길게 느껴질 수 있음. 정상 네트워크 환경에서는 1회차에서 즉시 성공하므로 영향 없을 것으로 추정하나, 실 사용자 피드백 모니터링 필요.

#### [2026-05-27] 재시도 가능 에러 분류 기준

- **Context & Ambiguity:** Supabase write가 실패하는 케이스는 다양(네트워크 단절, 인증 만료, RLS 거부, PK 충돌, 5xx). 어디까지 재시도 대상인지 명시 없음.
- **Your Choice & Action:** (1) `TypeError` 인스턴스, (2) 메시지에 'load failed' / 'failed to fetch' / 'networkerror' / 'network request failed' 키워드, (3) HTTP status 500-599. 그 외(4xx, PostgreSQL 코드 23505/42501 등)는 즉시 반환.
- **Reasoning & Justification:** 재시도해도 결과가 바뀌지 않을 에러(인증·권한·중복)는 빠르게 사용자에게 노출하는 게 낫다. 네트워크/서버 측 일시 장애만 재시도. Mobile Safari가 fetch 단절을 `TypeError: Load failed`로 throw하는 것은 Sentry 이벤트로 직접 확인됨.
- **Potential Risk / Review Required:** 다른 브라우저/플랫폼의 네트워크 에러 메시지 패턴을 누락했을 가능성. Sentry에 retry 후 실패한 이벤트가 쌓이면 패턴 추가 검토.

#### [2026-05-27] 다단계 write의 부분 실패는 트랜잭션 없이 수용

- **Context & Ambiguity:** `careerDomain`(delete→insert), `alertDomain.recordCoaching`(alert insert + counseling insert), `quizDomain.duplicateQuizSetShuffled`(set insert + questions insert + 롤백 delete)는 다단계. 중간 단계 실패 시 일관성 보장이 어렵다.
- **Your Choice & Action:** 단계별 개별 `withWriteRetry` 래핑. `careerDomain`은 delete 실패 시 insert 차단(이전엔 delete 결과 미검사 → 중복 row 위험). `alertDomain`은 부분 실패 가능성을 주석으로만 명시. `quizDomain`의 롤백 delete는 best-effort.
- **Reasoning & Justification:** Supabase는 클라이언트 SDK에서 멀티-스테이트먼트 트랜잭션 미지원. RPC(stored procedure)로 옮기면 안전하나 이번 핫픽스 범위 초과. 사전 생성 PK가 23505로 즉시 throw되어 자연 멱등성이 일부 확보됨.
- **Potential Risk / Review Required:** alertDomain에서 alert만 저장된 채 counseling이 실패하면 위험 탐지에는 잡히는데 코칭 기록이 없는 불일치 상태. 빈도가 높으면 Supabase RPC로 트랜잭션화 검토.

#### [2026-05-27] reportError 호출을 헬퍼 한 곳으로 일원화

- **Context & Ambiguity:** 기존엔 각 도메인 훅이 `if (error) { reportError(...); throw error }` 패턴으로 직접 Sentry 보고. `withWriteRetry` 도입 시 도메인 훅의 `reportError`를 남길지 제거할지 모호.
- **Your Choice & Action:** 도메인 훅에서 `reportError` import와 호출을 모두 제거. `withWriteRetry`가 최종 실패 시(retry 소진 후) 한 번만 보고. 중간 성공(예: 2회차 성공)은 Sentry 보고 없음.
- **Reasoning & Justification:** 중복 보고 방지. retry로 자동 복구된 에러까지 Sentry로 보내면 베타 무료 한도 소진 가속. 진짜 실패만 보고하는 게 운영 신호 대 잡음비를 높임.
- **Potential Risk / Review Required:** retry 중간에 성공한 에러도 빈도 추적 가치가 있을 수 있음(예: "네트워크가 자주 깜빡인다"). 필요 시 `withWriteRetry`에 `reportTransient` 옵션 추가 검토.

#### [2026-05-27] duplicateQuizSetShuffled 롤백 delete도 withWriteRetry로 감쌈

- **Context & Ambiguity:** 롤백용 `delete`는 에러 처리 경로(questions insert 실패 후 cleanup)라 "write에 모두 적용" 규칙 대상인지 모호. 규칙은 정상 흐름 write를 가정하는 듯했음.
- **Your Choice & Action:** 롤백 delete도 `withWriteRetry`로 감쌌으나, 롤백 자체의 에러 결과는 throw하지 않고 그냥 넘김 — 원래 `qErr`를 throw하는 흐름 유지.
- **Reasoning & Justification:** 롤백 delete 실패 시 throw하면 원래 `qErr`가 소실됨. 롤백은 best-effort이고 실패해도 `withWriteRetry` 내부에서 Sentry 보고가 이루어지므로 추적은 가능.
- **Potential Risk / Review Required:** 롤백 delete가 최종 실패하면 orphan `quiz_sets` 레코드가 남는다. 현재는 DB cascade가 없다고 가정해 이 로직이 있는 것이므로, 추후 cascade 추가 시 이 롤백 코드는 제거 검토 필요.

#### [2026-05-27] studentDomain 보조 write 실패 시 throw 생략

- **Context & Ambiguity:** 기존 `createStudent`와 `updateStudent`에는 assignments 테이블에 대한 보조 write(insert/delete)가 있었고, 실패 시 `reportError`만 호출하고 `throw`는 하지 않는 fire-and-forget 패턴이었다. `withWriteRetry` 적용 규칙에 이 케이스에 대한 명시가 없었음.
- **Your Choice & Action:** 보조 write도 `withWriteRetry`로 감쌌으나, 원래 코드와 동일하게 에러 시 throw하지 않고 무시하는 방식 유지. `reportError` 제거 지침에 따라 standalone `reportError` 호출도 삭제.
- **Reasoning & Justification:** 보조 write 실패 시 throw로 바꾸면 기존 동작과 달리 학생 생성/수정 전체가 롤백되는 breaking change가 됨. `withWriteRetry`가 내부적으로 재시도+reportError를 처리하므로 에러 추적은 유지된다.
- **Potential Risk / Review Required:** assignments 보조 write 실패 시 UI는 성공처럼 보이지만 DB는 배정 누락 상태가 된다. 허용 가능한 수준인지, 아니면 트랜잭션 처리나 사용자 에러 표시가 필요한지 검토 필요.

#### [2026-05-21] 로그인 페이지 부제 완전 삭제

- **Context & Ambiguity:** 리브랜딩 요청은 "홈에 나매크만 뜨게"였음. `LoginPage.jsx`의 `<h1>산청 우정학사</h1>` 아래에 `<p>자기주도학습 관리 시스템</p>` 부제가 있었는데, 부제를 어떻게 처리할지 명시 없음. 대안: (A) 유지, (B) 다른 문구로 교체, (C) 완전 삭제.
- **Your Choice & Action:** 부제 라인을 완전히 삭제. h1만 "나매크"로 두는 미니멀 구성으로 변경.
- **Reasoning & Justification:** 사용자가 "나매크만 뜨게"라는 표현을 썼고, 부제는 추가 정보 노출이라 그 요청과 약간 어긋남. 또한 부제가 살아있으면 다음 작업에서 다시 손볼 가능성이 높음 — 일관성 관점에서 같이 처리.
- **Potential Risk / Review Required:** 사용자가 "자기주도학습 관리 시스템" 같은 카피라이트성 부제는 남기길 원했을 수 있음. 새 부제 카피("AI 학습 코치" 등)를 추후 받을 수 있으니 그때 다시 추가.

#### [2026-05-21] AdminHomeTab 부제에서 "학습 센터" 단순 삭제

- **Context & Ambiguity:** `AdminHomeTab.jsx`의 "학습 센터의 현재 상황을 한눈에 확인합니다"에서 "안동" 키워드 제거 방침에 따라 "학습 센터"라는 기관 지칭어를 어떻게 처리할지 모호. 대안: (A) "나매크의 현재 상황…", (B) "학습 센터" 그냥 삭제 → "현재 상황을…", (C) 다른 용어로 교체.
- **Your Choice & Action:** "학습 센터" 단어를 삭제하고 "현재 상황을 한눈에 확인합니다"로 단순화.
- **Reasoning & Justification:** "나매크의 현재 상황"은 어색하고("서비스의" 같은 느낌), 페이지 진입 시 이미 헤더에 "나매크"가 보이니 부제에서 또 언급할 필요 없음. 자연스러운 한국어 문장이 우선.
- **Potential Risk / Review Required:** 관리자 화면에서 "센터/기관" 같은 운영 단위를 명시하길 원할 수 있음. 다중 기관 운영 시 어떤 곳의 대시보드인지 표시가 필요해질 가능성.

#### [2026-05-21] "산청 우정학사" 키워드도 함께 제거

- **Context & Ambiguity:** 사용자 요청은 "안동 관련 키워드도 필요 없음". "산청 우정학사"는 베타테스트 기관명이라 "안동"과 별개 키워드인데, 같이 제거할지 모호. `InstallGuidePage.jsx` 푸터와 `LoginPage.jsx` 푸터·헤더, `Header.jsx` 기본값에 등장.
- **Your Choice & Action:** "산청 우정학사" 모두 "나매크"로 교체 또는 삭제.
- **Reasoning & Justification:** 사용자 요청의 정신("홈에서 나매크만 뜨게")이 기관·지역 키워드 전반 제거를 함의. "안동"만 빼고 "산청 우정학사"를 남기면 일관성 깨짐.
- **Potential Risk / Review Required:** 베타테스트는 여전히 산청 우정학사에서 진행 중. 학생·관리자가 "내 기관이 어디 사라졌나" 혼란 가능. 필요 시 푸터에 "베타: 산청 우정학사" 같은 별도 표기 검토.

#### [2026-05-21] `docs/`·mock 데이터·CLAUDE.md 전체 보존

- **Context & Ambiguity:** 사용자가 "전수적으로 문서·코드·배포 다 수정해야겠지만 이건 메모리에 남겨두고 일단 보여지는 것부터"라고 명시. "보여지는 것"의 범위 모호 — mock의 학생명("김안동")도 디버그/데모 화면에서 보임.
- **Your Choice & Action:** UI 노출 파일(메타·헤더·로그인·PDF 메타)만 교체. `docs/`·`CLAUDE.md`·mock 데이터·배포 도메인은 미수정 — `project_rebrand_namaek` 메모리에 미완 항목으로 기록.
- **Reasoning & Justification:** mock 처리는 별도 질문으로 사용자에게 확인 받음(→ UI만). docs는 양이 많고 클라이언트 기획 의도 문서라 일괄 치환 시 의도 왜곡 위험. CLAUDE.md는 "안동형 자기주도학습…"으로 시작하는 도메인 정의라 별도 합의 필요.
- **Potential Risk / Review Required:** `CLAUDE.md` 첫 줄 도메인 정의는 새 컨버세이션 시 컨텍스트로 항상 로드되니, 다음 작업에서 AI가 여전히 "안동형"으로 인식할 수 있음. 우선순위 높은 별도 작업으로 처리 권장.
