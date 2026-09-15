import { t, type Namespace } from '@lickle/api'
import { api } from '@lickle/api/util'
import { expect, test } from 'vitest'

import { tools } from './core/tools.ts'
import { JSONRPC_VERSION } from './core/wire.ts'
import { mcp } from './serve.ts'

const echo = t.op({
  name: 'echo',
  description: 'Say it back.',
  in: { text: t.string('What to say.') },
  out: t.string(),
  handle: async (i) => i.text,
})

/**
 * A tree holding the operation that serves it. The thunk is why that is
 * possible, and the annotation on `tree` is what stops the two definitions
 * chasing each other.
 */
const build = (input: AsyncIterable<string>, out: string[]) => {
  const tree: Namespace = t.ns({
    name: 'todo',
    description: 'A tiny task list.',
    operations: [echo, mcp(() => tree, { io: { input, write: (c: string) => void out.push(c) } })],
  })
  return tree
}

const serveOf = (tree: Namespace) => {
  const found = tree.operations.map((o) => api.of(o)).find((o) => o.name === 'mcp')
  if (found === undefined || !('handle' in found)) throw new Error('no mcp operation')
  return found
}

const lines = async function* (...chunks: string[]) {
  for (const chunk of chunks) yield chunk
}

const list = `${JSON.stringify({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list' })}\n`

test('it serves the tree it sits in, over its own stream', async () => {
  const out: string[] = []
  const tree = build(lines(list), out)

  await serveOf(tree).handle({}, undefined)

  const names = JSON.parse(out[0]!).result.tools.map((x: { name: string }) => x.name)
  expect(names).toContain('echo')
  // A model has no business asking the server it is talking to for another one.
  expect(names).not.toContain('mcp')
})

test('it resolves only when the input ends, which is what keeps a session alive', async () => {
  const out: string[] = []
  let ended = false
  const slow = (async function* () {
    yield list
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(ended).toBe(false)
  })()

  await serveOf(build(slow, out)).handle({}, undefined)
  ended = true
  expect(out).toHaveLength(1)
})

test('it prints nothing, because stdout carries the protocol', async () => {
  const op = serveOf(build(lines(), []))
  expect(await op.handle({}, undefined)).toBeUndefined()
  // It hides itself, so a tree of only this operation offers no tools at all.
  expect(tools(op, { onWarn: () => {} })).toEqual([])
})
