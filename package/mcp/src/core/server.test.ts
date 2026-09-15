import { InputError, t } from '@lickle/api'
import { expect, test } from 'vitest'

import { server, type Emit } from './server.ts'
import {
  INVALID_PARAMS,
  INVALID_REQUEST,
  JSONRPC_VERSION,
  METHOD_NOT_FOUND,
  META,
  PROTOCOL_VERSION,
  UNSUPPORTED_PROTOCOL_VERSION,
  type JSONRPCNotification,
} from './wire.ts'

const add = t.op({
  name: 'add',
  description: 'Add a task.',
  in: { title: t.string('What to do.'), times: t.number().default(1) },
  out: t.object({ id: t.number(), title: t.string() }),
  handle: async (i) => ({ id: i.times, title: i.title }),
})

const version = t.op({ name: 'version', description: 'Print it.', out: t.string(), handle: async () => '1.0.0' })
const quiet = t.op({ name: 'quiet', description: 'Nothing.', handle: async () => {} })
const boom = t.op({
  name: 'boom',
  description: 'Fails.',
  handle: async () => {
    throw new Error('the database is on fire')
  },
})
const refuse = t.op({
  name: 'refuse',
  description: 'Blames the caller.',
  handle: async () => {
    throw new InputError('that task is already done')
  },
})
const tick = t.op({
  name: 'tick',
  description: 'Counts.',
  in: { to: t.number().default(3) },
  out: t.output(t.string(), 'async-iter'),
  handle: async function* (i) {
    for (let n = 1; n <= i.to; n++) yield `tick ${n}`
  },
})

const tree = t.ns({
  name: 'todo',
  description: 'A tiny task list.',
  operations: [t.ns({ name: 'task', operations: [add] }), version, quiet, boom, refuse, tick],
})

const dispatch = server(tree, { version: '2.0.0', onWarn: () => {} })
const info = { name: 'todo', version: '2.0.0' }

const call = (method: string, params?: object, id: string | number = 1) =>
  dispatch({ jsonrpc: JSONRPC_VERSION, id, method, params })

const ok = async (method: string, params?: object) => {
  const res = (await call(method, params)) as { result: Record<string, any>; error?: unknown }
  expect(res.error).toBeUndefined()
  return res.result
}

const tool = (name: string, args?: Record<string, unknown>) => ok('tools/call', { name, arguments: args })

// ---------------- the envelope ---------------------------------------------

test('every result says which kind it is, and who answered', async () => {
  for (const result of [await ok('server/discover'), await ok('tools/list'), await tool('version')]) {
    expect(result['resultType']).toBe('complete')
    expect(result['_meta']).toEqual({ [META.serverInfo]: info })
  }
})

test('a failing tool is still a complete result', async () => {
  const result = await tool('boom')
  expect(result).toMatchObject({ resultType: 'complete', isError: true })
  expect(result['content'][0].text).toBe('the database is on fire')
})

// ---------------- server/discover ------------------------------------------

test('discover states the revision, what it can do and who it is', async () => {
  expect(await ok('server/discover')).toEqual({
    resultType: 'complete',
    supportedVersions: [PROTOCOL_VERSION],
    capabilities: { tools: {} },
    serverInfo: info,
    instructions: 'A tiny task list.',
    _meta: { [META.serverInfo]: info },
  })
})

test('the server is named after the tree unless it is told otherwise', async () => {
  const bare = server(tree, { onWarn: () => {} })
  const res = (await bare({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'server/discover' })) as { result: any }
  expect(res.result.serverInfo).toEqual({ name: 'todo', version: '0.0.0' })
})

// ---------------- tools/list -----------------------------------------------

test('the list says how long it may be trusted, and by whom', async () => {
  const result = await ok('tools/list')
  expect(typeof result['ttlMs']).toBe('number')
  expect(result['cacheScope']).toBe('private')
  expect(result['nextCursor']).toBeUndefined()
})

