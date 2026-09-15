import { InputError, t, type Api } from '@lickle/api'
import { expect, test } from 'vitest'

import * as c from '../index.ts'
import { CliError } from './errors.ts'
import { EXIT, run } from './run.ts'

const greet = t
  .op({
    name: 'greet',
    description: 'Greet someone.',
    in: { name: t.string('Who to greet.'), loud: t.boolean('Shout it.').meta('cli', { short: 'l' }) },
    out: t.object({ message: t.string('The greeting.') }),
    handle: async (i) => ({ message: i.loud ? `HELLO ${i.name.toUpperCase()}` : `hello ${i.name}` }),
  })
  .meta('cli', { positionals: ['name'] })

const count = t.op({
  name: 'count',
  description: 'Count up.',
  in: { to: t.number('How high.').default(2) },
  out: t.output(t.string(), 'async-iter'),
  handle: async function* (i) {
    for (let n = 1; n <= i.to; n++) yield `tick ${n}`
  },
})

const boom = t.op({
  name: 'boom',
  description: 'Always fails.',
  handle: async () => {
    throw new Error('the database is on fire')
  },
})

const refuse = t.op({
  name: 'refuse',
  description: 'Blames the caller.',
  handle: async () => {
    throw new CliError('that task is already done')
  },
})

const app = t.ns({
  name: 'app',
  description: 'Demo CLI.',
  operations: [t.ns({ name: 'say', description: 'Speech commands.', operations: [greet] }), count, boom, refuse],
})

const invoke = async (argv: string[], program: Api.Program = app) => {
  let out = ''
  let err = ''
  const code = await run(program, argv, {
    stdout: (s) => (out += s),
    stderr: (s) => (err += s),
  })
  return { code, out, err }
}

test('resolves a command through its namespaces and prints what it returns', async () => {
  expect(await invoke(['say', 'greet', 'dan'])).toEqual({ code: EXIT.ok, out: 'message: hello dan\n', err: '' })
  expect((await invoke(['say', 'greet', 'dan', '-l'])).out).toBe('message: HELLO DAN\n')
})

test('prints a stream as it arrives', async () => {
  expect((await invoke(['count'])).out).toBe('tick 1\ntick 2\n')
  expect((await invoke(['count', '--to', '1', '-o', 'json'])).out).toBe('"tick 1"\n')
})

test('help goes to stdout and succeeds', async () => {
  const { code, out, err } = await invoke(['say', 'greet', '--help'])
  expect(code).toBe(EXIT.ok)
  expect(err).toBe('')
  expect(out).toContain('Usage: app say greet [options] <name>')
})

test('landing on a namespace prints its help, but as a usage error', async () => {
  const { code, out, err } = await invoke(['say'])
  expect(code).toBe(EXIT.usage)
  expect(out).toBe('')
  expect(err).toContain('Usage: app say <command> [options]')
})

test('a command that throws exits 1; one that blames the caller exits 2', async () => {
  const failed = await invoke(['boom'])
  expect(failed.code).toBe(EXIT.failed)
  expect(failed.err).toBe('error: the database is on fire\n')

  const refused = await invoke(['refuse'])
  expect(refused.code).toBe(EXIT.usage)
  expect(refused.err).toContain('error: that task is already done')
  expect(refused.err).toContain(`Try 'app refuse --help' for more information.`)
})

test('a wrong invocation names the path it got to', async () => {
  expect((await invoke(['nope'])).err).toContain(`unknown command 'nope'`)
  expect((await invoke(['nope'])).err).toContain(`Try 'app --help'`)
  expect((await invoke(['say', 'greet'])).err).toContain(`missing required argument '<name>'`)
  expect((await invoke(['say', 'greet'])).err).toContain(`Try 'app say greet --help'`)
})

test('a failure before parsing is still reported in the format asked for', async () => {
  const { code, err } = await invoke(['nope', '--output', 'json'])
  expect(code).toBe(EXIT.usage)
  expect(JSON.parse(err)).toEqual({ error: { message: `unknown command 'nope'` } })
})

test('an operation can be the whole program', async () => {
  const { code, out } = await invoke(['dan'], greet)
  expect(code).toBe(EXIT.ok)
  expect(out).toBe('message: hello dan\n')
})

test('a command written for this target runs like any other', async () => {
  let seen: unknown
  const add = c.cmd({
    name: 'add',
    description: 'Add a task.',
    args: {
      title: { description: 'What to do.', type: c.string() },
      tag: { description: 'Tags.', short: 't', type: c.list() },
    },
    positional: ['title'],
    handle: async (a) => void (seen = a),
  })

  const { code, out } = await invoke(
    ['add', 'buy milk', '-t', 'home'],
    c.cmd(t.ns({ name: 'todo', operations: [add] })),
  )
  expect(code).toBe(EXIT.ok)
  expect(out).toBe('')
  expect(seen).toEqual({ title: 'buy milk', tag: ['home'] })
})

test('a handler can refuse the caller portably, without knowing this target', async () => {
  // `InputError` belongs to no target: an operation written for none of them
  // throws it, and a command line reads it as a usage error rather than a crash.
  const picky = t.op({
    name: 'picky',
    description: 'Refuses portably.',
    handle: async () => {
      throw new InputError('that task is already done')
    },
  })
  const { code, err } = await invoke([], picky)
  expect(code).toBe(EXIT.usage)
  expect(err).toContain('error: that task is already done')
  expect(err).toContain(`Try 'picky --help' for more information.`)
})
