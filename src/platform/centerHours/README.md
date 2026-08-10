# centerHours/ — 센터 이용시간 등록 · 시간대별 출석부 (격리 모듈)

학생이 요일×1시간 단위로 센터 이용시간을 등록하고(단위당 정원 40명 선착순),
관리자·매니저가 시간대별 명단 조회·출석부 엑셀 추출·등·하원 시간표 일괄 반영을 한다.
구글폼의 겹치는 시간블록(M1~SU5, `data/attendanceBlocks.js`) 신청을 대체한다
(2026-07 클라이언트 요청 — 매번 GPT로 블록→시간대 변환하던 수작업 제거).

## 격리 원칙 (booking/ 선례 승계)

- **DataContext·fetchers·supabaseHelpers를 수정하지 않는다.** 화면 마운트 시
  `centerHoursApi.js`가 직접 fetch, 쓰기 후 refetch.
- 기존 컬렉션(students)은 `useData()`에서 **읽기만** 한다 (AttendanceTab이 props로 전달).
- 마이그레이션 미적용 시 자체 안내 카드만 띄운다 (`isMigrationMissing`).
- 학생 홈 '오늘의 센터 일정' 카드(`pages/student/useTodayCenterSchedule.js`)가
  `fetchStudentCenterHours`(본인분만)를 읽기 전용으로 호출한다 — 실패 시 홈은
  해당 파트만 안내문으로 대체하고 깨지지 않는다.

## 구조

```
scripts/add-center-hours.sql     테이블 + SECURITY DEFINER RPC 2종 (정원·잠금 최종심)
scripts/seed-center-hours.sql    NAVI 4기 신청서(7.17) 초기 시드 — 헤더의 생성 규칙 필독
data/centerHours.js              ★ 요일별 1시간 단위 정의의 단일 진실원 (DB는 시각 저장만)
centerHoursApi.js                fetch + RPC 래퍼 + admin_config('center_hours') 설정
centerHoursSelection.js          선택 집합 → entries/등하원 요약 순수함수 (vitest)
centerHoursExcel.js              출석부 엑셀 시트 빌더(순수) + exceljs 렌더(동적 import)
useCenterHours.js                lazy fetch 훅 — AttendanceTab이 한 번 불러 하위에 props로 전달
CenterHourGrid.jsx               요일×단위 토글 그리드 (프레젠테이션 전용)
StudentCenterHoursView.jsx       학생 등록 화면 — pages/student/BookingTab의 세그먼트 (자체 fetch)
TodayTimeline.jsx                날짜별 시간대 현황 — 등록×출결 결합 (AttendanceTab 우측, 지난 날짜 지원)
CenterHoursSection.jsx           관리자·매니저 명단·설정 섹션 — AttendanceTab 내장 (데이터는 props)
```

## 규약

- **정원(40)·잠금 최종 검증은 RPC(`center_save_hours`) 안.** 클라 잔여 표시는 안내용.
  admin/manager 역할이면 정원·잠금을 건너뛴다(대리 수정). 저장은 학생 단위
  전면 교체 + 전역 advisory lock 직렬화.
- **'학생 이용시간 수정' 대상은 재원생만이 아니다** (2026-08 클라이언트) — 신청취소·퇴원
  학생도 이름 검색으로 골라 고칠 수 있다. 시간대별 명단·등록 인원 집계는 종전대로
  `isActiveStudent`로 거른다(퇴원생이 출석부에 뜨면 안 되므로). 후보 목록은
  AttendanceTab의 `centerHoursEditable`, 검색 UI는 공용 `StudentCombobox`이며
  비재원 학생에는 상태 배지가 붙는다. RPC `center_save_hours`는 `role='student'`만
  보고 status는 안 보므로 SQL 변경 불필요. 미등원 알림 cron은 `u.status='active'`로
  걸러 퇴원생 이용시간을 넣어도 긴급 알림이 새로 생기지 않는다.
- 설정은 `admin_config('center_hours')` = `{"isOpen", "capacity", "operatingDays"}`.
  잠그면 학생은 읽기 전용. **운영 요일(operatingDays, JS getDay int 배열)은 이
  설정이 단일 진실원이다** (2026-07-27 "이번 주는 수·목도 오픈" 요청으로 설정화 —
  `scripts/add-center-operating-days.sql`). 관리자 출결 탭의 운영 요일 토글이 수정하며,
  단위 시각표(`data/centerHours.js`)는 7일 전부 정의돼 있고 어떤 요일을 노출할지만
  설정이 정한다. 코드의 `DEFAULT_OPERATING_DAYS`와 RPC의 fallback은 월·화·금·토·일.
- **등·하원 시간표(attendance_schedules)는 이용시간의 파생물이다** — 별도 편집
  UI가 없고, `center_save_hours`가 저장 시 그 학생의 "운영 요일 ∪ 등록 요일" 행을
  자동 교체한다 (첫 단위 시작=등원·마지막 끝=하원, 키오스크 지각·결석 판정 기준.
  v3, 2026-07-27). 그 밖의 요일 행과 등록 없는 학생은 건드리지 않는다.
  `center_sync_attendance_schedules`(일괄 보정)는 시드 SQL을 RPC 없이 직접 넣은
  직후 등 보정용으로만 남아 있다.

## 배포 순서

1. `scripts/add-center-hours.sql` 적용 → 2. 코드 배포 → 3. `scripts/seed-center-hours.sql`
   시드(리포트 쿼리로 미매칭 확인) → 4. 학생 공지 후 등록 열림 상태로 검수 기간 운영.
