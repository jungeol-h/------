// 재정 영수증·사진 첨부 — Storage 업로드/URL 헬퍼 (counselingFiles.js 패턴).
// 파일은 'finance-receipts' 버킷에 `${authorId}/${타임스탬프}-${난수}.${확장자}` 키로 저장하고
// (한글 파일명은 storage 키로 부적합), 원본 파일명은 attachments 메타(jsonb)에만 둔다.
// 이미지+PDF 허용이라 확장자·contentType을 원본 그대로 보존한다.

import { supabase } from './supabase.js'

const BUCKET = 'finance-receipts'
export const MAX_RECEIPT_MB = 10
export const MAX_RECEIPTS = 3

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i

// 이미지·PDF 여부·용량 검증. 통과 못 하면 에러 메시지 문자열, 통과하면 null.
export function validateReceipt(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isImage = IMAGE_TYPES.includes(file.type) || IMAGE_EXT.test(file.name)
  if (!isPdf && !isImage) return '이미지(JPG/PNG 등) 또는 PDF만 첨부할 수 있어요.'
  if (file.size > MAX_RECEIPT_MB * 1024 * 1024) return `파일당 ${MAX_RECEIPT_MB}MB 이하만 가능해요.`
  return null
}

// File[] 업로드 → attachments 메타 배열 [{ path, name, size }]
export async function uploadReceiptFiles(files, authorId) {
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
export function receiptFileUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// 기록 수정에서 제거된 첨부의 실파일 정리 (best-effort — 실패해도 던지지 않음)
export async function removeReceiptFiles(paths) {
  if (!paths?.length) return
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
}
