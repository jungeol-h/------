# external/ — 외생(외부 학생) 상담 프로그램 모듈

10~11월 외부 학생(타교, ~130명)을 학교별 그룹으로 1회성 상담하는 기능.
admin의 '외부상담' 탭과 consultant 탭에서 사용한다.

## 설계 원칙: DataContext에서 의도적으로 격리

이 모듈의 데이터(counseling_programs / program_students / program_counseling_records)는
전역 DataContext에 넣지 않는다. `externalData.js`가 모듈 진입 시 supabase에서 직접
lazy fetch하고 로컬 state로만 관리한다. **재원생 데이터·상담탭·통계와 완전히 분리되어
회귀 위험이 0인 것이 목적** — 이 격리를 깨지 말 것.

이 때문에 재원생 상담 컴포넌트와 일부 코드가 **의도적으로 중복**이다
(ExternalCounselingForm ↔ CounselingFormModal 등). 상담 내용 6단계 필드·카드 본문은
이미 공용(`components/counseling/CounselingContentFields.jsx`, `CounselingRecordBody.jsx`,
PDF `CounselingReport`)이므로, 상담 양식이 바뀌면 **공용 컴포넌트와 양쪽 폼을 함께** 수정할 것.

## 파일

| 파일 | 역할 |
|---|---|
| `externalData.js` | 데이터 계층 (lazy fetch + CRUD, 로컬 snake↔camel 변환) |
| `ExternalCounselingTab.jsx` | 진입 탭 — 프로그램 목록/선택 |
| `ExternalStudentList.jsx` | 프로그램 내 학생 목록 |
| `ExternalStudentDetail.jsx` | 학생별 상담 기록 카드 + PDF |
| `ExternalCounselingForm.jsx` | 상담 작성 폼 |
| `ExternalAdminModals.jsx` | 프로그램 생성·학생 일괄 등록(붙여넣기) 모달 |

시드: `scripts/seed-external-program.sql` (외부학생 명단 수령 후 실행 — 아직 보류).
