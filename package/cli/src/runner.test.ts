import { expect, test } from 'vitest'
import { EXIT, run } from './runner.ts'
import { cmd, field, list, num, string, type Namespace } from './index.ts'

const greet = cmd(
  {
    name: 'greet',
    description: 'Greet someone.',
    inputs: {
      name: field({ description: 'Who to greet.', type: string }),
      times: field({ description: 'How often.', type: num, alias: ['n'], default: 1 }),
    },
    outputs: {
      message: field({ description: 'The greeting.', type: string }),
      lines: field({ description: 'Each line.', type: list(string) }),
    },
    meta: { cli: { positionals: ['name'] } },
  },
  (i: { name: string; times: number }) => ({
    message: `hello ${i.name}`,
    lines: Array.from({ length: i.times }, () => `hello ${i.name}`),
  }),
)

const later = cmd({ name: 'later', description: 'Resolves async.' }, async () => ({ ok: true }) as never)

const boom = cmd({ name: 'boom', description: 'Always fails.' }, () => {
  throw new Error('the database is on fire')
})

const cmds: Namespace = {
  name: 'app',
  description: 'Demo CLI.',
  cmds: [{ name: 'say', description: 'Speech commands.', cmds: [greet] }, later, boom],
}

const invoke = async (argv: string[]) => {
  let out = ''
  let err = ''
  const code = await run(cmds, argv, { stdout: (s) => (out += s), stderr: (s) => (err += s) })
  return { code, out, err }
}

test('runs a nested command and prints text output', async () => {
  const { code, out, err } = await invoke(['say', 'greet', 'ada', '-n', '2'])
  expect(code).toBe(EXIT.ok)
  expect(err).toBe('')
  expect(out).toBe('message: hello ada\nlines:\n  - hello ada\n  - hello ada\n')
})

test('--output json prints parseable JSON', async () => {
  const { code, out } = await invoke(['say', 'greet', 'ada', '--output', 'json'])
  expect(code).toBe(EXIT.ok)
  expect(JSON.parse(out)).toEqual({ message: 'hello ada', lines: ['hello ada'] })
})

test('awaits an async command', async () => {
  const { code, out } = await invoke(['later', '-o', 'json'])
  expect(code).toBe(EXIT.ok)
  expect(JSON.parse(out)).toEqual({ ok: true })
})

test('--help prints command help to stdout and succeeds', async () => {
  const { code, out, err } = await invoke(['say', 'greet', '--help'])
  expect(code).toBe(EXIT.ok)
  expect(err).toBe('')
  expect(out).toContain('Usage: app say greet [options] <name>')
})

test('--help on a group works at every level', async () => {
  expect((await invoke(['--help'])).out).toContain('Usage: app <command> [options]')
  expect((await invoke(['say', '--help'])).out).toContain('Usage: app say <command> [options]')
})

test('naming no command prints group help to stderr as a usage error', async () => {
  const { code, out, err } = await invoke([])
  expect(code).toBe(EXIT.usage)
  expect(out).toBe('')
  expect(err).toContain('Usage: app <command> [options]')
})

test('an unknown command is a usage error with a help hint', async () => {
  const { code, err } = await invoke(['say', 'shout'])
  expect(code).toBe(EXIT.usage)
  expect(err).toBe("error: unknown command 'shout'\nTry 'app say --help' for more information.\n")
})

test('a bad invocation names the command in its hint', async () => {
  const { code, err } = await invoke(['say', 'greet'])
  expect(code).toBe(EXIT.usage)
  expect(err).toBe("error: missing required argument '<name>'\nTry 'app say greet --help' for more information.\n")
})

test('a command that throws exits 1 with its message on stderr', async () => {
  const { code, out, err } = await invoke(['boom'])
  expect(code).toBe(EXIT.failed)
  expect(out).toBe('')
  expect(err).toBe('error: the database is on fire\n')
})

test('errors honour --output json', async () => {
  const { code, err } = await invoke(['boom', '-o', 'json'])
  expect(code).toBe(EXIT.failed)
  expect(JSON.parse(err)).toEqual({ error: { message: 'the database is on fire' } })
})

test('usage errors honour --output json, even when parsing never finishes', async () => {
  // The format has to be read before the failure, not from a successful parse.
  for (const argv of [
    ['say', 'greet', '-o', 'json'], // missing a required input
    ['say', 'greet', '--bogus', '--output=json'], // unknown option
    ['nope', '-ojson'], // unknown command, before any spec is in hand
  ]) {
    const { code, err } = await invoke(argv)
    expect(code).toBe(EXIT.usage)
    expect(() => JSON.parse(err)).not.toThrow()
    expect(JSON.parse(err).error.message).toBeTypeOf('string')
  }
})

test('the program name comes from opts, then the root group', async () => {
  let out = ''
  await run(cmds, ['--help'], { name: 'other', stdout: (s) => (out += s), stderr: () => {} })
  expect(out).toContain('Usage: other <command> [options]')

  let bare = ''
  await run({ name: 'cli', cmds: [boom] }, ['--help'], { stdout: (s) => (bare += s), stderr: () => {} })
  expect(bare).toContain('Usage: cli <command> [options]')
})
