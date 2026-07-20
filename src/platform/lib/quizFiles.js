// 확인평가 문제 첨부(이미지/PDF) — Storage 업로드/URL 헬퍼 (financeFiles.js 패턴).
// 파일은 'quiz-attachments' 버킷에 `${authorId}/${타임스탬프}-${난수}.${확장자}` 키로 저장하고
// 원본 파일명은 quiz_questions.attachments 메타(jsonb)에만 둔다.
// heic/heif는 제외 — 학생 응시 화면에서 <img> 인라인 렌더가 목적이라 브라우저 미지원 포맷 거부.

import { supabase } from './supabase.js'

const BUCKET = 'quiz-attachments'
export const MAX_QUIZ_ATTACHMENT_MB = 10
export const MAX_QUIZ_ATTACHMENTS = 3

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i

// 이미지·PDF 여부·용량 검증. 통과 못 하면 에러 메시지 문자열, 통과하면 null.
export function validateQuizAttachment(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isImage = IMAGE_TYPES.includes(file.type) || IMAGE_EXT.test(file.name)
  if (!isPdf && !isImage) return '이미지(JPG/PNG/WEBP) 또는 PDF만 첨부할 수 있어요.'
  if (file.size > MAX_QUIZ_ATTACHMENT_MB * 1024 * 1024) {
    return `파일당 ${MAX_QUIZ_ATTACHMENT_MB}MB 이하만 가능해요.`
  }
  return null
}

// 학생 화면 인라인 <img> 표시 여부 (아니면 PDF — 열람 링크)
export function isImageAttachment(att) {
  return IMAGE_EXT.test(att?.path ?? '')
}

// File[] 업로드 → attachments 메타 배열 [{ path, name, size }]
export async function uploadQuizFiles(files, authorId) {
  const uploaded = []
  for (const file of files) {
    const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'bin').toLowerCase()
    const path = `${authorId || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined })
    if (error) throw error
    uploaded.push({ path, name: file.name, size: file.size })
  }
  return uploaded
}

// 첨부 열람 URL (public 버킷)
export function quizFileUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// 문제 수정에서 제거된 첨부의 실파일 정리 (best-effort — 실패해도 던지지 않음)
// 주의: 셔플 복제 회차는 원본과 path를 공유하므로 과도한 삭제는 금물 — 제거된 것만.
export async function removeQuizFiles(paths) {
  if (!paths?.length) return
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
}
