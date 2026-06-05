import { registerSW } from 'virtual:pwa-register'

let isReloadingForServiceWorkerUpdate = false
let updateServiceWorker = () => {}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloadingForServiceWorkerUpdate) {
      return
    }

    isReloadingForServiceWorkerUpdate = true
    window.location.reload()
  })

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateServiceWorker(true)
    },
    onRegisteredSW(_swUrl, registration) {
      registration?.update()
    },
  })
}
