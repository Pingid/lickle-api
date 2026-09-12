import { expect, test } from 'vitest'
import { cmd, commands, field, string } from '@lickle/cmd-core'
import type { SubCmds } from '@lickle/cmd-core'
import { run } from '@lickle/cmd-cli'
import { mcpCmd } from './cmd.ts'
import { JSONRPC_VERSION } from './types.ts'

const echo = cmd(
  {
    name: 'echo',
    description: 'Echo a word.',
    inputs: { word: field({ d: 'The word.', kind: string }) },
    outputs: { word: field({ d: 'The word.', kind: string }) },
  },
  (i: { word: string }) => ({ word: i.word }),
)

/** A tree that serves itself, exactly as a consumer would wire it. */
const build = (frames: string[], protocol: string[]) => {
  const cmds: SubCmds = commands({
    name: 'app',
    description: 'Demo CLI.',
    cmds: [
      echo,
      mcpCmd((): SubCmds => cmds, {
        onWarn: () => {},
        io: {
          input: (async function* () {
            for (const f of frames) yield f
          })(),
          write: (s) => protocol.push(s),
        },
      }),
    ],
  })
  return cmds
}

const frame = (id: number, method: string, params?: object) =>
  `${JSON.stringify({ jsonrpc: JSONRPC_VERSION, id, method, ...(params === undefined ? {} : { params }) })}\n`

test('`app mcp` serves the tree and writes nothing to the CLI stdout', async () => {
  const protocol: string[] = []
  let out = ''
  let err = ''

  const code = await run(build([frame(1, 'tools/list')], protocol), ['mcp'], {
    stdout: (s) => (out += s),
    stderr: (s) => (err += s),
  })

  // The hazard: anything the runner prints would land in the JSON-RPC stream.
  expect(out).toBe('')
  expect(err).toBe('')
  expect(code).toBe(0)

  // And the server really answered on its own stream — offering `echo` but not
  // itself, so a model cannot ask this server to start another one.
  const res = JSON.parse(protocol[0]!)
  expect(res.result.tools.map((t: any) => t.name)).toEqual(['echo'])
})

test('it resolves only once the input ends, not as soon as serving starts', async () => {
  const protocol: string[] = []
  let ended = false

  const input = (async function* () {
    yield frame(1, 'server/discover')
    // Hand control back to the loop; if `run` resolved eagerly the assertion
    // below would already have been reached.
    await new Promise((r) => setTimeout(r, 10))
    expect(ended).toBe(false)
    yield frame(2, 'tools/list')
  })()

  const cmds: SubCmds = commands({
    name: 'app',
    description: 'Demo.',
    cmds: [echo, mcpCmd((): SubCmds => cmds, { onWarn: () => {}, io: { input, write: (s) => protocol.push(s) } })],
  })

  const code = await run(cmds, ['mcp'], { stdout: () => {}, stderr: () => {} })
  ended = true

  expect(code).toBe(0)
  expect(protocol.map((f) => JSON.parse(f).id)).toEqual([1, 2])
})

test('the mcp command declares no outputs, which is what keeps stdout clean', async () => {
  const cmds: SubCmds = commands({ name: 'app', description: 'Demo.', cmds: [mcpCmd((): SubCmds => cmds)] })
  const entry = cmds.cmds[0] as { spec: { outputs?: unknown } }
  expect(entry.spec.outputs).toBeUndefined()
})

test('`app --help` lists mcp alongside the rest', async () => {
  let out = ''
  await run(build([], []), ['--help'], { stdout: (s) => (out += s), stderr: () => {} })
  expect(out).toContain('mcp')
  expect(out).toContain('Serve this program as an MCP server over stdio.')
})
