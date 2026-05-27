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
