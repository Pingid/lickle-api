import { expect, test } from 'vitest'
import { cmd, commands, field, string } from '@lickle/cmd-core'
import { server } from './server.ts'
import { serveStdio } from './stdio.ts'
import { JSONRPC_VERSION, PARSE_ERROR } from './types.ts'

const echo = cmd(
  {
    name: 'echo',
    description: 'Echo a word.',
    inputs: { word: field({ d: 'The word.', kind: string }) },
    outputs: { word: field({ d: 'The word.', kind: string }) },
  },
  (i: { word: string }) => ({ word: i.word }),
)

const dispatch = server(commands({ name: 'app', description: 'Demo.', cmds: [echo] }), { onWarn: () => {} })

/** Feed exact chunks in, collect whatever is written out. */
const drive = async (chunks: string[]): Promise<any[]> => {
  const out: string[] = []
  await serveStdio(dispatch, {
    input: (async function* () {
      for (const c of chunks) yield c
    })(),
    write: (s) => out.push(s),
  })
  // Every frame must be newline-terminated and independently parseable.
  return out.map((frame) => {
    expect(frame.endsWith('\n')).toBe(true)
    return JSON.parse(frame)
  })
}

const req = (id: number, method: string, params?: object) =>
  JSON.stringify({ jsonrpc: JSONRPC_VERSION, id, method, ...(params === undefined ? {} : { params }) })

test('one message per line round-trips', async () => {
  const [res] = await drive([`${req(1, 'tools/list')}\n`])
  expect(res.id).toBe(1)
  expect(res.result.tools[0].name).toBe('echo')
})

test('a message split across chunks is reassembled', async () => {
  const frame = `${req(1, 'tools/list')}\n`
  const third = Math.floor(frame.length / 3)
  const responses = await drive([frame.slice(0, third), frame.slice(third, third * 2), frame.slice(third * 2)])
  expect(responses).toHaveLength(1)
  expect(responses[0].result.tools).toHaveLength(1)
})

test('several messages in one chunk are all handled, in order', async () => {
  const responses = await drive([`${req(1, 'tools/list')}\n${req(2, 'server/discover')}\n${req(3, 'tools/list')}\n`])
  expect(responses.map((r) => r.id)).toEqual([1, 2, 3])
})

test('a final message with no trailing newline still counts', async () => {
  const responses = await drive([req(7, 'server/discover')])
  expect(responses[0].id).toBe(7)
})

test('blank lines between frames are ignored', async () => {
  const responses = await drive([`\n${req(1, 'tools/list')}\n\n\n`])
  expect(responses).toHaveLength(1)
})

test('unparseable input answers PARSE_ERROR without killing the stream', async () => {
  const responses = await drive([`not json\n${req(2, 'tools/list')}\n`])
  expect(responses[0].error.code).toBe(PARSE_ERROR)
  expect(responses[0].id).toBeNull()
  expect(responses[1].id).toBe(2)
})

test('a notification produces no frame at all', async () => {
  const responses = await drive([
    `${JSON.stringify({ jsonrpc: JSONRPC_VERSION, method: 'notifications/cancelled' })}\n${req(1, 'tools/list')}\n`,
  ])
  expect(responses).toHaveLength(1)
  expect(responses[0].id).toBe(1)
})

test('binary chunks are decoded', async () => {
  const out: string[] = []
  await serveStdio(dispatch, {
    input: (async function* () {
      yield new TextEncoder().encode(`${req(1, 'tools/list')}\n`)
    })(),
    write: (s) => out.push(s),
  })
  expect(JSON.parse(out[0]!).id).toBe(1)
})

test('nothing but protocol frames reaches the output', async () => {
  const out: string[] = []
  await serveStdio(dispatch, {
    input: (async function* () {
      yield `${req(1, 'tools/call', { name: 'echo', arguments: { word: 'hi' } })}\n`
    })(),
    write: (s) => out.push(s),
  })
  expect(out).toHaveLength(1)
  expect(JSON.parse(out[0]!).result.structuredContent).toEqual({ word: 'hi' })
})
