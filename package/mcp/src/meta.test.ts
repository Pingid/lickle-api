import { expect, test } from 'vitest'
import { InputError, cmd, field, ns, op, string } from '@lickle/cmd-core'
import { run } from '@lickle/cmd-cli'
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

test('hidden commands are left out of the tool list but stay in the tree', async () => {
  const tree = ns({ name: 'app', description: 'Demo.', cmds: [visible, secret] })

  expect(tools(tree, { onWarn: () => {} }).map((e) => e.tool.name)).toEqual(['visible'])

  let out = ''
  const code = await run(tree, ['secret'], { stdout: (s) => (out += s), stderr: () => {} })
  expect(code).toBe(0)
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
// target: exit 2 on the command line, `isError: true` here.
test('InputError from a command is a caller error on both targets', async () => {
  const picky = cmd({ name: 'picky', description: 'Rejects the caller.' }, () => {
    throw new InputError('that will not do')
  })
  const tree = ns({ name: 'app', description: 'Demo.', cmds: [picky] })

  let err = ''
  const code = await run(tree, ['picky'], { stdout: () => {}, stderr: (s) => (err += s) })
  expect(code).toBe(2)
  expect(err).toContain('that will not do')
})
