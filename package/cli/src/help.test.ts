import { expect, test } from 'vitest'
import { cmdHelp, namespaceHelp } from './help.ts'
import { bool, cmd, field, list, num, optional, string, type Operation, type Namespace } from './index.ts'

const migrate: Operation = {
  name: 'migrate',
  description: 'Apply pending migrations.',
  inputs: {
    target: field({ description: 'Migration to stop at.', type: string }),
    tag: field({ description: 'Only these tags.', type: list(string), alias: ['t'] }),
    note: field({ description: 'Note to record.', type: optional(string) }),
    steps: field({ description: 'How many to apply.', type: num, alias: ['n'], default: 1 }),
    dry: field({ description: 'Do not write anything.', type: bool, alias: ['d'] }),
  },
  outputs: { applied: field({ description: 'How many ran.', type: num }) },
  meta: { cli: { positionals: ['target'] } },
}

test('command help lists usage, arguments, options and outputs', () => {
  expect(cmdHelp(migrate, ['app', 'db', 'migrate'])).toBe(
    [
      'Apply pending migrations.',
      '',
      'Usage: app db migrate [options] <target>',
      '',
      'Arguments:',
      '  <target>  Migration to stop at. (string)',
      '',
      'Options:',
      '  -t, --tag <string...>     Only these tags.',
      '      --note <string>       Note to record.',
      '  -n, --steps <num>         How many to apply. (default: 1)',
      '  -d, --dry                 Do not write anything.',
      '  -h, --help                Show this help.',
      '  -o, --output <text|json>  Output format. (default: text)',
      '',
      'Output:',
      '  applied  How many ran. (num)',
    ].join('\n'),
  )
})

test('optional and variadic positionals use the right usage tokens', () => {
  const spec: Operation = {
    name: 'copy',
    description: 'Copy things.',
    inputs: {
      src: field({ description: 'Source.', type: string }),
      dest: field({ description: 'Destination.', type: optional(string) }),
      extra: field({ description: 'Extra.', type: list(string) }),
    },
    meta: { cli: { positionals: ['src', 'dest', 'extra'] } },
  }
  expect(cmdHelp(spec, ['app', 'copy'])).toContain('Usage: app copy [options] <src> [dest] [extra...]')
})

test('a field with values renders its choices as the placeholder', () => {
  const spec: Operation = {
    name: 'migrate',
    description: 'Migrate.',
    inputs: {
      mode: field({ description: 'How to apply them.', type: string, values: ['fast', 'safe'], alias: ['m'] }),
    },
  }
  expect(cmdHelp(spec, ['app'])).toContain('-m, --mode <fast|safe>    How to apply them. (required)')
  expect(cmdHelp({ ...spec, meta: { cli: { positionals: ['mode'] } } }, ['app'])).toContain(
    '<mode>  How to apply them. (fast|safe)',
  )
})

test('required options are marked', () => {
  expect(cmdHelp({ ...migrate, meta: { cli: { positionals: [] } } }, ['app'])).toContain(
    '      --target <string>     Migration to stop at. (required)',
  )
})

test('group help lists commands and flattens unnamed groups', () => {
  const seed = cmd({ name: 'seed', description: 'Seed the database.' }, () => {})
  const status = cmd({ name: 'status', description: 'Show status.' }, () => {})
  const group: Namespace = {
    name: 'app',
    description: 'Demo CLI.',
    cmds: [{ name: 'db', description: 'Database commands.', cmds: [seed] }, status],
  }

  expect(namespaceHelp(group, ['app'])).toBe(
    [
      'Demo CLI.',
      '',
      'Usage: app <command> [options]',
      '',
      'Commands:',
      '  db      Database commands.',
      '  status  Show status.',
      '',
      'Options:',
      '  -h, --help                Show this help.',
      '  -o, --output <text|json>  Output format. (default: text)',
    ].join('\n'),
  )
})
