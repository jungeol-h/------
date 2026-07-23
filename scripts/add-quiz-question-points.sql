-- ============================================================
-- 확인평가 서술형 배점: quiz_questions.points (문항별 배점, 기본 1점)
-- 배경: 서술형 채점이 정답/오답 이분법이라 부분점수를 못 준다 —
--       문항에 배점을 두고 교사가 0~배점 사이 점수를 입력하는 요구 (클라이언트 2026-07-23).
--       단답형은 항상 1점, 기존 문항·응시 기록은 전부 1점으로 해석 (앱 fallback).
-- 사용: Supabase Studio → SQL Editor → RUN (코드 배포 전에 먼저 실행)
-- 재실행 안전: IF NOT EXISTS
-- ============================================================

alter table quiz_questions add column if not exists points integer not null default 1;
