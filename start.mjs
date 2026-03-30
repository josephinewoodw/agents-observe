#!/usr/bin/env node
import { execFileSync, spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.join(__dirname, 'app', 'server')
const clientDir = path.join(__dirname, 'app', 'client')

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}  (in ${path.relative(__dirname, cwd) || '.'})`)
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

// 1. Install dependencies
run('npm', ['install'], serverDir)
run('npm', ['install'], clientDir)

// 2. Build client
run('npm', ['run', 'build'], clientDir)

// 3. Start server with client dist path set
const clientDistPath = path.join(clientDir, 'dist')
const port = process.env.CLAUDE_OBSERVE_SERVER_PORT || '4981'

console.log(`\nStarting server on http://localhost:${port} (API + UI)\n`)

const server = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    CLAUDE_OBSERVE_CLIENT_DIST_PATH: clientDistPath,
    CLAUDE_OBSERVE_SERVER_PORT: port,
  },
})

server.on('close', (code) => process.exit(code ?? 0))
process.on('SIGINT', () => server.kill('SIGINT'))
process.on('SIGTERM', () => server.kill('SIGTERM'))
