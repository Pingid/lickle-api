import { expect, test } from 'vitest'
import { parseArgs, peekFormat } from './parse.ts'
import { choice, bool, build, field, list, num, oneOf, optional, string, type Operation } from './cmd.ts'

const mk = (inputs: Record<string, unknown>, positionals?: string[]): Operation => ({
  name: 'test',
  description: 'a test command',
  inputs: inputs as Operation['inputs'],
  ...(positionals === undefined ? {} : { meta: { cli: { positionals } } }),
})

test('long flags take a value by space or by =', async () => {
  const spec = mk({ name: field({ description: 'name', type: string }) })
  expect((await parseArgs(spec, ['--name', 'ada'])).inputs).toEqual({ name: 'ada' })
  expect((await parseArgs(spec, ['--name=ada'])).inputs).toEqual({ name: 'ada' })
})

test('nums are coerced and rejected when not numeric', async () => {
  const spec = mk({ count: field({ description: 'count', type: num }) })
  expect((await parseArgs(spec, ['--count', '42'])).inputs).toEqual({ count: 42 })
  await expect(parseArgs(spec, ['--count', 'lots'])).rejects.toThrow(
    /invalid value for 'count': 'lots' \(expected a number\)/,
  )
})

test('bools take no value and can be negated', async () => {
  const spec = mk({ force: field({ description: 'force', type: bool }) })
  expect((await parseArgs(spec, [])).inputs).toEqual({ force: false })
  expect((await parseArgs(spec, ['--force'])).inputs).toEqual({ force: true })
  expect((await parseArgs(spec, ['--force=false'])).inputs).toEqual({ force: false })
  expect((await parseArgs(spec, ['--force', '--no-force'])).inputs).toEqual({ force: false })
})

test('aliases resolve, and short bool flags group', async () => {
  const spec = mk({
    force: field({ description: 'force', type: bool, alias: ['f'] }),
    verbose: field({ description: 'verbose', type: bool, alias: ['v'] }),
    count: field({ description: 'count', type: num, alias: ['n', 'total'] }),
  })
  expect((await parseArgs(spec, ['-fv', '-n', '3'])).inputs).toEqual({ force: true, verbose: true, count: 3 })
  expect((await parseArgs(spec, ['-fn5'])).inputs).toEqual({ force: true, verbose: false, count: 5 })
  expect((await parseArgs(spec, ['-n=5'])).inputs).toEqual({ force: false, verbose: false, count: 5 })
  expect((await parseArgs(spec, ['--total', '7'])).inputs['count']).toBe(7)
})

test('lists repeat and default to empty', async () => {
  const spec = mk({ tag: field({ description: 'tag', type: list(string), alias: ['t'] }) })
  expect((await parseArgs(spec, [])).inputs).toEqual({ tag: [] })
  expect((await parseArgs(spec, ['--tag', 'a', '-t', 'b', '--tag=c'])).inputs).toEqual({ tag: ['a', 'b', 'c'] })
})

test('optional inputs are left unset, defaults are applied', async () => {
  const spec = mk({
    note: field({ description: 'note', type: optional(string) }),
    count: field({ description: 'count', type: num, default: 10 }),
  })
  const { inputs } = await parseArgs(spec, [])
  expect(inputs).toEqual({ count: 10 })
  expect('note' in inputs).toBe(false)
})

test('positionals bind in order, with a variadic list last', async () => {
  const spec = mk(
    {
      name: field({ description: 'name', type: string }),
      rest: field({ description: 'rest', type: list(string) }),
    },
    ['name', 'rest'],
  )
  expect((await parseArgs(spec, ['ada', 'x', 'y'])).inputs).toEqual({ name: 'ada', rest: ['x', 'y'] })
  expect((await parseArgs(spec, ['ada'])).inputs).toEqual({ name: 'ada', rest: [] })
})

test('-- ends flag parsing', async () => {
  const spec = mk({ name: field({ description: 'name', type: string }) }, ['name'])
  expect((await parseArgs(spec, ['--', '--not-a-flag'])).inputs).toEqual({ name: '--not-a-flag' })
})

test('usage mistakes are reported', async () => {
  const spec = mk({ name: field({ description: 'name', type: string }) }, ['name'])
  await expect(parseArgs(spec, ['--bogus'])).rejects.toThrow(/unknown option '--bogus'/)
  await expect(parseArgs(spec, ['--name'])).rejects.toThrow(/requires a value/)
  await expect(parseArgs(spec, [])).rejects.toThrow(/missing required argument '<name>'/)
  await expect(parseArgs(spec, ['a', 'b'])).rejects.toThrow(/unexpected argument 'b'/)
  await expect(parseArgs(spec, ['--name', 'a', 'b'])).rejects.toThrow(/both as an option and as an argument/)
  await expect(parseArgs(mk({ name: field({ description: 'name', type: string }) }), [])).rejects.toThrow(
    /missing required option '--name'/,
  )
})

