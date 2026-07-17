-- 더미 매니저 계정 삭제 (m01~m04, 베타 시드 잔재) — 2026-07-17 REST로 적용 완료
--
-- 배경: supabase_beta_seed.sql이 만든 manager01~04(김학습·이관리·박코칭·최선생)는
-- 더미인데, m01은 실사용 흔적이 있었다:
--   - 실학생 오아라(s016) 상담기록 2건 (2026-07-06, 중복 더블서밋 1건 포함)
--   - 로그인 기록 1건 (2026-07-15)
-- 사용자 결정: 실상담 1건은 admin 황광희(a-hwang)로 이관·중복 제거 후 4계정 전부 삭제.
--
-- CASCADE로 함께 삭제된 것: assignments 62건(s001~s062 담당 배정), 테스트 학생
-- (s-test-g1) 상담기록 2건, alerts 5건, login_logs 1건.
-- 주의: 이후 실매니저 계정을 만들면 assignments 배정을 새로 해야 매니저 대시보드에
-- 담당 학생이 보인다 (fetchForManager가 assignments.educator_id 기준).
--
-- 멱등: 이미 적용된 DB에서 재실행해도 안전 (0 rows affected).

-- 1) 실상담 이관 (오아라 s016 → admin 황광희)
UPDATE counseling_records SET manager_id = 'a-hwang'
 WHERE id = 'c17833101106054' AND manager_id = 'm01';

-- 2) 더블서밋 중복 제거 (위 기록과 동일 내용, 0.7초 뒤 생성분)
DELETE FROM counseling_records WHERE id = 'c17833101113446';

-- 3) 더미 매니저 4계정 삭제 (관련 데이터 FK CASCADE)
DELETE FROM users WHERE id IN ('m01', 'm02', 'm03', 'm04') AND role = 'manager';
