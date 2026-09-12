import { execFileSync } from 'node:child_process'
import { expect, test } from 'vitest'
import { SHELLS, completion, isShell, withCompletions } from './complete.ts'
import { bool, cmd, field, list, string, type SubCmds } from './spec.ts'

const migrate = cmd(
  {
    name: 'migrate',
    description: "Apply the database's pending migrations.",
    inputs: {
      target: field({ d: 'Migration to stop at.', kind: string }),
      tag: field({ d: "Only migrations you've tagged.", kind: list(string), alias: ['t'] }),
      mode: field({ d: 'How to apply them.', kind: string, values: ['fast', 'safe'], alias: ['m'] }),
      dry: field({ d: 'Do not write anything.', kind: bool, alias: ['d'] }),
    },
    positionals: ['target'],
  },
  () => {},
)

const seed = cmd({ name: 'seed', description: 'Seed the database.' }, () => {})
const version = cmd({ name: 'version', description: 'Print the version.' }, () => {})

const cmds: SubCmds = withCompletions({
  name: 'app',
  description: 'Demo CLI.',
  cmds: [{ name: 'db', description: 'Database commands.', cmds: [migrate, seed] }, { cmds: [version] }],
})

test('isShell narrows the supported targets', () => {
  expect(SHELLS).toEqual(['bash', 'zsh', 'fish'])
  expect(isShell('bash')).toBe(true)
  expect(isShell('nushell')).toBe(false)
})

test('every shell gets the whole tree and all flag spellings', () => {
  for (const shell of SHELLS) {
    const script = completion(cmds, shell)
    for (const fragment of ['db', 'migrate', 'seed', 'version', 'completions', 'tag', 'mode', 'dry', 'output'])
      expect(script, `${shell} is missing ${fragment}`).toContain(fragment)
  }
})

test('descriptions containing a quote are escaped, not left to break the script', () => {
  // "Apply the database's pending migrations." would otherwise close the quote.
  expect(completion(cmds, 'bash')).not.toContain("database's")
  expect(completion(cmds, 'zsh')).toContain("database'\\''s")
  expect(completion(cmds, 'fish')).toContain("database\\'s")
})

test('the program name comes from opts, then the root group', () => {
  expect(completion(cmds, 'bash')).toContain('complete -F _app_complete app')
  expect(completion(cmds, 'bash', { name: 'other' })).toContain('complete -F _other_complete other')
  expect(completion({ cmds: [version] }, 'fish')).toContain('complete -c cli ')
})

test('zsh marks value-taking flags and repeats list flags', () => {
  const script = completion(cmds, 'zsh')
  expect(script).toContain("'*-t[Only migrations you'\\''ve tagged.]:tag:'") // list: repeatable
  expect(script).toContain("'-m[How to apply them.]:mode:(fast safe)'") // fixed values
  expect(script).toContain("'-d[Do not write anything.]'") // bool: no argument
})

test("fish stops offering a group's commands once the line descends past it", () => {
  const script = completion(cmds, 'fish')
  expect(script).toContain("'__fish_seen_subcommand_from db; and not __fish_seen_subcommand_from migrate seed'")
})

test('a positional with values is completable', () => {
  // `app completions <TAB>` should offer the shells.
  expect(completion(cmds, 'bash')).toContain("'completions') opts='bash zsh fish")
  expect(completion(cmds, 'zsh')).toContain("'1: :(bash zsh fish)'")
  expect(completion(cmds, 'fish')).toContain("-a 'bash zsh fish'")
})

// ---------------- bash, driven for real --------------------------

/**
 * Source the generated script, place the cursor as the shell would, and report
 * what bash actually offers. Only bash is available here, so it is the one
 * target verified by execution rather than by reading the generated text.
 */
const complete = (line: string[], cur = ''): string[] => {
  const script = completion(cmds, 'bash')
  const words = [...line, cur]
  const driver = `
${script}
COMP_WORDS=(${words.map((w) => `'${w.replace(/'/g, `'\\''`)}'`).join(' ')})
COMP_CWORD=${words.length - 1}
_app_complete
printf '%s\\n' "\${COMPREPLY[@]}"
`
  return execFileSync('bash', ['-c', driver], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
}

test('the bash script parses', () => {
  execFileSync('bash', ['-n'], { input: completion(cmds, 'bash') })
})

test('bash completes commands at the root', () => {
  expect(complete(['app'])).toEqual(expect.arrayContaining(['db', 'version', 'completions']))
})

test('bash completes commands inside a nested group', () => {
  const got = complete(['app', 'db'])
  expect(got).toEqual(expect.arrayContaining(['migrate', 'seed']))
  expect(got).not.toContain('db')
})

test('bash completes flags of the resolved command', () => {
  expect(complete(['app', 'db', 'migrate'], '--')).toEqual(
    expect.arrayContaining(['--tag', '--mode', '--dry', '--help', '--output']),
  )
})

test("bash completes a flag's fixed values, spaced or with =", () => {
  expect(complete(['app', 'db', 'migrate', '--mode'])).toEqual(['fast', 'safe'])
  expect(complete(['app', 'db', 'migrate', '-m'])).toEqual(['fast', 'safe'])
  expect(complete(['app', 'db', 'migrate'], '--mode=s')).toEqual(['safe'])
  expect(complete(['app'], '--output=')).toEqual(['text', 'json'])
})

test('bash completes a positional with values', () => {
  expect(complete(['app', 'completions'])).toEqual(expect.arrayContaining(['bash', 'zsh', 'fish']))
})

test('bash offers nothing once a word names no command', () => {
  expect(complete(['app', 'nope'])).toEqual([])
  expect(complete(['app', 'db', 'nope'])).toEqual([])
})

test("bash keeps completing past a command's own arguments", () => {
  // `v3` is migrate's positional, not a mistyped subcommand.
  expect(complete(['app', 'db', 'migrate', 'v3'], '--')).toEqual(expect.arrayContaining(['--tag', '--mode', '--dry']))
})

test('bash does not mistake a flag value for a command', () => {
  expect(complete(['app', '--output', 'json'])).toEqual(expect.arrayContaining(['db', 'version']))
  expect(complete(['app', '--output=json'])).toEqual(expect.arrayContaining(['db', 'version']))
})
