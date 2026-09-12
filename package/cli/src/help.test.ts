import { expect, test } from 'vitest'
import { cmdHelp, groupHelp } from './help.ts'
import { bool, cmd, field, list, num, optional, string, type Spec, type SubCmds } from './spec.ts'

const migrate: Spec = {
  name: 'migrate',
  description: 'Apply pending migrations.',
  inputs: {
    target: field({ d: 'Migration to stop at.', kind: string }),
    tag: field({ d: 'Only these tags.', kind: list(string), alias: ['t'] }),
    note: field({ d: 'Note to record.', kind: optional(string) }),
    steps: field({ d: 'How many to apply.', kind: num, alias: ['n'], default: 1 }),
    dry: field({ d: 'Do not write anything.', kind: bool, alias: ['d'] }),
  },
  outputs: { applied: field({ d: 'How many ran.', kind: num }) },
  positionals: ['target'],
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
  const spec: Spec = {
    name: 'copy',
    description: 'Copy things.',
    inputs: {
      src: field({ d: 'Source.', kind: string }),
      dest: field({ d: 'Destination.', kind: optional(string) }),
      extra: field({ d: 'Extra.', kind: list(string) }),
    },
    positionals: ['src', 'dest', 'extra'],
  }
  expect(cmdHelp(spec, ['app', 'copy'])).toContain('Usage: app copy [options] <src> [dest] [extra...]')
})

test('required options are marked', () => {
  expect(cmdHelp({ ...migrate, positionals: [] }, ['app'])).toContain(
    '      --target <string>     Migration to stop at. (required)',
  )
})

test('group help lists commands and flattens unnamed groups', () => {
  const seed = cmd({ name: 'seed', description: 'Seed the database.' }, () => {})
  const status = cmd({ name: 'status', description: 'Show status.' }, () => {})
  const group: SubCmds = {
    name: 'app',
    description: 'Demo CLI.',
    cmds: [{ name: 'db', description: 'Database commands.', cmds: [seed] }, { cmds: [status] }],
  }

  expect(groupHelp(group, ['app'])).toBe(
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
