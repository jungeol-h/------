// RPC·규칙 엔진 실패 코드 → 사용자 안내문 (명세 22장) — 단일 진실원.
// 서버(RPC)와 클라 사전검증(bookingRules.js)이 같은 코드 체계를 쓰므로
// 어느 쪽에서 거절돼도 동일한 안내문이 뜬다.

// ctx: { program, subjectName } — 프로그램 설정에 따라 문구를 조립한다 (하드코딩 금지)
export function bookingMessage(code, ctx = {}) {
  const { program, subjectName } = ctx
  switch (code) {
    case 'OK':
      return ''
    case 'OVERLAP':
      return '같은 시간에 다른 컨설팅 또는 코칭이 예약되어 있습니다. 기존 예약시간을 확인해 주세요.'
    case 'DAILY_LIMIT': {
      const limit = program?.dailyLimit ?? 2
      if (program?.dailyLimitScope === 'program_subject') {
        return `${subjectName ? subjectName + ' ' : '해당 교과 '}컨설팅은 하루 최대 ${limit}개 블록까지 예약할 수 있습니다.`
      }
      if (program?.dailyLimitScope === 'program_educator') {
        return `같은 날 동일한 선생님에게 ${limit}회를 초과해 예약할 수 없습니다. 다른 선생님 또는 다른 날짜를 선택해 주세요.`
      }
      return `${program?.name ?? '이 프로그램'}은 하루 최대 ${limit}회까지 예약할 수 있습니다.`
    }
    case 'CONSECUTIVE_FORBIDDEN':
      return `${program?.name ?? '이 프로그램'}은 연속된 시간으로 예약할 수 없습니다. 한 개 이상의 시간 블록을 띄워 선택해 주세요.`
    case 'DEADLINE_PASSED':
      if (program?.changeDeadlineType === 'days_before') {
        return `${program?.name ?? '이 상담'}은 상담일 전날과 당일에 온라인으로 변경하거나 취소할 수 없습니다. 관리자에게 문의해 주세요.`
      }
      return `상담 시작 ${program?.changeDeadlineValue ?? 60}분 전부터는 온라인 변경 또는 취소가 불가능합니다. 변경이 필요한 경우 관리자에게 문의해 주세요.`
    case 'SLOT_FULL':
      return '다른 사용자가 먼저 예약하여 해당 시간이 마감되었습니다. 다른 시간을 선택해 주세요.'
    case 'PAST_SLOT':
      return '이미 지났거나 시작된 시간은 예약할 수 없습니다.'
    case 'ALREADY_BOOKED':
      return '이미 이 시간에 예약되어 있습니다.'
    case 'OUT_OF_OPEN_PERIOD':
      return '지금은 예약 접수기간이 아닙니다. 예약 오픈 일정을 확인해 주세요.'
    case 'WINDOW_CLOSED':
      return '지금은 당일 예약 접수시간이 아닙니다. 접수시간을 확인해 주세요.'
    case 'NOT_TARGET_GROUP':
      return '이 프로그램의 예약 대상이 아닙니다. 관리자에게 문의해 주세요.'
    case 'SLOT_NOT_OPEN':
      return '지금은 예약할 수 없는 시간입니다. 목록을 새로고침해 주세요.'
    case 'GROUP_NOT_ALLOWED':
      return '이 프로그램은 그룹상담을 지원하지 않습니다.'
    case 'REASON_REQUIRED':
      return '처리 사유를 입력해 주세요.'
    case 'ALREADY_CANCELLED':
      return '이미 취소되었거나 변경된 예약입니다. 최신 예약정보를 다시 확인해 주세요.'
    case 'HAS_RESERVATIONS':
      return '예약된 학생이 있는 시간은 삭제할 수 없습니다. 운영취소로 전환해 주세요.'
    case 'CAPACITY_BELOW_BOOKED':
      return '현재 예약된 인원보다 정원을 작게 설정할 수 없습니다.'
    case 'FORBIDDEN':
      return '이 작업을 수행할 권한이 없습니다.'
    case 'NOT_FOUND':
      return '대상을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.'
    case 'INVALID':
      return '잘못된 요청입니다. 입력값을 확인해 주세요.'
    case 'STALE':
      return '다른 사용자가 해당 예약을 먼저 변경했습니다. 최신 예약정보를 다시 확인해 주세요.'
    default:
      return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  }
}

// 예약 확정 직전, 확정 후 온라인 변경·취소가 불가능해지는 예약에 띄우는 경고 (명세 8.2)
export function immediateLockWarning(program) {
  if (program?.changeDeadlineType === 'days_before') {
    return `이 예약은 확정 후 상담일 ${program.changeDeadlineValue}일 전까지만 온라인 변경·취소가 가능합니다.`
  }
  return `이 예약은 시작 ${program?.changeDeadlineValue ?? 60}분 이내의 예약이므로 확정 후 온라인 변경과 취소가 불가능합니다.`
}
