// 센터 이용시간 lazy fetch 훅 — 출결 탭이 한 번 불러 타임라인·명단 섹션에
// 내려준다 (섹션마다 중복 fetch 방지). 학생 화면은 자체 fetch를 유지한다.

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_OPERATING_DAYS } from '../data/centerHours.js'
import { fetchCenterHours, isMigrationMissing } from './centerHoursApi.js'

export function useCenterHours() {
  const [registrations, setRegistrations] = useState([])
  const [config, setConfig] = useState({ isOpen: false, capacity: 40, operatingDays: DEFAULT_OPERATING_DAYS })
  const [state, setState] = useState({ loading: true, error: null, migrationNeeded: false })

  const reload = useCallback(async () => {
    try {
      const { registrations: regs, config: cfg } = await fetchCenterHours()
      setRegistrations(regs)
      setConfig(cfg)
      setState({ loading: false, error: null, migrationNeeded: false })
    } catch (e) {
      setState({ loading: false, error: e, migrationNeeded: isMigrationMissing(e) })
    }
  }, [])

  // setState는 effect 본문이 아니라 load 클로저의 await 이후에만 (BookingContext 관례)
  useEffect(() => {
    const load = async () => { await reload() }
    load()
  }, [reload])

  return { registrations, config, state, reload }
}
