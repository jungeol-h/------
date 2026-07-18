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

## 구조

```
scripts/add-center-hours.sql     테이블 + SECURITY DEFINER RPC 2종 (정원·잠금 최종심)
scripts/seed-center-hours.sql    NAVI 4기 신청서(7.17) 초기 시드 — 헤더의 생성 규칙 필독
data/centerHours.js              ★ 요일별 1시간 단위 정의의 단일 진실원 (DB는 시각 저장만)
centerHoursApi.js                fetch + RPC 래퍼 + admin_config('center_hours') 설정
centerHoursSelection.js          선택 집합 → entries/등하원 요약 순수함수 (vitest)
centerHoursExcel.js              출석부 엑셀 시트 빌더(순수) + exceljs 렌더(동적 import)
CenterHourGrid.jsx               요일×단위 토글 그리드 (프레젠테이션 전용)
StudentCenterHoursView.jsx       학생 등록 화면 — pages/student/BookingTab의 세그먼트
CenterHoursSection.jsx           관리자·매니저 섹션 — pages/manager/AttendanceTab 내장(접힘)
```

## 규약

- **정원(40)·잠금 최종 검증은 RPC(`center_save_hours`) 안.** 클라 잔여 표시는 안내용.
  admin/manager 역할이면 정원·잠금을 건너뛴다(대리 수정). 저장은 학생 단위
  전면 교체 + 전역 advisory lock 직렬화.
- 설정은 `admin_config('center_hours')` = `{"isOpen", "capacity"}`. 잠그면 학생은 읽기 전용.
- **등·하원 시간표 반영은 자동이 아니다** — 관리자가 '일괄 반영' 버튼으로
  `center_sync_attendance_schedules` RPC를 명시 실행할 때만 attendance_schedules를
  덮어쓴다(키오스크 지각 판정에 즉시 영향, 첫 단위 시작=등원·마지막 끝=하원).
  비운영 요일(수·목) 행과 등록 없는 학생은 건드리지 않는다.

## 배포 순서

1. `scripts/add-center-hours.sql` 적용 → 2. 코드 배포 → 3. `scripts/seed-center-hours.sql`
   시드(리포트 쿼리로 미매칭 확인) → 4. 학생 공지 후 등록 열림 상태로 검수 기간 운영.
