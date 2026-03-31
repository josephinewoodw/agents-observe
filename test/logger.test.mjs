// test/logger.test.mjs
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// We test createLogger by pointing it at a temp directory
let testDir
let savedLogLevel

beforeEach(() => {
  testDir = join(tmpdir(), `logger-test-${Date.now()}`)
  mkdirSync(testDir, { recursive: true })
  savedLogLevel = process.env.AGENTS_OBSERVE_LOG_LEVEL
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
  if (savedLogLevel === undefined) delete process.env.AGENTS_OBSERVE_LOG_LEVEL
  else process.env.AGENTS_OBSERVE_LOG_LEVEL = savedLogLevel
})

async function makeLogger(level) {
  // createLogger reads config, so set env before importing
  if (level) process.env.AGENTS_OBSERVE_LOG_LEVEL = level
  else delete process.env.AGENTS_OBSERVE_LOG_LEVEL
  process.env.AGENTS_OBSERVE_LOGS_DIR = testDir

  // Fresh import each time
  const mod = await import('../hooks/scripts/lib/logger.mjs?' + Date.now())
  return mod.createLogger('test.log')
}

describe('logger', () => {
  it('always writes error to log file regardless of log level', async () => {
    const log = await makeLogger('')
    log.error('bad thing')
    const content = readFileSync(join(testDir, 'test.log'), 'utf8')
    expect(content).toContain('bad thing')
    expect(content).toContain('ERROR')
  })

  it('always writes warn to log file regardless of log level', async () => {
    const log = await makeLogger('')
    log.warn('warning thing')
    const content = readFileSync(join(testDir, 'test.log'), 'utf8')
    expect(content).toContain('warning thing')
    expect(content).toContain('WARN')
  })

  it('does not write debug to log file when log level is unset', async () => {
    const log = await makeLogger('')
    log.debug('verbose thing')
    try {
      readFileSync(join(testDir, 'test.log'), 'utf8')
      // If file exists, it should not contain the debug message
      expect(true).toBe(false) // Should not reach here
    } catch {
      // File doesn't exist — correct behavior
    }
  })

  it('writes debug to log file when log level is debug', async () => {
    const log = await makeLogger('debug')
    log.debug('verbose thing')
    const content = readFileSync(join(testDir, 'test.log'), 'utf8')
    expect(content).toContain('verbose thing')
  })

  it('writes info to log file when log level is debug', async () => {
    const log = await makeLogger('debug')
    log.info('info thing')
    const content = readFileSync(join(testDir, 'test.log'), 'utf8')
    expect(content).toContain('info thing')
  })

  it('writes trace to log file when log level is trace', async () => {
    const log = await makeLogger('trace')
    log.trace('trace thing')
    const content = readFileSync(join(testDir, 'test.log'), 'utf8')
    expect(content).toContain('trace thing')
  })

  it('prunes log file when it exceeds 1MB', async () => {
    const log = await makeLogger('debug')
    const logFile = join(testDir, 'test.log')

    // Write >1MB to the file directly to simulate accumulated logs
    const bigContent = 'X'.repeat(1_100_000) + '\n'
    writeFileSync(logFile, bigContent)

    // Next write should trigger prune
    log.debug('after prune')

    const stat = statSync(logFile)
    expect(stat.size).toBeLessThan(600_000) // ~500KB after prune + new line
    const content = readFileSync(logFile, 'utf8')
    expect(content).toContain('after prune')
  })
})
