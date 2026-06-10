// 타이머 버그(모바일 화면 꺼짐 시 정지) 사후 조치용 임시 상수/문구.
// 누락된 학습시간을 학생이 직접 보정할 수 있도록 과거 계획 편집을 임시 허용한다.
// 철수 시: TEMP_ALLOW_PAST_ACTUAL_EDIT = false 로 바꾸거나 이 파일과 참조 코드를 제거.

export const TEMP_ALLOW_PAST_ACTUAL_EDIT = true

// 실제 학습시간 직접입력 프리셋(분 단위).
export const ACTUAL_TIME_STEPS = [
  { label: '-10', value: -10 },
  { label: '+10', value: 10 },
  { label: '+30', value: 30 },
  { label: '+1시간', value: 60 },
]

export const TIMER_FIX_NOTICE = {
  title: '타이머 오류 안내와 사과의 말씀',
  body: [
    '모바일에서 화면이 꺼지면 학습 타이머가 멈추는 오류가 있었습니다.',
    '그동안 공부 시간이 제대로 기록되지 못해 불편을 드려 정말 죄송합니다. 오류는 수정되었습니다.',
    '당분간 "계획하기" 탭에서 지난 날짜의 계획을 열면 실제 공부한 시간을 직접 입력해 보정할 수 있습니다.',
  ],
}

// 학생별로 분리(공유 기기 대응).
export const noticeStorageKey = (userId) => `namac_notice_timerfix_${userId ?? 'anon'}`
