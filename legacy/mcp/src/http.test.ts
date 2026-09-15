import { expect, test } from 'vitest'
import { cmd, ns, field, string } from '@lickle/api-legacy'
import { httpHandler } from './http.ts'
import { server } from './server.ts'
import { JSONRPC_VERSION, PARSE_ERROR } from './types.ts'

const echo = cmd(
  {
    name: 'echo',
    description: 'Echo a word.',
    inputs: { word: field({ description: 'The word.', type: string }) },
    outputs: { word: field({ description: 'The word.', type: string }) },
  },
  (i: { word: string }) => ({ word: i.word }),
)

const handler = httpHandler(server(ns({ name: 'app', description: 'Demo.', cmds: [echo] }), { onWarn: () => {} }))

const post = (body: unknown) =>
  handler(new Request('https://example.test/mcp', { method: 'POST', body: JSON.stringify(body) }))

test('a POSTed request is answered with JSON', async () => {
  const res = await post({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list' })
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('application/json')
  expect((await res.json()).result.tools[0].name).toBe('echo')
})

test('a tool call round-trips', async () => {
  const res = await post({
    jsonrpc: JSONRPC_VERSION,
    id: 2,
    method: 'tools/call',
    params: { name: 'echo', arguments: { word: 'hi' } },
  })
  expect((await res.json()).result.structuredContent).toEqual({ word: 'hi' })
})

test('a notification is accepted with no body', async () => {
  const res = await post({ jsonrpc: JSONRPC_VERSION, method: 'notifications/cancelled' })
  expect(res.status).toBe(202)
  expect(await res.text()).toBe('')
})

test('unparseable JSON is a 400 carrying PARSE_ERROR', async () => {
  const res = await handler(new Request('https://example.test/mcp', { method: 'POST', body: '{' }))
  expect(res.status).toBe(400)
  expect((await res.json()).error.code).toBe(PARSE_ERROR)
})

test('a non-POST is refused', async () => {
  const res = await handler(new Request('https://example.test/mcp', { method: 'GET' }))
  expect(res.status).toBe(405)
  expect(res.headers.get('allow')).toBe('POST')
})
