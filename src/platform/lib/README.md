# lib/ — Supabase 클라이언트·인프라 계층

| 파일 | 역할 |
|---|---|
| `supabase.js` | Supabase 클라이언트 싱글턴. env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env`, 커밋 금지) |
| `supabaseHelpers.js` | **DB row(snake_case) → 앱 모델(camelCase) 변환기 전집.** 새 테이블 추가 시 여기에 `toXxx` 추가 |
| `supabaseRetry.js` | `withWriteRetry(fn, {label})` — 쓰기 실패 시 재시도 + Sentry 보고. 모든 도메인 쓰기가 통과 |
| `sentry.js` | Sentry 초기화·`reportError`·`setSentryUser`. 침묵 실패 방지의 최후 보루 |
| `counselingFiles.js` | 상담 PDF 첨부 업로드/삭제 — Storage `counseling-files` 버킷 (PDF만, 개당 10MB, 최대 3개) |
| `financeFiles.js` | 재정 영수증 첨부 — Storage `finance-receipts` 버킷 (이미지+PDF) |
| `passwords.js` | 비밀번호 해시/검증 단일 구현처 — bcryptjs dynamic import. 초기 비번(=연락처)은 `INITIAL_COST`, 사용자 지정은 `USER_COST` |

## ⚠️ 보안 부채 (미해결 — 전부 알려진 상태로 베타 운영 중)

클라이언트(폐쇄형 B2B 시골 학사, 50~60명)와 협의된 리스크 수용 상태다.
정식 서비스 전 반드시 해결해야 하며, **새 기능이 이 부채를 더 키우지 않게 할 것.**

1. ~~**평문 비밀번호**~~ **→ 부분 해결 (2026-07, add-password-security)**: 비밀번호는
   클라이언트 사이드 bcrypt 해시로 저장·비교하고(`lib/passwords.js`, `AuthContext.login`),
   연락처는 `phone`/`parent_phone` 컬럼으로 분리했다. 세션(localStorage)에도 비밀번호를
   싣지 않는다. **잔존 한계**: anon key로 해시를 읽어 로그인 로직을 우회할 수 있고
   (pass-the-hash), 해시 자체를 덮어쓸 수도 있다 — 부채 #2(RLS)가 해결돼야 완결된다.
   미전환 계정의 평문 fallback 비교(`verifyOrPlaintext`)는 전 계정 해시 전환 확인 후
   제거할 것 (`scripts/add-password-security.sql` 하단 확인 쿼리 참고).
2. **RLS 무력화**: 모든 테이블이 `anon_all` 정책(`using (true)`)이라 anon key만 있으면
   누구나 전체 read/write 가능. 권한 제어는 전부 앱 코드 레벨. → Supabase Auth 도입 +
   역할 기반 정책 필요.
3. **확인평가 정답 노출**: 학생 클라이언트도 `quiz_questions`의 정답(acceptedAnswers)을
   fetch한다. 개발자도구로 정답 열람 가능.
4. **Storage public 버킷**: `counseling-files`(상담 PDF)·`finance-receipts`(영수증)가
   public — URL을 알면 누구나 열람. (anon_all 체계에서 private+서명URL의 이득이 없어
   의도적으로 public 선택했음. RLS 해결 시 함께 전환할 것.)
5. **세션 신뢰**: 로그인 사용자 객체를 localStorage(`platform_user`)에 저장하고 그대로
   신뢰한다. role 변조 가능. → Supabase Auth 세션으로 대체 필요.
   (비밀번호는 더 이상 세션에 저장되지 않음 — `toUser`가 제외한다.)

## 규약

- 모든 **쓰기**는 `withWriteRetry`로 감싸고 `if (error) throw error` — 호출부 try/catch
  또는 전역 Toast(`ToastProvider`)가 사용자에게 표면화한다.
- 모든 **에러**는 침묵하지 않는다: `reportError`(Sentry) 또는 `_fetchErrors` 배너.
- 변환기(`toXxx`)는 누락 컬럼에 `?? 기본값`을 줘서 마이그레이션 미적용 상태에서도
  크래시하지 않게 한다.
