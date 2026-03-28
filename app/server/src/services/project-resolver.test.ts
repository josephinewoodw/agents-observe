import { describe, test, expect, beforeEach } from 'vitest'
import { SqliteAdapter } from '../storage/sqlite-adapter'
import { resolveProject } from './project-resolver'

let store: SqliteAdapter

beforeEach(() => {
  store = new SqliteAdapter(':memory:')
})

describe('resolveProject', () => {
  test('creates new project from slug when no project exists', async () => {
    const result = await resolveProject(store, {
      sessionId: 'sess1',
      slug: 'my-project',
      transcriptPath: null,
    })
    expect(result.projectId).toBeGreaterThan(0)
    expect(result.projectSlug).toBe('my-project')
    expect(result.created).toBe(true)
  })

  test('returns existing project when slug matches', async () => {
    const existingId = await store.createProject('my-project', 'my-project', null)
    const result = await resolveProject(store, {
      sessionId: 'sess1',
      slug: 'my-project',
      transcriptPath: null,
    })
    expect(result.projectId).toBe(existingId)
    expect(result.created).toBe(false)
  })

  test('matches project by transcript_path when no slug provided', async () => {
    const existingId = await store.createProject(
      'my-project',
      'my-project',
      '/Users/joe/.claude/projects/-Users-joe-my-app',
    )
    const result = await resolveProject(store, {
      sessionId: 'sess1',
      slug: null,
      transcriptPath: '/Users/joe/.claude/projects/-Users-joe-my-app/session.jsonl',
    })
    expect(result.projectId).toBe(existingId)
    expect(result.created).toBe(false)
  })

  test('creates project from transcript_path when no match exists', async () => {
    const result = await resolveProject(store, {
      sessionId: 'sess1',
      slug: null,
      transcriptPath: '/Users/joe/.claude/projects/-Users-joe-Development-my-app/session.jsonl',
    })
    expect(result.projectId).toBeGreaterThan(0)
    expect(result.projectSlug).toBe('my-app')
    expect(result.created).toBe(true)
  })

  test('handles slug collision when deriving from transcript_path', async () => {
    await store.createProject('my-app', 'my-app', '/other/path')
    const result = await resolveProject(store, {
      sessionId: 'sess1',
      slug: null,
      transcriptPath: '/Users/joe/.claude/projects/-Users-joe-Development-my-app/session.jsonl',
    })
    expect(result.projectId).toBeGreaterThan(0)
    expect(result.projectSlug).toBe('development-my-app')
    expect(result.created).toBe(true)
  })

  test('falls back to unknown project when no slug or transcript_path', async () => {
    const result = await resolveProject(store, {
      sessionId: 'sess1',
      slug: null,
      transcriptPath: null,
    })
    expect(result.projectId).toBeGreaterThan(0)
    expect(result.projectSlug).toBe('unknown')
    expect(result.created).toBe(true)
  })

  test('reuses existing unknown project on second call', async () => {
    const r1 = await resolveProject(store, { sessionId: 's1', slug: null, transcriptPath: null })
    const r2 = await resolveProject(store, { sessionId: 's2', slug: null, transcriptPath: null })
    expect(r1.projectId).toBe(r2.projectId)
  })

  test('slug override takes priority over transcript_path', async () => {
    await store.createProject(
      'from-path',
      'from-path',
      '/Users/joe/.claude/projects/-Users-joe-my-app',
    )
    const result = await resolveProject(store, {
      sessionId: 'sess1',
      slug: 'custom-slug',
      transcriptPath: '/Users/joe/.claude/projects/-Users-joe-my-app/session.jsonl',
    })
    expect(result.projectSlug).toBe('custom-slug')
    expect(result.created).toBe(true)
  })
})
