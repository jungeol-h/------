import { supabase } from './supabase'
import { feedbackLibrary, practiceCards } from '../data/feedbackLibrary'

// DB에서 admin_config 전체 로드
// 반환: { feedbackLibrary, practiceCards } — DB에 없으면 기본값 사용
export async function loadAdminConfig() {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('key, value')

    if (error) throw error

    const map = {}
    if (data) {
      data.forEach(row => { map[row.key] = row.value })
    }

    return {
      feedbackLibrary: map['feedbackLibrary'] ?? feedbackLibrary,
      practiceCards: map['practiceCards'] ?? practiceCards,
    }
  } catch {
    // Supabase 연결 실패 시 기본값
    return { feedbackLibrary, practiceCards }
  }
}

// admin_config upsert
export async function saveAdminConfig(key, value) {
  const { error } = await supabase
    .from('admin_config')
    .upsert({ key, value }, { onConflict: 'key' })

  if (error) throw error
}
