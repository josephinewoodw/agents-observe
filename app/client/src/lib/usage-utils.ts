import type { ParsedEvent } from '@/types'

/** Format a token count for display: 1234 → "1.2K", 1234567 → "1.2M" */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 10_000) return `${(tokens / 1_000).toFixed(0)}K`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return String(tokens)
}

export interface AgentUsage {
  agentId: string
  totalTokens: number
  totalDurationMs: number
  totalToolUseCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

/**
 * Extract per-agent usage from PostToolUse:Agent events in the event stream.
 * These events carry totalTokens, totalDurationMs, and usage breakdown in tool_response.
 */
export function computeAgentUsageFromEvents(events: ParsedEvent[]): Map<string, AgentUsage> {
  const usageMap = new Map<string, AgentUsage>()

  for (const event of events) {
    if (event.subtype !== 'PostToolUse' || event.toolName !== 'Agent') continue

    const toolResponse = (event.payload as Record<string, unknown>)?.tool_response as
      | Record<string, unknown>
      | undefined
    if (!toolResponse) continue

    const agentId = (toolResponse.agentId as string) || null
    if (!agentId) continue

    const usage = toolResponse.usage as Record<string, unknown> | undefined

    const entry: AgentUsage = {
      agentId,
      totalTokens: (toolResponse.totalTokens as number) || 0,
      totalDurationMs: (toolResponse.totalDurationMs as number) || 0,
      totalToolUseCount: (toolResponse.totalToolUseCount as number) || 0,
      inputTokens: (usage?.input_tokens as number) || 0,
      outputTokens: (usage?.output_tokens as number) || 0,
      cacheReadTokens: (usage?.cache_read_input_tokens as number) || 0,
      cacheCreationTokens: (usage?.cache_creation_input_tokens as number) || 0,
    }

    // Sum if multiple runs for the same agent (unlikely but possible)
    const existing = usageMap.get(agentId)
    if (existing) {
      existing.totalTokens += entry.totalTokens
      existing.totalDurationMs += entry.totalDurationMs
      existing.totalToolUseCount += entry.totalToolUseCount
      existing.inputTokens += entry.inputTokens
      existing.outputTokens += entry.outputTokens
      existing.cacheReadTokens += entry.cacheReadTokens
      existing.cacheCreationTokens += entry.cacheCreationTokens
    } else {
      usageMap.set(agentId, entry)
    }
  }

  return usageMap
}
