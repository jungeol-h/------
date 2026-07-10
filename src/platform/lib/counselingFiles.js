// 업무보고(상담 기록) PDF 첨부 — Storage 업로드/URL 헬퍼.
// 파일은 'counseling-files' 버킷에 `${authorId}/${타임스탬프}-${난수}.pdf` 키로 저장하고
// (한글 파일명은 storage 키로 부적합), 원본 파일명은 attachments 메타(jsonb)에만 둔다.

import { supabase } from './supabase.js'

const BUCKET = 'counseling-files'
export const MAX_ATTACHMENT_MB = 10
export const MAX_ATTACHMENTS = 3

// PDF 여부·용량 검증. 통과 못 하면 에러 메시지 문자열, 통과하면 null.
export function validatePdf(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) return 'PDF 파일만 첨부할 수 있어요.'
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) return `파일당 ${MAX_ATTACHMENT_MB}MB 이하만 가능해요.`
  return null
}

// File[] 업로드 → attachments 메타 배열 [{ path, name, size }]
export async function uploadCounselingPdfs(files, authorId) {
  const uploaded = []
  for (const file of files) {
    const path = `${authorId || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: 'application/pdf' })
    if (error) throw error
    uploaded.push({ path, name: file.name, size: file.size })
  }
  return uploaded
}

// 첨부 열람 URL (public 버킷)
export function counselingFileUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// 기록 수정에서 제거된 첨부의 실파일 정리 (best-effort — 실패해도 던지지 않음)
export async function removeCounselingFiles(paths) {
  if (!paths?.length) return
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
}
