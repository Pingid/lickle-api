import { expect, test } from 'vitest'
import { InputError, bind, oneOf } from './bind.ts'
import { choice, bool, field, list, num, optional, string } from './cons.ts'
import { isList } from './kind.ts'
import type { Policy } from './bind.ts'

/** A policy that takes values as given — what a JSON-shaped target does. */
const asGiven: Policy = { coerce: (_f, raw) => raw }

/** A policy that substitutes the way a command line does. */
const cli: Policy = {
  ...asGiven,
  fallback: (f) => (isList(f.type) ? [] : f.type.kind === 'bool' ? false : undefined),
}

const inputs = {
  title: field({ description: 'What to do.', type: string }),
  tag: field({ description: 'Tags.', type: list(string) }),
  done: field({ description: 'Done?', type: bool }),
  note: field({ description: 'A note.', type: optional(string) }),
  n: field({ description: 'How many.', type: num, default: 3 }),
}

test('supplied values pass through; defaults fill in', () => {
  expect(bind(inputs, { title: 'x', tag: ['a'], done: true }, asGiven)).toEqual({
    title: 'x',
    tag: ['a'],
    done: true,
    n: 3,
  })
})

test('an optional input with nothing supplied is simply absent', () => {
  expect('note' in bind(inputs, { title: 'x', tag: [], done: false }, asGiven)).toBe(false)
})

test('a missing required input throws, with the policy’s wording', () => {
  expect(() => bind(inputs, {}, asGiven)).toThrow(InputError)
  expect(() => bind(inputs, {}, asGiven)).toThrow("missing required input 'title'")
  expect(() => bind(inputs, {}, { ...asGiven, missing: (_f, key) => `missing required option '--${key}'` })).toThrow(
    "missing required option '--title'",
  )
})

test('a fallback makes an input not required — the command line’s rule', () => {
  expect(bind(inputs, { title: 'x' }, cli)).toEqual({ title: 'x', tag: [], done: false, n: 3 })
})

test('a declared default wins over a fallback', () => {
  const withDefault = { tag: field({ description: 'Tags.', type: list(string), default: ['a'] }) }
  expect(bind(withDefault, {}, cli)).toEqual({ tag: ['a'] })
})

test('values are checked after coercion, per element for a list', () => {
  const mode = { mode: field({ description: 'How.', type: choice(['fast', 'safe']) }) }
  expect(bind(mode, { mode: 'fast' }, asGiven)).toEqual({ mode: 'fast' })
  expect(() => bind(mode, { mode: 'sloppy' }, asGiven)).toThrow(
    "invalid value for 'mode': 'sloppy' (expected 'fast' or 'safe')",
  )

  const tags = { tag: field({ description: 'Tags.', type: list(choice(['a', 'b'])) }) }
  expect(() => bind(tags, { tag: ['a', 'z'] }, asGiven)).toThrow("invalid value for 'tag[1]': 'z'")
})

test('coercion errors surface from the policy', () => {
  const strict: Policy = {
    coerce: (_f, raw, key) => {
      if (typeof raw !== 'string') throw new InputError(`'${key}' expects a string`)
      return raw
    },
  }
  expect(() => bind(inputs, { title: 1 }, strict)).toThrow("'title' expects a string")
})

test('oneOf reads as a sentence tail', () => {
  expect(oneOf(['a'])).toBe("'a'")
  expect(oneOf(['a', 'b'])).toBe("'a' or 'b'")
  expect(oneOf(['a', 'b', 'c'])).toBe("'a', 'b' or 'c'")
  expect(oneOf([1, 2])).toBe('1 or 2')
})
