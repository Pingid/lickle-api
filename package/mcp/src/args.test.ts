import { expect, test } from 'vitest'
import { choice, bool, field, list, num, optional, op as makeOp, string } from '@lickle/api'
import { InputError } from '@lickle/api'
import { bindArgs } from './args.ts'

const spec = makeOp({
  name: 'x',
  description: 'x',
  inputs: {
    who: field({ description: 'Who.', type: string }),
    count: field({ description: 'How many.', type: num }),
    flag: field({ description: 'A flag.', type: bool }),
    tags: field({ description: 'Tags.', type: list(string) }),
    mode: field({ description: 'Mode.', type: choice(['fast', 'safe']), default: 'safe' }),
    note: field({ description: 'A note.', type: optional(string) }),
  },
})

const valid = { who: 'ada', count: 2, flag: true, tags: ['a'] }

test('valid arguments pass through, with defaults applied', async () => {
  expect(await bindArgs(spec, valid)).toEqual({ ...valid, mode: 'safe' })
})

test('an optional left out stays out rather than becoming undefined', async () => {
  expect('note' in (await bindArgs(spec, valid))).toBe(false)
})

test('a missing required argument is rejected', async () => {
  await expect(bindArgs(spec, { count: 2, flag: true, tags: [] })).rejects.toThrow(/missing required argument 'who'/)
  await expect(bindArgs(spec, valid)).resolves.toBeDefined()
})

// A field's type is a Standard Schema and validates itself, so one validator
// serves both wires: a command line hands it '2' and a tool call hands it 2.
// The cost is that a model sending a stringly-typed number is accommodated
// rather than corrected.
test('values are coerced to what the type declares', async () => {
  expect(await bindArgs(spec, { ...valid, count: '2' })).toMatchObject({ count: 2 })
  expect(await bindArgs(spec, { ...valid, flag: 'true' })).toMatchObject({ flag: true })
  expect(await bindArgs(spec, { ...valid, who: 5 })).toMatchObject({ who: '5' })
})

test('what cannot be coerced is still rejected', async () => {
  await expect(bindArgs(spec, { ...valid, count: 'lots' })).rejects.toThrow(
    /invalid value for 'count': 'lots' \(expected a number\)/,
  )
  await expect(bindArgs(spec, { ...valid, who: {} })).rejects.toThrow(
    /invalid value for 'who': \{\} \(expected a string\)/,
  )
})

test('list items are checked individually, and reported by index', async () => {
  // An array is still demanded: the command line builds one from repeated flags
  // before validating, so nothing needs the leniency here.
  await expect(bindArgs(spec, { ...valid, tags: 'a' })).rejects.toThrow(
    /invalid value for 'tags': 'a' \(expected an array\)/,
  )
  await expect(bindArgs(spec, { ...valid, tags: ['a', {}] })).rejects.toThrow(
    /invalid value for 'tags\[1\]': \{\} \(expected a string\)/,
  )
})

test('a value outside the declared set is rejected', async () => {
  await expect(bindArgs(spec, { ...valid, mode: 'sloppy' })).rejects.toThrow(
    /invalid value for 'mode': 'sloppy' \(expected 'fast' or 'safe'\)/,
  )
})

test('unknown arguments are rejected, naming what was expected', async () => {
  await expect(bindArgs(spec, { ...valid, nope: 1 })).rejects.toThrow(
    /unknown argument 'nope'; expected 'who', 'count'/,
  )
})

test('null is treated as absent, so a default still applies', async () => {
  expect((await bindArgs(spec, { ...valid, mode: null }))['mode']).toBe('safe')
})

test('a non-finite number is rejected', async () => {
  await expect(bindArgs(spec, { ...valid, count: Number.NaN })).rejects.toThrow(
    /invalid value for 'count': NaN \(expected a number\)/,
  )
})

test('rejections are InputError, which the server turns into a tool result', async () => {
  await expect(bindArgs(spec, {})).rejects.toThrow(InputError)
})

test('a spec with no inputs accepts nothing', async () => {
  const bare = makeOp({ name: 'b', description: 'b' })
  expect(await bindArgs(bare, {})).toEqual({})
  await expect(bindArgs(bare, { a: 1 })).rejects.toThrow(/expected no arguments/)
})
