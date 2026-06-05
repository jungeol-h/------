self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => Promise.all(clients.map((client) => client.navigate(client.url)))),
  )
})
