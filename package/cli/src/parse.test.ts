import { expect, test } from 'vitest'
import { parseArgs } from './parse.ts'
import { bool, build, field, list, num, optional, string, type Spec } from './spec.ts'

const mk = (inputs: Record<string, unknown>, positionals?: string[]): Spec => ({
  name: 'test',
  description: 'a test command',
  inputs: inputs as Spec['inputs'],
  ...(positionals === undefined ? {} : { positionals }),
})

test('long flags take a value by space or by =', () => {
  const spec = mk({ name: field({ d: 'name', kind: string }) })
  expect(parseArgs(spec, ['--name', 'ada']).inputs).toEqual({ name: 'ada' })
  expect(parseArgs(spec, ['--name=ada']).inputs).toEqual({ name: 'ada' })
})

test('nums are coerced and rejected when not numeric', () => {
  const spec = mk({ count: field({ d: 'count', kind: num }) })
  expect(parseArgs(spec, ['--count', '42']).inputs).toEqual({ count: 42 })
  expect(() => parseArgs(spec, ['--count', 'lots'])).toThrow(/expects a number/)
})

test('bools take no value and can be negated', () => {
  const spec = mk({ force: field({ d: 'force', kind: bool }) })
  expect(parseArgs(spec, []).inputs).toEqual({ force: false })
  expect(parseArgs(spec, ['--force']).inputs).toEqual({ force: true })
  expect(parseArgs(spec, ['--force=false']).inputs).toEqual({ force: false })
  expect(parseArgs(spec, ['--force', '--no-force']).inputs).toEqual({ force: false })
})

test('aliases resolve, and short bool flags group', () => {
  const spec = mk({
    force: field({ d: 'force', kind: bool, alias: ['f'] }),
    verbose: field({ d: 'verbose', kind: bool, alias: ['v'] }),
    count: field({ d: 'count', kind: num, alias: ['n', 'total'] }),
  })
  expect(parseArgs(spec, ['-fv', '-n', '3']).inputs).toEqual({ force: true, verbose: true, count: 3 })
  expect(parseArgs(spec, ['-fn5']).inputs).toEqual({ force: true, verbose: false, count: 5 })
  expect(parseArgs(spec, ['-n=5']).inputs).toEqual({ force: false, verbose: false, count: 5 })
  expect(parseArgs(spec, ['--total', '7']).inputs['count']).toBe(7)
})

test('lists repeat and default to empty', () => {
  const spec = mk({ tag: field({ d: 'tag', kind: list(string), alias: ['t'] }) })
  expect(parseArgs(spec, []).inputs).toEqual({ tag: [] })
  expect(parseArgs(spec, ['--tag', 'a', '-t', 'b', '--tag=c']).inputs).toEqual({ tag: ['a', 'b', 'c'] })
})

test('optional inputs are left unset, defaults are applied', () => {
  const spec = mk({
    note: field({ d: 'note', kind: optional(string) }),
    count: field({ d: 'count', kind: num, default: 10 }),
  })
  const { inputs } = parseArgs(spec, [])
  expect(inputs).toEqual({ count: 10 })
  expect('note' in inputs).toBe(false)
})

test('positionals bind in order, with a variadic list last', () => {
  const spec = mk(
    {
      name: field({ d: 'name', kind: string }),
      rest: field({ d: 'rest', kind: list(string) }),
    },
    ['name', 'rest'],
  )
  expect(parseArgs(spec, ['ada', 'x', 'y']).inputs).toEqual({ name: 'ada', rest: ['x', 'y'] })
  expect(parseArgs(spec, ['ada']).inputs).toEqual({ name: 'ada', rest: [] })
})

test('-- ends flag parsing', () => {
  const spec = mk({ name: field({ d: 'name', kind: string }) }, ['name'])
  expect(parseArgs(spec, ['--', '--not-a-flag']).inputs).toEqual({ name: '--not-a-flag' })
})

test('usage mistakes are reported', () => {
  const spec = mk({ name: field({ d: 'name', kind: string }) }, ['name'])
  expect(() => parseArgs(spec, ['--bogus'])).toThrow(/unknown option '--bogus'/)
  expect(() => parseArgs(spec, ['--name'])).toThrow(/requires a value/)
  expect(() => parseArgs(spec, [])).toThrow(/missing required argument '<name>'/)
  expect(() => parseArgs(spec, ['a', 'b'])).toThrow(/unexpected argument 'b'/)
  expect(() => parseArgs(spec, ['--name', 'a', 'b'])).toThrow(/both as an option and as an argument/)
  expect(() => parseArgs(mk({ name: field({ d: 'name', kind: string }) }), [])).toThrow(
    /missing required option '--name'/,
  )
})

test('--help skips validation of required inputs', () => {
  const spec = mk({ name: field({ d: 'name', kind: string }) })
  expect(parseArgs(spec, ['--help']).help).toBe(true)
  expect(parseArgs(spec, ['-h']).help).toBe(true)
})

test('--output selects the format and rejects anything else', () => {
  const spec = mk({})
  expect(parseArgs(spec, []).output).toBe('text')
  expect(parseArgs(spec, ['--output', 'json']).output).toBe('json')
  expect(parseArgs(spec, ['--output=json']).output).toBe('json')
  expect(parseArgs(spec, ['-o', 'json']).output).toBe('json')
  expect(parseArgs(spec, ['-ojson']).output).toBe('json')
  expect(() => parseArgs(spec, ['-o', 'yaml'])).toThrow(/expected 'text' or 'json'/)
})

test('specs may not shadow the reserved flags', () => {
  expect(() => parseArgs(mk({ output: field({ d: 'out', kind: string }) }), [])).toThrow(/reserved flag name 'output'/)
  expect(() => parseArgs(mk({ host: field({ d: 'host', kind: string, alias: ['h'] }) }), [])).toThrow(
    /reserved flag name 'h'/,
  )
})

test('a spec built with the builder parses', () => {
  const spec = build('greet')
    .description('Greet someone.')
    .inputs({ name: field({ d: 'Who to greet.', kind: string }) })
    .positionals(['name'])
    .spec()

  expect(parseArgs(spec, ['ada']).inputs).toEqual({ name: 'ada' })
})
