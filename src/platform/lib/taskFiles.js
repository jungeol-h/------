// 과제 파일 첨부(이미지/PDF) — Storage 업로드/URL 헬퍼 (quizFiles.js 패턴).
// 두 방향 모두 이 버킷을 쓴다:
//   · 강사 첨부(문제/자료) → tasks.attachments 메타
//   · 학생 제출 → tasks.submissions 메타
// 파일은 'task-files' 버킷에 `${uploaderId}/${타임스탬프}-${난수}.${확장자}` 키로 저장하고
// 원본 파일명은 메타(jsonb)에만 둔다 (한글 파일명은 storage 키로 부적합).

import { supabase } from './supabase.js'

const BUCKET = 'task-files'
export const MAX_TASK_FILE_MB = 10
export const MAX_TASK_FILES = 5

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i

// 이미지·PDF 여부·용량 검증. 통과 못 하면 에러 메시지 문자열, 통과하면 null.
export function validateTaskFile(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isImage = IMAGE_TYPES.includes(file.type) || IMAGE_EXT.test(file.name)
  if (!isPdf && !isImage) return '이미지(JPG/PNG/WEBP) 또는 PDF만 첨부할 수 있어요.'
  if (file.size > MAX_TASK_FILE_MB * 1024 * 1024) {
    return `파일당 ${MAX_TASK_FILE_MB}MB 이하만 가능해요.`
  }
  return null
}

// 첨부 칩에서 인라인 이미지로 볼 수 있는지 (아니면 PDF — 링크 열람)
export function isImageTaskFile(att) {
  return IMAGE_EXT.test(att?.path ?? '') || IMAGE_EXT.test(att?.name ?? '')
}

// File[] 업로드 → 메타 배열 [{ path, name, size }]
export async function uploadTaskFiles(files, uploaderId) {
  const uploaded = []
  for (const file of files) {
    const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'bin').toLowerCase()
    const path = `${uploaderId || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined })
    if (error) throw error
    uploaded.push({ path, name: file.name, size: file.size })
  }
  return uploaded
}

// 첨부 열람 URL (public 버킷)
export function taskFileUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// 수정에서 제거된 첨부의 실파일 정리 (best-effort — 실패해도 던지지 않음)
export async function removeTaskFiles(paths) {
  if (!paths?.length) return
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
}
