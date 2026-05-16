// [Event] 얇은 동기 인메모리 이벤트 버스.
//
// 도메인 CRUD가 "다른 도메인의 새 사건을 유발"할 때만 사용한다 (예: mind 입력
// → alert 생성). emit은 동기적으로 모든 핸들러를 호출한다 — 프로토타입 규모에서
// 비동기 큐는 불필요하고, 동기 실행이 디버깅·테스트를 단순하게 한다.

const handlers = new Map() // eventName → Set<handler>

export function subscribe(eventName, handler) {
  if (!handlers.has(eventName)) handlers.set(eventName, new Set())
  handlers.get(eventName).add(handler)
  return () => handlers.get(eventName)?.delete(handler)
}

export function emit(eventName, payload) {
  const set = handlers.get(eventName)
  if (!set) return
  for (const handler of set) {
    try {
      handler(payload)
    } catch (err) {
      console.error(`event handler error [${eventName}]:`, err)
    }
  }
}

// 테스트용 — 모든 구독 해제.
export function clearAllHandlers() {
  handlers.clear()
}
