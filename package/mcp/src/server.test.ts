import { expect, test } from 'vitest'
import { bool, cmd, ns, field, list, num, optional, string } from '@lickle/cmd-core'
import type { Namespace } from '@lickle/cmd-core'
import { server } from './server.ts'
import {
  INVALID_REQUEST,
  JSONRPC_VERSION,
  METHOD_NOT_FOUND,
  PROTOCOL_VERSION,
  UNSUPPORTED_PROTOCOL_VERSION,
} from './types.ts'

const migrate = cmd(
  {
    name: 'migrate',
    description: 'Apply pending migrations.',
    inputs: {
      target: field({ description: 'Migration to stop at.', type: string }),
      mode: field({ description: 'How to apply them.', type: string, values: ['fast', 'safe'], default: 'safe' }),
      tags: field({ description: 'Tags.', type: list(string) }),
      note: field({ description: 'A note.', type: optional(string) }),
      dry: field({ description: 'Do not write.', type: bool }),
    },
    outputs: { applied: field({ description: 'How many ran.', type: num }) },
  },
  (i: { target: string; mode: string; tags: string[]; dry: boolean }) => ({ applied: i.tags.length + 1 }),
)

const seed = cmd({ name: 'seed', description: 'Seed the database.' }, () => {})
const boom = cmd({ name: 'boom', description: 'Always fails.' }, () => {
  throw new Error('the database is on fire')
})

const cmds: Namespace = ns({
  name: 'app',
  description: 'Demo CLI.',
  cmds: [{ name: 'db', description: 'Database ns.', cmds: [migrate, seed] }, boom],
})

const dispatch = server(cmds, { onWarn: () => {} })

const call = (method: string, params?: object, id: string | number = 1) =>
  dispatch({ jsonrpc: JSONRPC_VERSION, id, method, ...(params === undefined ? {} : { params }) })

const ok = async (method: string, params?: object) => {
  const res: any = await call(method, params)
  expect(res.error, `unexpected error: ${JSON.stringify(res.error)}`).toBeUndefined()
  return res.result
}

test('server/discover advertises the revision, tools capability and instructions', async () => {
  expect(await ok('server/discover')).toEqual({
    supportedVersions: [PROTOCOL_VERSION],
    capabilities: { tools: {} },
    instructions: 'Demo CLI.',
  })
})

test('tools/list names every leaf by its path, and no groups', async () => {
  const { tools } = await ok('tools/list')
  expect(tools.map((t: any) => t.name)).toEqual(['db_migrate', 'db_seed', 'boom'])
  expect(tools.map((t: any) => t.title)).toEqual(['db migrate', 'db seed', 'boom'])
})

test('a tool carries the spec as JSON Schema, descriptions and all', async () => {
  const { tools } = await ok('tools/list')
  const tool = tools.find((t: any) => t.name === 'db_migrate')

  expect(tool.description).toBe('Apply pending migrations.')
  expect(tool.inputSchema.properties.mode).toEqual({
    type: 'string',
    enum: ['fast', 'safe'],
    description: 'How to apply them.',
    default: 'safe',
  })
  expect(tool.inputSchema.properties.tags).toEqual({
    type: 'array',
    items: { type: 'string' },
    description: 'Tags.',
  })
  // `mode` is defaulted and `note` optional, so neither is demanded.
  expect(tool.inputSchema.required).toEqual(['target', 'tags', 'dry'])
  expect(tool.outputSchema.properties.applied).toEqual({ type: 'number', description: 'How many ran.' })
})

test('a command with no outputs declares no outputSchema', async () => {
  const { tools } = await ok('tools/list')
  expect(tools.find((t: any) => t.name === 'db_seed').outputSchema).toBeUndefined()
})

test('tools/call runs the command and returns structured plus text content', async () => {
  const result = await ok('tools/call', {
    name: 'db_migrate',
    arguments: { target: 'v3', tags: ['a', 'b'], dry: false },
  })
  expect(result.structuredContent).toEqual({ applied: 3 })
  expect(result.content).toEqual([{ type: 'text', text: JSON.stringify({ applied: 3 }, null, 2) }])
  expect(result.isError).toBeUndefined()
})

test('defaults are applied and optionals left unset', async () => {
  // `mode` defaults to 'safe'; passing nothing for `note` must not fail.
  const result = await ok('tools/call', { name: 'db_migrate', arguments: { target: 'v3', tags: [], dry: true } })
  expect(result.structuredContent).toEqual({ applied: 1 })
})

