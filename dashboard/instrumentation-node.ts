// Backstop for bugs that would otherwise stall the Node event loop and
// leave the container accepting TCP but never responding (502 from Caddy).
// Not a substitute for fixing the underlying faults; log and keep serving
// so Docker's health check and orchestration can decide when to cycle us.
const globalForOpenMemory = globalThis as typeof globalThis & {
  __om_handlers_registered?: boolean
}

if (!globalForOpenMemory.__om_handlers_registered) {
  globalForOpenMemory.__om_handlers_registered = true

  process.on('uncaughtException', (err) => {
    console.error('uncaughtException', err)
  })

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('unhandledRejection', reason)
  })
}

export {}
