import type { EventStore } from '../storage/types'
import { extractProjectDir, deriveSlugCandidates } from '../utils/slug'

export interface ResolveProjectInput {
  sessionId: string
  slug: string | null
  transcriptPath: string | null
}

export interface ResolveProjectResult {
  projectId: number
  projectSlug: string
  created: boolean
}

export async function resolveProject(
  store: EventStore,
  input: ResolveProjectInput,
): Promise<ResolveProjectResult> {
  const { slug, transcriptPath } = input

  // 1. Explicit slug override - find or create
  if (slug) {
    const existing = await store.getProjectBySlug(slug)
    if (existing) {
      return { projectId: existing.id, projectSlug: existing.slug, created: false }
    }
    const projectDir = transcriptPath ? extractProjectDir(transcriptPath) : null
    const id = await store.createProject(slug, slug, projectDir)
    return { projectId: id, projectSlug: slug, created: true }
  }

  // 2. Match by transcript_path
  if (transcriptPath) {
    const projectDir = extractProjectDir(transcriptPath)
    const existing = await store.getProjectByTranscriptPath(projectDir)
    if (existing) {
      return { projectId: existing.id, projectSlug: existing.slug, created: false }
    }

    const candidates = deriveSlugCandidates(transcriptPath)
    for (const candidate of candidates) {
      if (await store.isSlugAvailable(candidate)) {
        const id = await store.createProject(candidate, candidate, projectDir)
        return { projectId: id, projectSlug: candidate, created: true }
      }
    }

    const base = candidates[0]
    let suffix = 2
    while (!(await store.isSlugAvailable(`${base}-${suffix}`))) {
      suffix++
    }
    const finalSlug = `${base}-${suffix}`
    const id = await store.createProject(finalSlug, finalSlug, projectDir)
    return { projectId: id, projectSlug: finalSlug, created: true }
  }

  // 3. No slug, no transcript_path - use "unknown" project
  const unknown = await store.getProjectBySlug('unknown')
  if (unknown) {
    return { projectId: unknown.id, projectSlug: 'unknown', created: false }
  }
  const id = await store.createProject('unknown', 'unknown', null)
  return { projectId: id, projectSlug: 'unknown', created: true }
}
