# booking/ — 컨설팅·코칭 통합 예약 시스템 (격리 모듈)

학생·학부모 예약, 강사 타임테이블·출결·상담기록, 관리자 운영설정·예외처리·감사이력.
클라이언트 명세서("NAVI 컨설팅·코칭 예약 시스템 작업명세서") 기반, **전 그룹 적용**.

## 격리 원칙 (external/ 선례 — 깨지 말 것)

- **DataContext·fetchers·supabaseHelpers·dataModel을 수정하지 않는다.**
  예약 데이터는 타인이 계속 갱신하므로 "로그인 1회 fetch" 모델과 맞지 않는다 —
  `BookingContext.jsx`가 예약 라우트 진입 시 lazy fetch하고, 쓰기 후 전체 refetch한다.
- snake↔camel 변환은 `bookingApi.js`의 로컬 `toBookingXxx` (누락 컬럼 `?? 기본값` 내성).
- 마이그레이션 미적용 시 `BookingGate`가 자체 오류 화면을 띄운다 — `_fetchErrors` 배너와 무관.
- 기존 컬렉션(users·students·parentChildren)은 `useData()`에서 **읽기만** 한다.
- 학생 홈 '오늘의 센터 일정' 카드(`pages/student/useTodayCenterSchedule.js`)는
  BookingProvider 밖에서 `bookingApi`의 읽기 함수만 직접 호출한다 (오늘 예약 +
  경량 이름 맵 `fetchBookingNameMaps`). 쓰기·RPC는 여전히 예약 라우트 전용.

## 데이터·검증 아키텍처

```
scripts/add-booking-system.sql   테이블 10종 + SECURITY DEFINER RPC 9종 + pg_cron (최종심)
bookingApi.js                    조회 + RPC 래퍼 + 클라 직접 쓰기(설정·기록) + 감사 로그
BookingContext.jsx               역할별 스코프 lazy fetch + Realtime 알림 구독 + 쓰기 액션
bookingRules.js                  ★ RPC 검증의 순수함수 미러 (UX 사전검증) + vitest 전수 테스트
slotGeneration.js                타임테이블 자동 생성 순수함수 (불완전 슬롯 미생성)
bookingMessages.js               실패 코드 → 명세 22장 안내문 (단일 진실원)
bookingStatus.js                 상태 상수·라벨 + 파생 판정 (정원 마감·기록 기한 등 저장 안 함)
views/ components/               역할별 화면 (Student/Educator/Admin)
```

**핵심 규약: 정원·시간겹침·횟수제한·연속금지·기한의 최종 검증은 전부 DB RPC 안이다.**
클라 검증(bookingRules)은 버튼 비활성·사전 안내용이고, RPC와 같은 실패 코드를 반환하므로
어느 쪽에서 거절돼도 동일한 안내문이 뜬다. 좌석 카운터 컬럼은 없다 — 마감은 confirmed
count 파생 (취소 시 정원 복원 자동 성립). 동시성 방어: 학생 advisory lock → 슬롯
FOR UPDATE(id 정렬 순) → 부분 UNIQUE 인덱스.

## 타임블럭 템플릿 · 강사 셀프 개설 (2026-07-27 클라이언트 요청)

- "일정마다 타임테이블 설정을 매번 다시 한다" 해소 — 요일·운영시간·휴식 프리셋을
  **타임블럭 템플릿**(A 평일형 16~22시 / B 주말형 12:30~19시 기본, 관리자가 추가·삭제)으로
  `admin_config('booking_timetable_templates')` 한 행에 저장하고 TimetableWizard가
  불러온다. 슬롯 단위(40분/20분)는 여전히 프로그램(slotMinutes) 소관.
- **강사 셀프 개설**: 강사 '내 슬롯'의 "내 타임테이블 일괄 생성"이 같은 위저드를
  `lockEducatorId`(본인 고정, 배정 프로그램만)로 연다. `createSlotBatch`가 status
  파라미터('draft'|'open')를 받아 즉시 공개 생성을 지원한다 — 강사의 단일 슬롯
  open 생성(NewSlotModal)과 같은 권한 모델이라 RPC 확장 없이 성립. 템플릿
  저장·삭제는 관리자 전용(UI 게이트), 강사는 불러오기만.

## 해석 결정 (클라이언트 확인 필요 시 여기부터)