test('a void command still answers with content', async () => {
  const result = await ok('tools/call', { name: 'db_seed' })
  expect(result).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
})

test('a command that throws is a tool result, not a protocol error', async () => {
  // The schema is explicit: the model must be able to see the failure.
  const result = await ok('tools/call', { name: 'boom' })
  expect(result.isError).toBe(true)
  expect(result.content[0].text).toBe('the database is on fire')
})

test('bad arguments are a tool result too, naming what was wrong', async () => {
  const missing = await ok('tools/call', { name: 'db_migrate', arguments: { tags: [], dry: false } })
  expect(missing.isError).toBe(true)
  expect(missing.content[0].text).toMatch(/missing required argument 'target'/)

  const wrongType = await ok('tools/call', {
    name: 'db_migrate',
    arguments: { target: 'v3', tags: 'a', dry: false },
  })
  expect(wrongType.content[0].text).toMatch(/'tags' expects an array, got string/)

  const badChoice = await ok('tools/call', {
    name: 'db_migrate',
    arguments: { target: 'v3', tags: [], dry: false, mode: 'sloppy' },
  })
  expect(badChoice.content[0].text).toMatch(/invalid value for 'mode': 'sloppy' \(expected 'fast' or 'safe'\)/)

  const unknownArg = await ok('tools/call', {
    name: 'db_migrate',
    arguments: { target: 'v3', tags: [], dry: false, nope: 1 },
  })
  expect(unknownArg.content[0].text).toMatch(/unknown argument 'nope'/)
})

test('an unknown tool is a protocol error, not a tool result', async () => {
  // The schema draws this line: errors *finding* the tool are protocol errors.
  const res: any = await call('tools/call', { name: 'nope' })
  expect(res.error.code).toBe(METHOD_NOT_FOUND)
  expect(res.result).toBeUndefined()
})

test('an unknown method is METHOD_NOT_FOUND', async () => {
  const res: any = await call('resources/list')
  expect(res.error.code).toBe(METHOD_NOT_FOUND)
})

test('a notification gets no response at all', async () => {
  expect(await dispatch({ jsonrpc: JSONRPC_VERSION, method: 'notifications/cancelled' })).toBeUndefined()
})

test('a message that is not a JSON-RPC request is rejected', async () => {
  for (const bad of [null, 42, {}, { jsonrpc: '1.0', id: 1, method: 'tools/list' }, { jsonrpc: '2.0', id: 1 }]) {
    const res: any = await dispatch(bad)
    expect(res.error.code, JSON.stringify(bad)).toBe(INVALID_REQUEST)
    expect(res.id).toBeNull()
  }
})

test('a request declaring another protocol revision is refused with the supported list', async () => {
  const res: any = await call('tools/list', { _meta: { 'io.modelcontextprotocol/protocol-version': '2025-06-18' } })
  expect(res.error.code).toBe(UNSUPPORTED_PROTOCOL_VERSION)
  expect(res.error.data).toEqual({ supportedVersions: [PROTOCOL_VERSION] })
})

test('a request declaring the supported revision passes through', async () => {
  const result = await ok('tools/list', { _meta: { 'io.modelcontextprotocol/protocol-version': PROTOCOL_VERSION } })
  expect(result.tools).toHaveLength(3)
})

test('colliding tool names are suffixed and reported', async () => {
  const warnings: string[] = []
  const clash = server(
    ns({
      name: 'app',
      description: 'x',
      cmds: [
        cmd({ name: 'db_migrate', description: 'Flat one.' }, () => {}),
        { name: 'db', description: 'Group.', cmds: [cmd({ name: 'migrate', description: 'Nested one.' }, () => {})] },
      ],
    }),
    { onWarn: (m) => warnings.push(m) },
  )
  const res: any = await clash({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list' })
  expect(res.result.tools.map((t: any) => t.name)).toEqual(['db_migrate', 'db_migrate_2'])
  expect(warnings[0]).toMatch(/'db_migrate' is taken/)
})

test('a hidden command is not offered as a tool but still runs', async () => {
  // `mcp` is hidden: a model should not be able to ask for another server.
  const { mcpCmd } = await import('./cmd.ts')
  const tree: Namespace = ns({
    name: 'app',
    description: 'x',
    cmds: [seed, mcpCmd((): Namespace => tree)],
  })
  const res: any = await server(tree, { onWarn: () => {} })({ jsonrpc: JSONRPC_VERSION, id: 1, method: 'tools/list' })
  expect(res.result.tools.map((t: any) => t.name)).toEqual(['seed'])
})
