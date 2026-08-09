// 학습일지 파일 첨부(이미지/PDF) — Storage 업로드/URL 헬퍼 (taskFiles.js 패턴).
// 관리자 학생 명단의 '일지' 컬럼에서 학생별로 첨부하고 users.study_journals 메타가 참조한다.
// 파일은 'study-journals' 버킷에 `${uploaderId}/${타임스탬프}-${난수}.${확장자}` 키로 저장하고
// 원본 파일명은 메타(jsonb)에만 둔다 (한글 파일명은 storage 키로 부적합).

import { supabase } from './supabase.js'

const BUCKET = 'study-journals'
export const MAX_STUDY_JOURNAL_MB = 25
export const MAX_STUDY_JOURNALS = 12

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i

// 이미지·PDF 여부·용량 검증. 통과 못 하면 에러 메시지 문자열, 통과하면 null.
export function validateStudyJournalFile(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isImage = IMAGE_TYPES.includes(file.type) || IMAGE_EXT.test(file.name)
  if (!isPdf && !isImage) return '이미지(JPG/PNG/WEBP) 또는 PDF만 첨부할 수 있어요.'
  if (file.size > MAX_STUDY_JOURNAL_MB * 1024 * 1024) {
    return `파일당 ${MAX_STUDY_JOURNAL_MB}MB 이하만 가능해요.`
  }
  return null
}

// File[] 업로드 → 메타 배열 [{ path, name, size, uploadedAt }]
// onProgress(done, total): 파일 단위 진행 콜백
export async function uploadStudyJournalFiles(files, uploaderId, onProgress) {
  const uploaded = []
  onProgress?.(0, files.length)
  for (const file of files) {
    const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'bin').toLowerCase()
    const path = `${uploaderId || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined })
    if (error) throw error
    uploaded.push({ path, name: file.name, size: file.size, uploadedAt: new Date().toISOString() })
    onProgress?.(uploaded.length, files.length)
  }
  return uploaded
}

// 첨부 열람 URL (public 버킷)
export function studyJournalFileUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// 삭제된 첨부의 실파일 정리 (best-effort — 실패해도 던지지 않음)
export async function removeStudyJournalFiles(paths) {
  if (!paths?.length) return
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
}
