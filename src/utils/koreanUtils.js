export function hasBatchim(text) {
  if (!text) return false;
  
  // 끝에 있는 공백, 마침표, 물음표, 괄호 등 제거하고 실제 마지막 글자 확인
  const trimmed = text.replace(/[^a-zA-Z0-9가-힣]+$/, '');
  if (!trimmed) return false;
  
  const lastChar = trimmed.charCodeAt(trimmed.length - 1);
  
  // 한글 유니코드 범위: 0xAC00 ~ 0xD7A3
  if (lastChar >= 0xac00 && lastChar <= 0xd7a3) {
    return (lastChar - 0xac00) % 28 !== 0;
  }
  
  // 숫자 처리 (1, 3, 6, 7, 8, 0은 받침이 있음)
  const lastCharStr = trimmed[trimmed.length - 1];
  if (/[013678]/.test(lastCharStr)) return true;
  if (/[2459]/.test(lastCharStr)) return false;
  
  // 영어 처리 (간단하게 l, m, n, r, t 그 외 다수... 복잡하지만 일단 기본은 false)
  // 여기서는 영어는 일단 받침이 없는 것으로 간주하거나 자주 쓰이는 것만 처리
  if (/[a-zA-Z]/.test(lastCharStr)) {
    // b, c, d, g, k, l, m, n, p, t 등은 받침 소리가 남
    return /[bcdefghijklmnoprstuvwxz]/i.test(lastCharStr);
  }

  return false;
}

/**
 * '을' 또는 '를'을 붙여줍니다.
 */
export function withEulReul(text) {
  if (!text) return '';
  return text + (hasBatchim(text) ? '을' : '를');
}

/**
 * '이' 또는 '가'를 붙여줍니다.
 */
export function withIGa(text) {
  if (!text) return '';
  return text + (hasBatchim(text) ? '이' : '가');
}

/**
 * '은' 또는 '는'을 붙여줍니다.
 */
export function withEunNeun(text) {
  if (!text) return '';
  return text + (hasBatchim(text) ? '은' : '는');
}

/**
 * '과' 또는 '와'를 붙여줍니다.
 */
export function withGwaWa(text) {
  if (!text) return '';
  return text + (hasBatchim(text) ? '과' : '와');
}

/**
 * '으로' 또는 '로'를 붙여줍니다. (단, 'ㄹ' 받침인 경우 '로'를 사용함)
 */
export function withRo(text) {
  if (!text) return '';
  const lastChar = text.charCodeAt(text.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return text + '로';
  const batchim = (lastChar - 0xac00) % 28;
  // 받침이 없거나 'ㄹ' 받침(8)인 경우 '로'
  return text + (batchim === 0 || batchim === 8 ? '로' : '으로');
}

/**
 * 목록을 '과/와'로 연결합니다.
 */
export function joinWithGwaWa(list) {
  if (!list || list.length === 0) return '';
  if (list.length === 1) return list[0];
  
  let result = list[0];
  for (let i = 1; i < list.length; i++) {
    result = withGwaWa(result) + ' ' + list[i];
  }
  return result;
}