- **당일 접수창**(운영 시작 1시간 전~종료 1시간 전, 명세 6.1)은 **당일 슬롯에만** 적용.
  미래 일자의 공개 슬롯은 수시 접수. 해석 변경 시: SQL `_booking_validate`의
  `ELSIF p_slot.date = kst_date` 분기 + `bookingRules.js` `validateReserve`의 같은 분기.
- 그룹 슬롯 판별은 "allow_group 프로그램 + capacity > 1". 강사 지정 그룹은 비공개(is_public=false) 기본.
- 상담기록 양식은 기존 상담보고 6단계 재사용(테이블은 `booking_records`로 분리 —
  counseling_records는 통계·학생 홈에 결합돼 있어 재사용 시 회귀 위험). 프로그램별
  커스텀 양식은 후순위 백로그.

## 배포 순서 (필수)

1. `scripts/add-booking-system.sql`을 Supabase Studio에서 실행 (멱등)
2. 코드 배포 — 순서가 바뀌면 예약 탭이 "예약 시스템 준비 중" 오류 화면 (다른 탭 무영향)

## 명세 대비 의도적 보류 (2026-07-18 재감사 확정 — 필요 시 클라이언트와 협의)

- §20.1 "기간 최대 예약 수" — 기간(주/월?) 정의가 명세에 없어 클라이언트 확인 후 구현.
- §14.4 프로그램별 커스텀 기록 양식 — 기존 6단계 공용 양식으로 합의(후순위).
- §3.3 관리자가 강사별 추가 편집권한 부여 — 권한 모델 확장 필요.
- §10.2 강사 슬롯 편집의 "전체 운영시간" 제약 — 운영시간이 별도 엔티티가 아니라
  배치 파라미터로만 존재. 센터 운영시간 설정 화면 신설 시 함께.
- §5.2 슬롯별 사용자 변경/취소 가능 플래그 — 프로그램 단위 기한으로 대체 중.
- §15.3 학교·학년 필터 — 학생 이름 검색으로 대체.
- §7.4 장소·진행방식 필드 — 슬롯 비고(note)로 대체.
- §17 문자·카카오 알림톡 — 프로젝트 공통 백로그(대행사 계정 대기)와 함께.

## 후속 정리 백로그 (코드리뷰에서 확인, 동작 무관)

- 요일 배열(WEEKDAY)·'M/D HH:MM' 포맷터·시간 덧셈이 모듈 내 3~5곳 중복 —
  `attendance.js`의 `dayLabel` 재사용 + 공용 포맷터로 추출.
- 프로그램 camel↔snake 매핑이 `toBookingProgram`/`createProgram`/`PROGRAM_FIELD_MAP`
  세 곳에 나열 — 단일 필드 매핑으로 통합. 폼 모달 5개의 busy/error/submit 골격도 훅 추출 후보.
- ProxyReserveModal의 학생 검색을 `StudentCombobox` 재사용으로 교체.
- SQL reserve/change의 override 가드·공개상태 검증 블록을 `_booking_*` 헬퍼로 추출.

## 수동 검수 체크리스트 (명세 23장 중 vitest 미커버분)

규칙 검증은 `bookingRules.test.js`가 전수 커버. 아래는 E2E·동시성·알림 수동 확인:

- [ ] 두 브라우저에서 마지막 한 자리 동시 예약 → 한 명만 확정, 다른 쪽 SLOT_FULL 안내
- [ ] 학생 예약 → 학부모 계정에서 같은 학생 겹치는 시간 예약 차단
- [ ] 예약 변경 실패(새 슬롯 마감) 시 기존 예약 유지
- [ ] 취소 즉시 잔여 정원 복원 표시
- [ ] 예약 있는 슬롯 강사 편집 → 사유 필수 + 학생·학부모 알림 발생
- [ ] 그룹 배정에서 제한 걸린 학생만 실패 사유 표시 (부분 성공)
- [ ] 출결 미처리로 하루 방치 → cron 후 강사·관리자 알림 (`SELECT booking_daily_digest()` 수동 실행으로 확인 가능)
- [ ] 관리자 override 예약 → 이력 메뉴에서 '예외' 필터로 조회 + 사유 표시
- [ ] 마이그레이션 미적용 DB에서 예약 탭이 오류 화면만 띄우고 기존 탭 정상
