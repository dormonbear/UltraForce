import { createServer } from 'node:net'

async function reserveLoopback(port) {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return {
    port: server.address().port,
    release: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

export async function reservePlasmoDevPorts(reserve = reserveLoopback) {
  const reservations = []
  const release = async () => {
    await Promise.all(reservations.splice(0).map((reservation) => reservation.release()))
  }
  try {
    const serve = await reserve(0)
    reservations.push(serve)
    // Plasmo 0.90.5 also binds its reload WebSocket at HMR+1. / Plasmo 0.90.5 还在 HMR+1 绑定重载 WebSocket。
    for (let attempt = 0; attempt < 16; attempt++) {
      const hmr = await reserve(0)
      reservations.push(hmr)
      if (hmr.port < 65535) {
        try {
          const reload = await reserve(hmr.port + 1)
          reservations.push(reload)
          return { servePort: serve.port, hmrPort: hmr.port, reloadPort: reload.port, release }
        } catch (error) {
          if (!['EADDRINUSE', 'EACCES'].includes(error.code)) throw error
        }
      }
      reservations.pop()
      await hmr.release()
    }
    throw new Error('No available Plasmo HMR/reload port pair / 无可用 Plasmo HMR／重载端口对')
  } catch (error) {
    await release()
    throw error
  }
}
