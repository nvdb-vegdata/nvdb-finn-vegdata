import index from './index.html'

let port = 3000

for (let i = 0; i < 10; i++) {
  try {
    Bun.serve({
      port: port,
      routes: {
        '/': index,
      },
      development: {
        hmr: true,
        console: true,
      },
    })
    console.log(`Server running at http://localhost:${port}`)
    break
  } catch (error: any) {
    if ('code' in error && error.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying next port...`)
      port++
    } else {
      console.error('Failed to start server:', error)
      process.exit(1)
    }
  }
}