test('caching claims are the server’s to make', async () => {
  const cached = server(tree, { onWarn: () => {}, cache: { ttlMs: 60, scope: 'public' } })
  const res = (await cached({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list' })) as { result: any }
  expect(res.result).toMatchObject({ ttlMs: 60, cacheScope: 'public' })
})

test('a page at a time, when a page size is set', async () => {
  const paged = server(tree, { onWarn: () => {}, pageSize: 2 })
  const ask = async (cursor?: string) => {
    const res = (await paged({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list', params: { cursor } })) as {
      result: any
    }
    return res.result
  }
  const first = await ask()
  expect(first.tools.map((x: any) => x.name)).toEqual(['task_add', 'version'])
  expect(first.nextCursor).toBe('quiet')

  const second = await ask(first.nextCursor)
  expect(second.tools.map((x: any) => x.name)).toEqual(['quiet', 'boom'])

  const last = await ask('tick')
  expect(last.tools.map((x: any) => x.name)).toEqual(['tick'])
  expect(last.nextCursor).toBeUndefined()
})

test('a cursor this server could not have issued is refused', async () => {
  const paged = server(tree, { onWarn: () => {}, pageSize: 2 })
  const bogus = (await paged({
    jsonrpc: JSONRPC_VERSION,
    id: 1,
    method: 'tools/list',
    params: { cursor: 'nope' },
  })) as any
  expect(bogus.error.code).toBe(INVALID_PARAMS)

  const unpaged = (await call('tools/list', { cursor: 'version' })) as any
  expect(unpaged.error.code).toBe(INVALID_PARAMS)
})

// ---------------- tools/call -----------------------------------------------

test('a tool call runs the operation and publishes what it returned', async () => {
  expect(await tool('task_add', { title: 'buy milk', times: 3 })).toMatchObject({
    structuredContent: { id: 3, title: 'buy milk' },
  })
})

test('an operation returning nothing says so', async () => {
  const result = await tool('quiet')
  expect(result['content']).toEqual([{ type: 'text', text: 'Done.' }])
  expect(result['structuredContent']).toBeUndefined()
})

test('a streaming operation is drained into the list its schema declared', async () => {
  expect(await tool('tick', { to: 3 })).toMatchObject({ structuredContent: ['tick 1', 'tick 2', 'tick 3'] })
})

test('an empty stream is an empty list, which is an answer', async () => {
  expect(await tool('tick', { to: 0 })).toMatchObject({ structuredContent: [] })
})

test('a caller error from a handler reaches the model as a result', async () => {
  expect(await tool('refuse')).toMatchObject({ isError: true, content: [{ text: 'that task is already done' }] })
})

test('bad arguments are a tool result, so the model can fix them and retry', async () => {
  const result = await tool('task_add', { title: 5 })
  expect(result).toMatchObject({ isError: true })
  expect(result['content'][0].text).toContain(`invalid value for 'title'`)
})

test('failing to find the tool is a protocol error, not a tool result', async () => {
  const res = (await call('tools/call', { name: 'nope' })) as any
  expect(res.error.code).toBe(METHOD_NOT_FOUND)
  expect(res.result).toBeUndefined()

  const unnamed = (await call('tools/call', {})) as any
  expect(unnamed.error.code).toBe(INVALID_PARAMS)
})

// ---------------- the protocol itself --------------------------------------

test('the version a request declares is read from the key the spec names', async () => {
  const matching = await dispatch({
    jsonrpc: JSONRPC_VERSION,
    id: 1,
    method: 'tools/list',
    params: { _meta: { [META.protocolVersion]: PROTOCOL_VERSION } },
  })
  expect(matching).toMatchObject({ result: { resultType: 'complete' } })

  const other = (await dispatch({
    jsonrpc: JSONRPC_VERSION,
    id: 1,
    method: 'tools/list',
    params: { _meta: { [META.protocolVersion]: '2025-06-18' } },
  })) as any
  expect(other.error.code).toBe(UNSUPPORTED_PROTOCOL_VERSION)
  expect(other.error.data).toEqual({ supportedVersions: [PROTOCOL_VERSION] })
})

test('a method this server does not implement is answered, not ignored', async () => {
  for (const method of ['ping', 'logging/setLevel', 'subscriptions/listen', 'resources/list']) {
    const res = (await call(method)) as any
    expect(res.error.code).toBe(METHOD_NOT_FOUND)
  }
})

test('a notification takes no response at all', async () => {
  expect(await dispatch({ jsonrpc: JSONRPC_VERSION, method: 'notifications/cancelled' })).toBeUndefined()
})

test('something that is not a request is refused without an id to answer to', async () => {
  for (const bad of [null, 'hi', {}, { jsonrpc: '1.0', method: 'x' }, { jsonrpc: JSONRPC_VERSION }]) {
    const res = (await dispatch(bad)) as any
    expect(res).toMatchObject({ id: null, error: { code: INVALID_REQUEST } })
  }
})

// ---------------- progress -------------------------------------------------

test('a long call says how it is going, when it was asked to and the transport can carry it', async () => {
  const sent: JSONRPCNotification[] = []
  const emit: Emit = (n) => void sent.push(n)
  const res = (await dispatch(
    {
      jsonrpc: JSONRPC_VERSION,
      id: 1,
      method: 'tools/call',
      params: { name: 'tick', arguments: { to: 2 }, _meta: { progressToken: 'p1' } },
    },
    emit,
  )) as any
  expect(res.result.structuredContent).toEqual(['tick 1', 'tick 2'])
  expect(sent).toEqual([
    { jsonrpc: JSONRPC_VERSION, method: 'notifications/progress', params: { progressToken: 'p1', progress: 1 } },
    { jsonrpc: JSONRPC_VERSION, method: 'notifications/progress', params: { progressToken: 'p1', progress: 2 } },
  ])
})

test('progress is sent only when it was asked for', async () => {
  const sent: JSONRPCNotification[] = []
  await dispatch(
    { jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/call', params: { name: 'tick', arguments: { to: 2 } } },
    (n) => void sent.push(n),
  )
  expect(sent).toEqual([])
})

test('a transport that cannot carry progress simply does not, and nothing breaks', async () => {
  const res = (await call('tools/call', {
    name: 'tick',
    arguments: { to: 2 },
    _meta: { progressToken: 'p1' },
  })) as any
  expect(res.result.structuredContent).toEqual(['tick 1', 'tick 2'])
})

// ---------------- context --------------------------------------------------

test('a tree that needs a context is given one', async () => {
  const who = t.op({
    name: 'who',
    out: t.string(),
    handle: async (_i: unknown, cx: { user: string }) => cx.user,
  })
  const withCx = server(t.ns({ name: 'root', operations: [who] }), { context: { user: 'dan' }, onWarn: () => {} })
  const res = (await withCx({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/call', params: { name: 'who' } })) as any
  expect(res.result.structuredContent).toBe('dan')
})
