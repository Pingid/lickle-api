import { expect, test } from 'vitest'
import { cmd, field, isNamespace, ns, string } from '@lickle/cmd-core'
import type { Command, Namespace } from '@lickle/cmd-core'
import { mcpCmd } from './serve.ts'
import { JSONRPC_VERSION } from './types.ts'

const echo = cmd(
  {
    name: 'echo',
    description: 'Echo a word.',
    inputs: { word: field({ description: 'The word.', type: string }) },
    outputs: { word: field({ description: 'The word.', type: string }) },
  },
  (i: { word: string }) => ({ word: i.word }),
)

/** A tree that serves itself, exactly as a consumer would wire it. */
const build = (input: AsyncIterable<string>, protocol: string[]) => {
  const cmds: Namespace = ns({
    name: 'app',
    description: 'Demo.',
    cmds: [echo, mcpCmd((): Namespace => cmds, { onWarn: () => {}, io: { input, write: (s) => protocol.push(s) } })],
  })
  return cmds
}

const frames = async function* (...f: string[]) {
  for (const one of f) yield one
}

const frame = (id: number, method: string, params?: object) =>
  `${JSON.stringify({ jsonrpc: JSONRPC_VERSION, id, method, ...(params === undefined ? {} : { params }) })}\n`

/** The `mcp` command itself, out of the tree it serves. */
const serveCmd = (tree: Namespace): Command => {
  const node = tree.cmds[tree.cmds.length - 1]!
  if (isNamespace(node)) throw new Error('expected a command')
  return node
}

test('the mcp command serves the tree and returns nothing at all', async () => {
  const protocol: string[] = []
  const tree = build(frames(frame(1, 'tools/list')), protocol)

  // Whatever runs this tree renders the return value; anything but `undefined`
  // would land in the JSON-RPC stream on stdio.
  await expect(serveCmd(tree).run({})).resolves.toBeUndefined()

  // And the server really answered on its own stream — offering `echo` but not
  // itself, so a model cannot ask this server to start another one.
  const res = JSON.parse(protocol[0]!)
  expect(res.result.tools.map((t: { name: string }) => t.name)).toEqual(['echo'])
})

test('it resolves only once the input ends, not as soon as serving starts', async () => {
  const protocol: string[] = []
  let ended = false

  const input = (async function* () {
    yield frame(1, 'server/discover')
    // Hand control back to the loop; if the command resolved eagerly the
    // assertion below would already have been reached.
    await new Promise((r) => setTimeout(r, 10))
    expect(ended).toBe(false)
    yield frame(2, 'tools/list')
  })()

  const tree = build(input, protocol)
  await serveCmd(tree).run({})
  ended = true

  expect(protocol.map((f) => JSON.parse(f).id)).toEqual([1, 2])
})

test('the mcp command declares no outputs, which is what keeps stdout clean', () => {
  const tree = build(frames(), [])
  expect(serveCmd(tree).outputs).toBeUndefined()
})

test('it carries the name and description a host lists it under', () => {
  const tree = build(frames(), [])
  expect(serveCmd(tree).name).toBe('mcp')
  expect(serveCmd(tree).description).toBe('Serve this program as an MCP server over stdio.')
})
