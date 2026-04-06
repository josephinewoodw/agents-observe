// app/server/src/routes/stats.ts
// Reads ~/.claude/stats-cache.json and returns processed token usage data
// for the Mission Control dashboard.
// Also queries the observe.db for per-agent tool usage heatmap data.

import { Hono } from 'hono'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'
import { config } from '../config'

const router = new Hono()

const STATS_PATH = path.join(os.homedir(), '.claude', 'stats-cache.json')

interface DailyModelTokens {
  date: string
  tokensByModel: Record<string, number>
}

interface ModelUsageEntry {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests?: number
  costUSD?: number
}

interface DailyActivity {
  date: string
  messageCount: number
  sessionCount: number
  toolCallCount: number
}

interface StatsCache {
  version: number
  lastComputedDate: string
  dailyModelTokens: DailyModelTokens[]
  modelUsage: Record<string, ModelUsageEntry>
  dailyActivity: DailyActivity[]
  totalSessions: number
  totalMessages: number
}

function getDayTokens(entry: DailyModelTokens): number {
  return Object.values(entry.tokensByModel).reduce((s, v) => s + v, 0)
}

// Tool name → task category mapping
const TOOL_CATEGORIES: Record<string, string> = {
  Read: 'files',
  Write: 'files',
  Edit: 'files',
  Glob: 'files',
  Bash: 'exec',
  Grep: 'search',
  WebSearch: 'search',
  WebFetch: 'search',
  TodoWrite: 'planning',
  TodoRead: 'planning',
  mcp__discord: 'notify',
  'mcp__plugin_imessage_imessage__reply': 'notify',
  'mcp__plugin_imessage_imessage__chat_messages': 'notify',
  Agent: 'agents',
  Skill: 'agents',
  ToolSearch: 'search',
  NotebookEdit: 'files',
  mcp__Notion: 'content',
  mcp__Brave: 'search',
}

function categorize(toolName: string | null): string {
  if (!toolName) return 'other'
  // Prefix-match for MCP tools
  for (const [prefix, cat] of Object.entries(TOOL_CATEGORIES)) {
    if (toolName === prefix || toolName.startsWith(prefix + '__')) return cat
  }
  return 'other'
}

// Known agent name resolvers (matches useAgentEvents.ts logic)
function resolveAgentType(agentType: string | null, name: string | null): string {
  if (agentType) {
    const lower = agentType.toLowerCase()
    if (['fern', 'scout', 'reed', 'sentinel', 'timber'].includes(lower)) return lower
  }
  if (name) {
    const lower = name.toLowerCase()
    if (['fern', 'scout', 'reed', 'sentinel', 'timber'].includes(lower)) return lower
    if (lower.includes('scout')) return 'scout'
    if (lower.includes('reed')) return 'reed'
    if (lower.includes('sentinel')) return 'sentinel'
    if (lower.includes('timber')) return 'timber'
  }
  return 'fern' // default root agent → fern
}

