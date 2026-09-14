import { expect, test } from 'vitest'
import { InputError, cmd, field, ns, op, operations, string } from '@lickle/api'
import { server } from './server.ts'
import { JSONRPC_VERSION } from './types.ts'
import { hideFromTools, isHiddenFromTools, mcpMeta } from './meta.ts'
import { tools } from './tools.ts'

const visible = cmd({ name: 'visible', description: 'A normal command.' }, () => {})
const secret = cmd(hideFromTools(op({ name: 'secret', description: 'Not for a model.' })), () => {})

test('hidden is plain data under the mcp key', () => {
  expect(secret.meta).toEqual({ mcp: { hidden: true } })
  expect(isHiddenFromTools(secret)).toBe(true)
  expect(isHiddenFromTools(visible)).toBe(false)
  expect(mcpMeta(visible)).toEqual({})
})

test('hidden commands are left out of the tool list but stay in the tree', () => {
  const tree = ns({ name: 'app', description: 'Demo.', cmds: [visible, secret] })

  expect(tools(tree, { onWarn: () => {} }).map((e) => e.tool.name)).toEqual(['visible'])
  // Still a normal command for whatever else runs the tree.
  expect(tree.cmds.map((c) => c.name)).toEqual(['visible', 'secret'])
})

// Hiding used to key on the operation object's identity in a module-level
// WeakSet, so two commands sharing one literal were hidden together.
test('two commands sharing an operation literal are hidden independently', () => {
  const shared = op({ name: 'shared', description: 'Reused.' })
  const tree = ns({
    name: 'app',
    description: 'Demo.',
    cmds: [cmd({ ...shared, name: 'plain' }, () => {}), cmd(hideFromTools({ ...shared, name: 'quiet' }), () => {})],
  })
  expect(tools(tree, { onWarn: () => {} }).map((e) => e.tool.name)).toEqual(['plain'])
})

test('an operation returning a single value declares no outputSchema', () => {
  const tree = ns({
    name: 'app',
    description: 'Demo.',
    cmds: [
      cmd(
        { name: 'doc', description: 'Returns a document.', outputs: field({ description: 'Body.', type: string }) },
        () => 'hi',
      ),
      cmd(
        { name: 'rec', description: 'Returns fields.', outputs: { id: field({ description: 'Id.', type: string }) } },
        () => ({ id: 'x' }),
      ),
    ],
  })
  const [doc, rec] = tools(tree, { onWarn: () => {} })
  expect(doc?.tool.outputSchema).toBeUndefined()
  expect(rec?.tool.outputSchema).toMatchObject({ type: 'object', required: ['id'] })
})

// A command that throws core's portable InputError is a caller error on every
// target: `isError: true` here, exit 2 on the command line.
test('InputError from a command comes back as a tool result, not a protocol error', async () => {
  const picky = cmd({ name: 'picky', description: 'Rejects the caller.' }, () => {
    throw new InputError('that will not do')
  })
  const dispatch = server(ns({ name: 'app', description: 'Demo.', cmds: [picky] }), { onWarn: () => {} })

  const res = await dispatch({
    jsonrpc: JSONRPC_VERSION,
    id: 1,
    method: 'tools/call',
    params: { name: 'picky', arguments: {} },
  })

  expect(res).toMatchObject({ result: { isError: true, content: [{ text: 'that will not do' }] } })
  expect(res).not.toHaveProperty('error')
})

// Hiding a namespace is a prune, not a filter: `operations` takes the predicate
// so the whole subtree goes, and core never learns what "hidden" means.
test('hiding a namespace removes everything beneath it', () => {
  const inner = cmd({ name: 'inner', description: 'Nested.' }, () => {})
  const tree = ns({
    name: 'app',
    description: 'Demo.',
    cmds: [visible, hideFromTools({ name: 'ops', description: 'Operator only.', cmds: [inner, secret] })],
  })

  // Still a complete tree for whatever else renders it.
  expect(operations(tree).map((o) => o.path.join(' '))).toEqual(['visible', 'ops inner', 'ops secret'])
  // But the model sees only what is not pruned.
  expect(tools(tree, { onWarn: () => {} }).map((e) => e.tool.name)).toEqual(['visible'])
})

test('an unhidden namespace still contributes its commands', () => {
  const inner = cmd({ name: 'inner', description: 'Nested.' }, () => {})
  const tree = ns({
    name: 'app',
    description: 'Demo.',
    cmds: [{ name: 'db', description: 'Database.', cmds: [inner] }],
  })
  expect(tools(tree, { onWarn: () => {} }).map((e) => e.tool.name)).toEqual(['db_inner'])
})
