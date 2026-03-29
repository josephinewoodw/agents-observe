// app/server/src/routes/health.ts

import { Hono } from 'hono'
import type { EventStore } from '../storage/types'
import { API_ID, VERSION } from '../version'

type Env = { Variables: { store: EventStore } }

const router = new Hono<Env>()

router.get('/health', async (c) => {
  const store = c.get('store')
  const result = await store.healthCheck()

  return c.json(
    {
      ok: result.ok,
      id: API_ID,
      version: VERSION,
      ...(result.error ? { error: result.error } : {}),
    },
    result.ok ? 200 : 503,
  )
})

export default router
