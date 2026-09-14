import { expect, test } from 'vitest'
import { cli, cliMeta, positionalsOf } from './meta.ts'
import { cmd, field, string } from '@lickle/cmd-core'

const greet = {
  name: 'greet',
  description: 'Greet someone.',
  inputs: { name: field({ description: 'Who to greet.', type: string }) },
}

test('cli attaches positionals under its own meta key', () => {
  const op = cli(greet, { positionals: ['name'] })
  expect(op.meta).toEqual({ cli: { positionals: ['name'] } })
  expect(positionalsOf(op)).toEqual(['name'])
})

test('an operation without cli meta simply has none', () => {
  expect(cliMeta(greet)).toEqual({})
  expect(positionalsOf(greet)).toEqual([])
})

test('other adapters’ meta is preserved, not replaced', () => {
  const op = cli({ ...greet, meta: { mcp: { hidden: true } } }, { positionals: ['name'] })
  expect(op.meta).toEqual({ mcp: { hidden: true }, cli: { positionals: ['name'] } })
})

test('meta written inline is read the same way', () => {
  expect(positionalsOf({ ...greet, meta: { cli: { positionals: ['name'] } } })).toEqual(['name'])
})

// The point of configuring at the binding rather than the description: one
// operation, with handler, reused by two programs that place its inputs
// differently. Before this, `positionals` was welded into the operation.
test('one command can be bound with different positionals', () => {
  const add = cmd({ ...greet, inputs: { name: greet.inputs.name, tag: greet.inputs.name } }, () => {})

  const byName = cli(add, { positionals: ['name'] })
  const byTag = cli(add, { positionals: ['tag'] })

  expect(positionalsOf(byName)).toEqual(['name'])
  expect(positionalsOf(byTag)).toEqual(['tag'])
  // The command they were both bound from is untouched.
  expect(positionalsOf(add)).toEqual([])
})

test('configuring a command keeps its handler', async () => {
  const add = cmd(greet, () => ({ ok: true }) as never)
  const bound = cli(add, { positionals: ['name'] })
  expect(typeof bound.run).toBe('function')
  expect(await bound.run({ name: 'ada' } as never)).toEqual({ ok: true })
})

test('a namespace can carry configuration too', () => {
  const group = { name: 'db', description: 'Database.', cmds: [], meta: { cli: { positionals: [] } } }
  expect(cliMeta(group)).toEqual({ positionals: [] })
})