test('--help skips validation of required inputs', async () => {
  const spec = mk({ name: field({ description: 'name', type: string }) })
  expect((await parseArgs(spec, ['--help'])).help).toBe(true)
  expect((await parseArgs(spec, ['-h'])).help).toBe(true)
})

test('--output selects the format and rejects anything else', async () => {
  const spec = mk({})
  expect((await parseArgs(spec, [])).output).toBe('text')
  expect((await parseArgs(spec, ['--output', 'json'])).output).toBe('json')
  expect((await parseArgs(spec, ['--output=json'])).output).toBe('json')
  expect((await parseArgs(spec, ['-o', 'json'])).output).toBe('json')
  expect((await parseArgs(spec, ['-ojson'])).output).toBe('json')
  await expect(parseArgs(spec, ['-o', 'yaml'])).rejects.toThrow(/expected 'text' or 'json'/)
})

test('a field with values accepts only those, as flag or positional', async () => {
  const spec = mk({ mode: field({ description: 'mode', type: choice(['fast', 'safe']) }) })
  expect((await parseArgs(spec, ['--mode', 'fast'])).inputs).toEqual({ mode: 'fast' })
  await expect(parseArgs(spec, ['--mode', 'sloppy'])).rejects.toThrow(
    /invalid value for 'mode': 'sloppy' \(expected 'fast' or 'safe'\)/,
  )

  const positional = mk({ mode: field({ description: 'mode', type: choice(['fast', 'safe']) }) }, ['mode'])
  expect((await parseArgs(positional, ['safe'])).inputs).toEqual({ mode: 'safe' })
  await expect(parseArgs(positional, ['sloppy'])).rejects.toThrow(/invalid value/)
})

test('values are checked for every item of a list', async () => {
  const spec = mk({ tag: field({ description: 'tag', type: list(choice(['a', 'b'])) }) })
  expect((await parseArgs(spec, ['--tag', 'a', '--tag', 'b'])).inputs).toEqual({ tag: ['a', 'b'] })
  await expect(parseArgs(spec, ['--tag', 'a', '--tag', 'z'])).rejects.toThrow(/invalid value/)
})

test('oneOf reads as a sentence', async () => {
  expect(oneOf(['a'])).toBe("'a'")
  expect(oneOf(['a', 'b'])).toBe("'a' or 'b'")
  expect(oneOf(['a', 'b', 'c'])).toBe("'a', 'b' or 'c'")
})

test('peekFormat finds the format without parsing anything else', async () => {
  expect(peekFormat([])).toBe('text')
  expect(peekFormat(['--bogus', '--output', 'json'])).toBe('json')
  expect(peekFormat(['--output=json'])).toBe('json')
  expect(peekFormat(['-o', 'json'])).toBe('json')
  expect(peekFormat(['-ojson'])).toBe('json')
  expect(peekFormat(['-o=json'])).toBe('json')
  expect(peekFormat(['-o', 'yaml'])).toBe('text')
  expect(peekFormat(['--', '-o', 'json'])).toBe('text')
})

test('specs may not shadow the reserved flags', async () => {
  await expect(parseArgs(mk({ output: field({ description: 'out', type: string }) }), [])).rejects.toThrow(
    /reserved flag name 'output'/,
  )
  await expect(parseArgs(mk({ host: field({ description: 'host', type: string, alias: ['h'] }) }), [])).rejects.toThrow(
    /reserved flag name 'h'/,
  )
})

test('a spec built with the builder parses', async () => {
  const spec = build('greet')
    .description('Greet someone.')
    .inputs({ name: field({ description: 'Who to greet.', type: string }) })
    .meta({ cli: { positionals: ['name'] } })
    .op()

  expect((await parseArgs(spec, ['ada'])).inputs).toEqual({ name: 'ada' })
})

// Regression: `peekFormat` used to run its own ad-hoc scanner, so a clustered
// `-vo json` read as `json` to the parser and `text` to the peek — and an error
// raised mid-parse was then reported in the wrong format. Both now run the same
// grammar, so they cannot disagree about what was written.
test('peekFormat agrees with parseArgs on every spelling', async () => {
  const spec = mk({ verbose: field({ description: 'verbose', type: bool, alias: ['v'] }) })

  for (const argv of [
    ['-vo', 'json'],
    ['-o', 'json'],
    ['--output=json'],
    ['-ojson'],
    ['-o=json'],
    ['--verbose', '--output', 'json'],
    ['-v'],
    [],
  ]) {
    expect([argv, peekFormat(argv)]).toEqual([argv, (await parseArgs(spec, argv)).output])
  }
})
