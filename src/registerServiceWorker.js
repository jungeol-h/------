import { registerSW } from 'virtual:pwa-register'

let isReloadingForServiceWorkerUpdate = false
let updateServiceWorker = () => {}
let registration

function checkForServiceWorkerUpdate() {
  registration?.update()
}

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
    onRegisteredSW(_swUrl, swRegistration) {
      registration = swRegistration
      checkForServiceWorkerUpdate()
    },
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForServiceWorkerUpdate()
    }
  })
}
