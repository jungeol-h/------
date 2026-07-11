# pages/ — 역할별 화면

라우팅은 `src/App.jsx`: `/` 로그인 → `ProtectedRoute`로 역할별 대시보드.
각 대시보드가 자기 탭(TabBar)을 정의하고 하위 라우팅한다.

| 경로 | 역할 | 대시보드 | 탭 구성 |
|---|---|---|---|
| `/student/*` | student | `student/StudentDashboard` | 홈·학습·과제·마인드·진단(학습진단/진로설계/확인평가) |
| `/manager/*` | manager | `manager/ManagerDashboard` | 홈·출결·학생·업무기록·확인평가 (+ `/manager/kiosk` 등하원 키오스크) |
| `/admin/*` | admin | `admin/AdminDashboard` | 홈·학생·업무기록·확인평가·외부상담 |
| `/instructor/*` `/consultant/*` | instructor·consultant | `educator/EducatorDashboard` 공용 | 학생·업무기록·과제 + 강사만 확인평가, 컨설턴트만 외부상담 |
| `/viewer/*` | viewer(공무원·열람) | `viewer/ViewerDashboard` | 통계·학생·업무기록 (열람 전용 + 출력 버튼) |
| `/parent/*` | parent | `parent/ParentDashboard` | 홈·학습·코멘트 (자녀 읽기 전용) |

`shared/`는 여러 역할이 같이 쓰는 화면: `StudentDetailPage`(학생 상세 — 역할별 진입),
`WorkRecordsTab`(업무기록 통합 탭 5메뉴: 업무계획·관리보고·재정·상담보고·수업보고,
`?menu=` 딥링크, 역할별 편집/잠금/열람 분기).

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
