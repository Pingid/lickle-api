import { expect, test } from 'vitest'
import { cli, cliMeta, positionalsOf } from './meta.ts'
import { field, string } from '@lickle/cmd-core'

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
