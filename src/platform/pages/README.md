# pages/ — 역할별 화면

라우팅은 `src/App.jsx`: `/` 로그인 → `ProtectedRoute`로 역할별 대시보드.
각 대시보드가 자기 탭(TabBar)을 정의하고 하위 라우팅한다.

| 경로 | 역할 | 대시보드 | 탭 구성 |
|---|---|---|---|
| `/student/*` | student | `student/StudentDashboard` | 홈·학습·과제·예약(상담 예약/센터 이용시간 세그먼트)·마인드·진단(학습진단/진로설계/확인평가) |
| `/manager/*` | manager | `manager/ManagerDashboard` | 홈·출결·학생·업무기록·예약·확인평가 (+ `/manager/kiosk` 등하원 키오스크, 출결 탭에 센터 이용시간·시간대별 명단 섹션 — `centerHours/`) |
| `/admin/*` | admin | `admin/AdminDashboard` | 홈·출결·학생·예약·업무기록·확인평가·외부상담 (+ `/admin/kiosk` — 출결 탭·키오스크는 `manager/`의 화면 재사용, 전체 학생 대상) |
| `/instructor/*` `/consultant/*` | instructor·consultant | `educator/EducatorDashboard` 공용 | 학생·업무기록·예약관리·과제 + 강사만 확인평가, 컨설턴트만 외부상담 |
| `/viewer/*` | viewer(공무원·열람) | `viewer/ViewerDashboard` | 통계·학생·업무기록 (열람 전용 + 출력 버튼) |
| `/parent/*` | parent | `parent/ParentDashboard` | 홈·학습·예약·코멘트 (예약만 쓰기 가능, 나머지 자녀 읽기 전용) |

`shared/`는 여러 역할이 같이 쓰는 화면: `StudentDetailPage`(학생 상세 — 역할별 진입),
`WorkRecordsTab`(업무기록 통합 탭 6메뉴: 업무계획·관리보고·재정·상담보고·수업보고·공지알림,
`?menu=` 딥링크, 역할별 편집/잠금/열람 분기). 공지·알림(2026-07-31 클라이언트 요청)은
`notices` 테이블 — 공지(announcement)는 전 역할 홈 로그인 팝업(`NoticePopup`, PageLayout
마운트, 읽음 기록은 서버 notice_reads 정본 + localStorage 보조 — 다기기 1회 노출),
알림(notification)은 학생·학부모 홈 알림 칸(`NoticeFeedCard`, 대상 전체/학생/학부모)
누적 표시.

## 관리자 ↔ 강사 화면 전환 ("보기 모드", 2026-09-30)

`data/roleViews.js`의 `EDUCATOR_VIEWS`에 등록된 계정(`a-hwang` 황광희, 검증용 `test-admin`)은
Header 좌측 역할 배지를 눌러 관리자 ↔ 강사 화면을 오갈 수 있다 (계정 이중화·DB 변경 없음).
`useAuth().currentUser.role`은 **화면이 보는 유효 role**이라 보기 모드에서는 `instructor`가 되고,
DB role(`admin`)은 `currentUser.accountRole`에 남는다 (저장된 세션 `localStorage.platform_user`는
원본 그대로). 모드는 탭 단위 `sessionStorage.platform_view_mode`(`'educator'`일 때만 저장,
로그아웃·로그인 시 초기화). 강사 모드에서는 외부상담 탭이 `educatorExtraTabs`로 추가되고
(`EducatorDashboard` `showExternal`), 월간 컨설팅 보고서는 복수 담당업무(`hasMultipleDuties`)
본인이면 `educators=[본인]` 경로로 넘겨 국어/진로진학 분리 셀렉트를 유지한다.
전환 가능 계정을 늘리려면 `EDUCATOR_VIEWS`에 id를 추가.

## 새 역할 추가 체크리스트 (과거 실수 기반 — 하나라도 빼먹으면 로그인 후 무한 튕김)

1. `LoginPage.jsx`의 `ROLE_PATHS`에 경로 추가 (**누락 시 로그인 직후 무한 리다이렉트**)
2. `App.jsx` 라우트 + `ProtectedRoute role=`
3. `components/layout/Header.jsx`의 `ROLE_LABELS`/`ROLE_COLORS`
4. `context/DataContext.jsx`의 fetchAll 역할 분기 (+ 필요시 전용 fetcher)
5. `admin/UserManagementTab.jsx` 계정 관리 노출, `pdf/config/meta.js` ROLE_LABEL
6. DB: users.role 값 추가 시 시드/마이그레이션 (`scripts/README.md`)

## 알아둘 것

- **[임시] 타이머 버그 보정 코드**: `student/tempBetaNotice.js` + StudentDashboard·LearningTab의
  `[임시]` 주석 블록. 타이머 상태 저장/복구 안정화가 확인되면 함께 철거할 것.
- `student/LearningTab.jsx`(1,400줄+)는 이 앱의 최대 파일 — 타이머·계획·기록이 얽혀 있어
  분리는 보류된 상태 (UX 계획 문서 Tier 3). 손댈 때는 `learningTabLogic.js`(순수 로직,
  테스트 있음)부터 파악할 것.
- 모달은 `components/common/ModalShell.jsx`(하단 시트형)을 쓸 것. z-index: Header/TabBar
  `z-40`, 모달 `z-50`.
- `educator/external/`은 별도 설계 — 그 폴더의 README 참고.
- '예약' 탭들(학생·학부모·강사·매니저·관리자)은 전부 `src/platform/booking/` 격리 모듈의
  얇은 래퍼다 — 데이터 계층·검증 규약은 `booking/README.md` 참고. **배포 전
  `scripts/add-booking-system.sql` 선적용 필수.**
