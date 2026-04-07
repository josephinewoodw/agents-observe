// app/server/src/routes/tasks.ts
// Agent task queue — CRUD for per-agent tasks.
// Tasks are created from PreToolUse:Agent events and completed from PostToolUse:Agent.

import { Hono } from 'hono'
import type { EventStore } from '../storage/types'

type Env = {
  Variables: {
    store: EventStore
    broadcastToAll: (msg: object) => void
  }
}

const router = new Hono<Env>()

// GET /tasks?agent=timber — fetch tasks for a specific agent, or all tasks
router.get('/tasks', async (c) => {
  const store = c.get('store')
  const agent = c.req.query('agent')

  try {
    const tasks = agent
      ? await store.getTasksForAgent(agent, 30)
      : await store.getAllTasks(50)
    return c.json(tasks)
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to fetch tasks' }, 500)
  }
})

// POST /tasks — create a new task manually
router.post('/tasks', async (c) => {
  const store = c.get('store')
  const broadcastToAll = c.get('broadcastToAll')

  try {
    const body = await c.req.json()
    const { agent_name, title, description, priority, tool_use_id } = body

    if (!agent_name || !title) {
      return c.json({ error: 'agent_name and title are required' }, 400)
    }

    const id = await store.createTask({
      agentName: agent_name,
      title,
      description: description ?? null,
      priority: priority ?? 0,
      toolUseId: tool_use_id ?? null,
    })

    const task = await store.getTaskById(id)
    broadcastToAll({ type: 'task_created', data: task })

    return c.json(task, 201)
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to create task' }, 500)
  }
})

// PATCH /tasks/:id — update task status
router.patch('/tasks/:id', async (c) => {
  const store = c.get('store')
  const broadcastToAll = c.get('broadcastToAll')
  const id = parseInt(c.req.param('id'))

  if (isNaN(id)) {
    return c.json({ error: 'Invalid task id' }, 400)
  }

  try {
    const body = await c.req.json()
    const { status } = body

    if (!['queued', 'active', 'completed', 'failed', 'stale'].includes(status)) {
      return c.json({ error: 'status must be queued | active | completed | failed | stale' }, 400)
    }

    await store.updateTaskStatus(id, status)
    const task = await store.getTaskById(id)

    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    broadcastToAll({ type: 'task_updated', data: task })
    return c.json(task)
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to update task' }, 500)
  }
})

export default router
