import { expect, test } from 'vitest'
import { oneOf, parseArgs, peekFormat } from './parse.ts'
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

test('a field with values accepts only those, as flag or positional', () => {
  const spec = mk({ mode: field({ d: 'mode', kind: string, values: ['fast', 'safe'] }) })
  expect(parseArgs(spec, ['--mode', 'fast']).inputs).toEqual({ mode: 'fast' })
  expect(() => parseArgs(spec, ['--mode', 'sloppy'])).toThrow(
    /invalid value for 'mode': 'sloppy' \(expected 'fast' or 'safe'\)/,
  )

  const positional = mk({ mode: field({ d: 'mode', kind: string, values: ['fast', 'safe'] }) }, ['mode'])
  expect(parseArgs(positional, ['safe']).inputs).toEqual({ mode: 'safe' })
  expect(() => parseArgs(positional, ['sloppy'])).toThrow(/invalid value/)
})

test('values are checked for every item of a list', () => {
  const spec = mk({ tag: field({ d: 'tag', kind: list(string), values: ['a', 'b'] }) })
  expect(parseArgs(spec, ['--tag', 'a', '--tag', 'b']).inputs).toEqual({ tag: ['a', 'b'] })
  expect(() => parseArgs(spec, ['--tag', 'a', '--tag', 'z'])).toThrow(/invalid value/)
})

test('oneOf reads as a sentence', () => {
  expect(oneOf(['a'])).toBe("'a'")
  expect(oneOf(['a', 'b'])).toBe("'a' or 'b'")
  expect(oneOf(['a', 'b', 'c'])).toBe("'a', 'b' or 'c'")
})

test('peekFormat finds the format without parsing anything else', () => {
  expect(peekFormat([])).toBe('text')
  expect(peekFormat(['--bogus', '--output', 'json'])).toBe('json')
  expect(peekFormat(['--output=json'])).toBe('json')
  expect(peekFormat(['-o', 'json'])).toBe('json')
  expect(peekFormat(['-ojson'])).toBe('json')
  expect(peekFormat(['-o=json'])).toBe('json')
  expect(peekFormat(['-o', 'yaml'])).toBe('text')
  expect(peekFormat(['--', '-o', 'json'])).toBe('text')
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
