import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WS_URL } from '@/config/api'
import type { WSMessage } from '@/types'

export function useWebSocket() {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['agents'] })
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [queryClient])

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      return
    }

    function connectWs() {
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
          setConnected(true)
          console.log('[WS] Connected')
        }

        ws.onmessage = (event) => {
          try {
            const msg: WSMessage = JSON.parse(event.data)
            if (
              msg.type === 'event' ||
              msg.type === 'agent_update' ||
              msg.type === 'session_update'
            ) {
              invalidateAll()
            }
          } catch {}
        }

        ws.onclose = () => {
          setConnected(false)
          wsRef.current = null
          console.log('[WS] Disconnected, retrying in 3s...')
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000)
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch {
        reconnectTimeoutRef.current = setTimeout(connectWs, 5000)
      }
    }

    connectWs()

    return () => {
      clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [invalidateAll])

  return { connected }
}
