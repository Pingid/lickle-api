import { expect, test } from 'vitest'
import { build, field, string } from './index.ts'

test('build accumulates an operation', () => {
  const b = build('test')
    .description('test')
    .inputs({ name: field({ description: 'name', type: string }) })
    .outputs({ name: field({ description: 'name', type: string }) })
    .op()

  expect(b.name).toBe('test')
  expect(b.description).toBe('test')
  expect(b.inputs.name).toEqual({ description: 'name', type: { kind: 'string' } })
  expect(b.outputs.name).toEqual({ description: 'name', type: { kind: 'string' } })
})

test('build carries adapter meta through untouched', () => {
  const b = build('test')
    .description('test')
    .meta({ cli: { positionals: ['name'] } })
    .op()
  expect(b.meta).toEqual({ cli: { positionals: ['name'] } })
})

test('cmd binds a handler onto the operation', () => {
  const c = build('test')
    .description('test')
    .cmd(() => undefined)
  expect(c.name).toBe('test')
  expect(typeof c.run).toBe('function')
})

// Regression: the builder used to be a Proxy answering every property access
// with a setter, which made it an accidental thenable — awaiting one never
// settled, and it could not be printed or inspected.
test('a builder is not a thenable and prints normally', async () => {
  const b = build('test') as unknown as Record<string, unknown>

  expect(b['then']).toBeUndefined()
  expect(() => String(b)).not.toThrow()

  const settled = await Promise.race([
    Promise.resolve(build('test')).then(() => 'settled'),
    new Promise((r) => setTimeout(() => r('hung'), 100)),
  ])
  expect(settled).toBe('settled')
})
