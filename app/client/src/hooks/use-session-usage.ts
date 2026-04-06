import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Fetches session-level token usage. WebSocket updates are handled
 * in use-websocket.ts which updates this query's cache directly.
 */
export function useSessionUsage(sessionId: string | null) {
  return useQuery({
    queryKey: ['sessionUsage', sessionId],
    queryFn: () => api.getSessionUsage(sessionId!),
    enabled: !!sessionId,
    staleTime: 60_000,
  })
}
