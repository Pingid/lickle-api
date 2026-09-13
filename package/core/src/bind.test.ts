import { expect, test } from 'vitest'
import { InputError, bind, oneOf } from './bind.ts'
import { bool, choice, field, list, num, optional, string } from './cons.ts'
import { shapeOf } from './standard.ts'
import type { Policy } from './bind.ts'

/** A policy that substitutes the way a command line does. */
const cli: Policy = {
  fallback: (f) => {
    const shape = shapeOf(f.type)
    return shape.list ? [] : shape.type === 'boolean' ? false : undefined
  },
}

const inputs = {
  title: field({ description: 'What to do.', type: string }),
  tag: field({ description: 'Tags.', type: list(string) }),
  done: field({ description: 'Done?', type: bool }),
  note: field({ description: 'A note.', type: optional(string) }),
  n: field({ description: 'How many.', type: num, default: 3 }),
}

test('supplied values pass through; defaults fill in', async () => {
  expect(await bind(inputs, { title: 'x', tag: ['a'], done: true })).toEqual({
    title: 'x',
    tag: ['a'],
    done: true,
    n: 3,
  })
})

test('an optional input with nothing supplied is simply absent', async () => {
  expect('note' in (await bind(inputs, { title: 'x', tag: [], done: false }))).toBe(false)
})

test('a missing required input throws, with the policy’s wording', async () => {
  await expect(bind(inputs, {})).rejects.toThrow(InputError)
  await expect(bind(inputs, {})).rejects.toThrow("missing required input 'title'")
  await expect(bind(inputs, {}, { missing: (_f, key) => `missing required option '--${key}'` })).rejects.toThrow(
    "missing required option '--title'",
  )
})

test('a fallback makes an input not required — the command line’s rule', async () => {
  expect(await bind(inputs, { title: 'x' }, cli)).toEqual({ title: 'x', tag: [], done: false, n: 3 })
})

test('a declared default wins over a fallback', async () => {
  const withDefault = { tag: field({ description: 'Tags.', type: list(string), default: ['a'] }) }
  expect(await bind(withDefault, {}, cli)).toEqual({ tag: ['a'] })
})

// The type validates itself now, so both wires get the same coercion: a command
// line hands it '42' and a tool call hands it 42.
test('every core type coerces to what it declares', async () => {
  const typed = {
    n: field({ description: 'n', type: num }),
    b: field({ description: 'b', type: bool }),
    s: field({ description: 's', type: string }),
  }
  expect(await bind(typed, { n: '42', b: 'yes', s: 'x' })).toEqual({ n: 42, b: true, s: 'x' })
  expect(await bind(typed, { n: 42, b: true, s: 7 })).toEqual({ n: 42, b: true, s: '7' })
})

test('what cannot be coerced is rejected, naming the key', async () => {
  const typed = { n: field({ description: 'n', type: num }) }
  await expect(bind(typed, { n: 'lots' })).rejects.toThrow("invalid value for 'n': 'lots' (expected a number)")
  await expect(bind(typed, { n: {} })).rejects.toThrow("invalid value for 'n': {} (expected a number)")
})

test('a list still demands a real array', async () => {
  await expect(bind(inputs, { title: 'x', tag: 'a' })).rejects.toThrow(
    "invalid value for 'tag': 'a' (expected an array)",
  )
})

test('choices are checked after coercion, per element for a list', async () => {
  const mode = { mode: field({ description: 'How.', type: choice(['fast', 'safe']) }) }
  expect(await bind(mode, { mode: 'fast' })).toEqual({ mode: 'fast' })
  await expect(bind(mode, { mode: 'sloppy' })).rejects.toThrow(
    "invalid value for 'mode': 'sloppy' (expected 'fast' or 'safe')",
  )

  const level = { level: field({ description: 'Level.', type: choice([1, 2, 3]) }) }
  expect(await bind(level, { level: '2' })).toEqual({ level: 2 })
  await expect(bind(level, { level: 9 })).rejects.toThrow("invalid value for 'level': 9 (expected 1, 2 or 3)")

  const tags = { tag: field({ description: 'Tags.', type: list(choice(['a', 'b'])) }) }
  await expect(bind(tags, { tag: ['a', 'z'] })).rejects.toThrow("invalid value for 'tag[1]': 'z'")
})

test('oneOf reads as a sentence tail', () => {
  expect(oneOf(['a'])).toBe("'a'")
  expect(oneOf(['a', 'b'])).toBe("'a' or 'b'")
  expect(oneOf(['a', 'b', 'c'])).toBe("'a', 'b' or 'c'")
  expect(oneOf([1, 2])).toBe('1 or 2')
})
