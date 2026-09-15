import { expect, test } from 'vitest'

import { api } from '@lickle/api/util'
import { t } from '@lickle/api'

import * as c from './index.ts'
import { inputsOf } from './core/fields.ts'

const add = c.cmd({
  name: 'add',
  description: 'Add a task.',
  args: {
    title: { description: 'What to do.', type: c.string() },
    tag: { description: 'Tags to file it under.', short: 't', aliases: ['label'], type: c.list() },
    done: { description: 'Mark it done.', short: 'd', type: c.flag() },
    mode: { description: 'How to file it.', type: c.optional(c.choice(['fast', 'safe'])) },
    times: { description: 'How often.', type: c.num() },
  },
  positional: ['title'],
  handle: async () => {},
})

test('a command carries the operation it compiles to', () => {
  const op = api.of(add)
  expect(op.name).toBe('add')
  expect(op.description).toBe('Add a task.')
  expect(Object.keys((op.in as { properties: object }).properties)).toEqual(['title', 'tag', 'done', 'mode', 'times'])
})

test('the operation carries everything the runner reads back off it', () => {
  const { fields, positionals } = inputsOf(api.of(add))
  const by = Object.fromEntries(fields.map((f) => [f.key, f]))
  expect(positionals).toEqual(['title'])
  expect(by['tag']!.names).toEqual(['tag', 't', 'label'])
  expect(by['tag']!.description).toBe('Tags to file it under.')
  expect(by['tag']!.shape).toMatchObject({ type: 'string', list: true })
  expect(by['done']!.shape.type).toBe('boolean')
  expect(by['mode']!.shape).toMatchObject({ values: ['fast', 'safe'], optional: true })
  expect(by['times']!.shape.type).toBe('number')
  expect(by['title']!.required).toBe(true)
})

test('the same handler is what runs', async () => {
  let seen: unknown
  const cmd = c.cmd({
    name: 'x',
    description: 'x',
    args: { a: { type: c.string() } },
    handle: async (args) => void (seen = args),
  })
  await api.of(cmd).handle({ a: 'hello' })
  expect(seen).toEqual({ a: 'hello' })
})

test('an operation or a namespace passes straight through', () => {
  const op = t.op({ name: 'op', description: 'An op.', handle: async () => {} })
  const ns = t.ns({ name: 'ns', description: 'A ns.', operations: [op] })
  expect(c.cmd(op)).toBe(op)
  expect(c.cmd(ns)).toBe(ns)
})

test('a tree mixes commands written for this target with plain operations', () => {
  const op = t.op({ name: 'op', description: 'An op.', handle: async () => {} })
  const tree = t.ns({ name: 'todo', description: 'A tiny task list.', operations: [add, op] })
  expect(tree.operations.map((x) => api.of(x).name)).toEqual(['add', 'op'])
})

test('a handler is typed from the args it declares', () => {
  c.cmd({
    name: 'typed',
    description: 'Typed.',
    args: {
      s: { type: c.string() },
      n: { type: c.num() },
      b: { type: c.flag() },
      l: { type: c.list() },
      ln: { type: c.list(c.num()) },
      ch: { type: c.choice(['fast', 'safe']) },
      op: { type: c.optional(c.string()) },
      oc: { type: c.optional(c.choice(['fast', 'safe'])) },
    },
    handle: async (a) => {
      const s: string = a.s
      const n: number = a.n
      const b: boolean = a.b
      const l: string[] = a.l
      const ln: number[] = a.ln
      const ch: 'fast' | 'safe' = a.ch
      const op: string | undefined = a.op
      const oc: 'fast' | 'safe' | undefined = a.oc
      expect([s, n, b, l, ln, ch, op, oc]).toBeDefined()
    },
  })
})
