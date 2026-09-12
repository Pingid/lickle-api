import { test, expect } from 'vitest'
import { build, field, string } from './spec.ts'

test('build', () => {
  const b = build('test')
    .description('test')
    .inputs({ name: field({ d: 'name', kind: string }) })
    .outputs({ name: field({ d: 'name', kind: string }) })
    .positionals(['name'])
    .spec()
  expect(b.name).toBe('test')
  expect(b.description).toBe('test')
  expect(b.inputs.name).toEqual({ d: 'name', kind: { type: 'string' } })
  expect(b.outputs.name).toEqual({ d: 'name', kind: { type: 'string' } })
})
