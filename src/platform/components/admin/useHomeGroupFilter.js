// 관리자 홈 그룹 필터 훅 — admin_config(home_group_filter:<userId>)에 저장된 그룹 선택을 로드/저장한다.
// 인원 현황·그룹별 출결 집계 두 섹션이 같은 필터를 공유하도록 AdminHomeTab에서 한 번만 호출해 내려준다.
// 설정이 없으면 로그인한 관리자의 소속 그룹(currentUser.groups)을 기본값으로 채운다.
// groups === null 은 아직 로드 전(로딩 중), 빈 배열은 '전체 그룹' 의미.

import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchHomeGroupFilter, saveHomeGroupFilter } from '../../lib/homeGroupFilter.js'

export function useHomeGroupFilter() {
  const { currentUser } = useAuth()

  const [groups, setGroups] = useState(null) // null = 아직 로드 전
  const [saving, setSaving] = useState(false)

  // 저장된 필터 로드. 없으면 로그인 관리자의 소속 그룹을 기본값으로.
  useEffect(() => {
    let alive = true
    fetchHomeGroupFilter(currentUser?.id)
      .then((saved) => {
        if (!alive) return
        if (saved) setGroups(saved)
        else setGroups(currentUser?.groups?.length ? [...currentUser.groups] : [])
      })
      .catch(() => {
        if (alive) setGroups(currentUser?.groups?.length ? [...currentUser.groups] : [])
      })
    return () => { alive = false }
  }, [currentUser?.id, currentUser?.groups])

  const toggleGroup = (g) => {
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  // 저장 성공 여부 반환 — 실패는 전역 Toast가 표면화하므로 여기서는 조용히 false.
  const saveGroups = async () => {
    setSaving(true)
    try {
      await saveHomeGroupFilter(currentUser?.id, groups)
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  return { groups, toggleGroup, saveGroups, saving }
}