router.get('/stats', (c) => {
  let raw: StatsCache

  try {
    raw = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'))
  } catch {
    return c.json({ error: 'stats-cache.json not found or unreadable' }, 503)
  }

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  // Build a lookup for dailyModelTokens by date
  const byDate = new Map<string, DailyModelTokens>()
  for (const entry of raw.dailyModelTokens) {
    byDate.set(entry.date, entry)
  }

  // Activity lookup by date
  const activityByDate = new Map<string, DailyActivity>()
  for (const entry of raw.dailyActivity) {
    activityByDate.set(entry.date, entry)
  }

  // Today and yesterday token breakdowns
  const todayEntry = byDate.get(today)
  const yesterdayEntry = byDate.get(yesterday)

  const todayTokensByModel: Record<string, number> = todayEntry?.tokensByModel ?? {}
  const todayTotal = getDayTokens({ date: today, tokensByModel: todayTokensByModel })

  const yesterdayTotal = yesterdayEntry ? getDayTokens(yesterdayEntry) : 0

  // Last 7 days for weekly average (not including today)
  const last7Days: DailyModelTokens[] = []
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    const entry = byDate.get(d)
    if (entry) last7Days.push(entry)
  }
  const weeklyAvg = last7Days.length > 0
    ? Math.round(last7Days.reduce((s, e) => s + getDayTokens(e), 0) / last7Days.length)
    : 0

  // Recent 14 days for the daily chart (oldest first)
  const recentDays: Array<{
    date: string
    total: number
    byModel: Record<string, number>
    messageCount: number
    toolCallCount: number
  }> = []

  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    const tokenEntry = byDate.get(d)
    const actEntry = activityByDate.get(d)
    recentDays.push({
      date: d,
      total: tokenEntry ? getDayTokens(tokenEntry) : 0,
      byModel: tokenEntry?.tokensByModel ?? {},
      messageCount: actEntry?.messageCount ?? 0,
      toolCallCount: actEntry?.toolCallCount ?? 0,
    })
  }

  // Cumulative model totals (all time from modelUsage)
  const cumulativeByModel: Record<string, { total: number; input: number; output: number; cacheRead: number; cacheCreate: number }> = {}
  for (const [model, usage] of Object.entries(raw.modelUsage)) {
    const total = usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens
    cumulativeByModel[model] = {
      total,
      input: usage.inputTokens,
      output: usage.outputTokens,
      cacheRead: usage.cacheReadInputTokens,
      cacheCreate: usage.cacheCreationInputTokens,
    }
  }

  // ── Heatmap: agent × task category tool call counts ──
  // Query from observe.db directly
  const AGENTS = ['fern', 'scout', 'reed', 'sentinel', 'timber']
  const CATEGORIES = ['files', 'exec', 'search', 'content', 'agents', 'notify', 'planning', 'other']
  const heatmap: Record<string, Record<string, number>> = {}
  for (const agent of AGENTS) {
    heatmap[agent] = {}
    for (const cat of CATEGORIES) {
      heatmap[agent][cat] = 0
    }
  }

  try {
    const db = new Database(config.dbPath, { readonly: true })

    // Join events with agents to get agent_type + tool_name counts
    const rows = db.prepare(`
      SELECT
        a.agent_type,
        a.name as agent_name,
        e.tool_name,
        COUNT(*) as count
      FROM events e
      JOIN agents a ON e.agent_id = a.id
      WHERE e.subtype = 'PostToolUse'
        AND e.tool_name IS NOT NULL
      GROUP BY a.agent_type, a.name, e.tool_name
    `).all() as Array<{ agent_type: string | null; agent_name: string | null; tool_name: string; count: number }>

    db.close()

    for (const row of rows) {
      const agentKey = resolveAgentType(row.agent_type, row.agent_name)
      if (!AGENTS.includes(agentKey)) continue
      const cat = categorize(row.tool_name)
      heatmap[agentKey][cat] = (heatmap[agentKey][cat] || 0) + row.count
    }
  } catch {
    // DB query failed — return empty heatmap rather than erroring
  }

  return c.json({
    lastComputedDate: raw.lastComputedDate,
    today: {
      date: today,
      total: todayTotal,
      byModel: todayTokensByModel,
      messages: activityByDate.get(today)?.messageCount ?? 0,
      toolCalls: activityByDate.get(today)?.toolCallCount ?? 0,
    },
    yesterday: {
      date: yesterday,
      total: yesterdayTotal,
      byModel: yesterdayEntry?.tokensByModel ?? {},
    },
    weeklyAvg,
    recentDays,
    cumulative: cumulativeByModel,
    totalSessions: raw.totalSessions,
    totalMessages: raw.totalMessages,
    heatmap,
    heatmapAgents: AGENTS,
    heatmapCategories: CATEGORIES,
  })
})

// GET /stats/live — live token totals from session_usage table
// This reflects data from the getSessionUsage transcript callback,
// which fires on every Stop event. Much more real-time than stats-cache.json.
router.get('/stats/live', (c) => {
  try {
    const db = new Database(config.dbPath, { readonly: true })

    // Today's sessions started since midnight UTC
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()

    // Sum usage across all sessions that were active today
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(su.input_tokens), 0) as input_tokens,
        COALESCE(SUM(su.output_tokens), 0) as output_tokens,
        COALESCE(SUM(su.cache_read_tokens), 0) as cache_read_tokens,
        COALESCE(SUM(su.cache_creation_tokens), 0) as cache_creation_tokens,
        COALESCE(SUM(su.total_cost_usd), 0) as total_cost_usd,
        COUNT(su.session_id) as session_count,
        MAX(su.updated_at) as last_updated
      FROM session_usage su
      JOIN sessions s ON s.id = su.session_id
      WHERE s.started_at >= ?
    `).get(todayMs) as {
      input_tokens: number
      output_tokens: number
      cache_read_tokens: number
      cache_creation_tokens: number
      total_cost_usd: number
      session_count: number
      last_updated: number | null
    }

    db.close()

    const totalTokens = (row?.input_tokens || 0)
      + (row?.output_tokens || 0)
      + (row?.cache_read_tokens || 0)
      + (row?.cache_creation_tokens || 0)

    return c.json({
      inputTokens: row?.input_tokens || 0,
      outputTokens: row?.output_tokens || 0,
      cacheReadTokens: row?.cache_read_tokens || 0,
      cacheCreationTokens: row?.cache_creation_tokens || 0,
      totalTokens,
      totalCostUsd: row?.total_cost_usd || 0,
      sessionCount: row?.session_count || 0,
      lastUpdated: row?.last_updated || null,
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to query live stats' }, 500)
  }
})

export default router
