# @lickle/cmd-cli

Run a `@lickle/cmd-core` command spec as a command-line program.

The spec is the single source of truth: it describes the inputs, outputs and
subcommands, and this package derives the argument parsing, the `--help` text
and the printed result from it. Nothing is declared twice.

```sh
pnpm add @lickle/cmd-cli
```

## A whole CLI

```ts
// todo.ts
import { run, spec, type SubCmds } from '@lickle/cmd-cli'

const add = spec.cmd(
  {
    name: 'add',
    description: 'Add a task.',
    inputs: {
      title: spec.field({ d: 'What to do.', kind: spec.string }),
      tag: spec.field({ d: 'Tags to file it under.', kind: spec.list(spec.string), alias: ['t'] }),
      done: spec.field({ d: 'Mark it done immediately.', kind: spec.bool, alias: ['d'] }),
    },
    outputs: {
      id: spec.field({ d: 'The new task id.', kind: spec.num }),
      title: spec.field({ d: 'What it says.', kind: spec.string }),
      tags: spec.field({ d: 'Tags it was filed under.', kind: spec.list(spec.string) }),
    },
    positionals: ['title'],
  },
  (i) => ({ id: 1, title: i.done ? `${i.title} (done)` : i.title, tags: i.tag }),
)

const cmds: SubCmds = { name: 'todo', description: 'A tiny task list.', cmds: [add] }

process.exit(await run(cmds, process.argv.slice(2)))
```

```console
$ todo add 'buy milk' -t home -t errands
id:    1
title: buy milk
tags:
  - home
  - errands
```

## Output: text or json

Every command answers to `--output`/`-o`. Text is the default; `json` prints the
outputs verbatim, for piping into something else.

```console
$ todo add 'buy milk' --output json
{
  "id": 1,
  "title": "buy milk",
  "tags": []
}
```

## Help

`--help`/`-h` works on every command and group, written from the spec:

```console
$ todo add --help
Add a task.

Usage: todo add [options] <title>

Arguments:
  <title>  What to do. (string)

Options:
  -t, --tag <string...>     Tags to file it under.
  -d, --done                Mark it done immediately.
  -h, --help                Show this help.
  -o, --output <text|json>  Output format. (default: text)

Output:
  id     The new task id. (num)
  title  What it says. (string)
  tags   Tags it was filed under. (string[])
```

## Arguments

Inputs become flags. Those named in `positionals` can also be given by position,
in order — only the last may be a `list`, which then takes everything left over.

| Kind                 | On the command line                         | When omitted |
| -------------------- | ------------------------------------------- | ------------ |
| `string`, `num`      | `--title x`, `--title=x`, `-t x`, `-t=x`    | required     |
| `bool`               | `--done`, `--no-done`, `--done=false`, `-d` | `false`      |
| `list(string)`       | repeat it: `-t home -t errands`             | `[]`         |
| `optional(string)`   | same as its item                            | unset        |
| any with a `default` | same as its kind                            | the default  |

Single-character aliases become short flags and can be grouped (`-dt home`);
longer ones become additional long flags. `--` ends flag parsing, so everything
after it is positional. `--help`, `-h`, `--output` and `-o` are reserved — a spec
that uses those names for its own inputs is rejected.

An input can also name the only values it accepts. The parser rejects anything
else, help shows the choices in place of the type, and completions offer them:

```ts
mode: spec.field({ d: 'How to apply them.', kind: spec.string, values: ['fast', 'safe'] })
```

```console
$ todo add 'buy milk' --mode sloppy
error: invalid value for 'mode': 'sloppy' (expected 'fast' or 'safe')
```

## Subcommands

A group with a `name` takes a path segment; an unnamed group just lends its
commands to its parent, which is what the root usually is.

```ts
const cmds: SubCmds = {
  name: 'todo',
  description: 'A tiny task list.',
  cmds: [
    { name: 'task', description: 'Task commands.', cmds: [add, remove] },
    { cmds: [version] }, // `todo version`, not `todo misc version`
  ],
}
```

```console
$ todo task add 'buy milk'
```

## Completions

`withCompletions` adds a `completions <shell>` command wired to the tree it
returns, for **bash**, **zsh** and **fish**:

```ts
const cmds = withCompletions({ name: 'todo', description: 'A tiny task list.', cmds: [add] })
```

```console
$ todo completions fish
# todo completions for fish.
# Generated from the command spec — regenerate when the CLI changes.
# Install: todo completions fish > ~/.config/fish/completions/todo.fish

complete -c todo -n '__fish_use_subcommand' -a 'add' -d 'Add a task.'
complete -c todo -n '__fish_use_subcommand' -s o -r -d 'Output format.' -a 'text json'
complete -c todo -n '__fish_seen_subcommand_from add' -s t -r -d 'Tags to file it under.'
complete -c todo -n '__fish_seen_subcommand_from add' -l tag -r -d 'Tags to file it under.'
...
```

The whole command tree is baked into the script, so completing costs nothing at
the prompt — and the script has to be regenerated when the CLI changes. Commands,
every flag spelling, and any `values` are all completed; zsh and fish also show
each candidate's description. Install it where your shell looks:

```console
$ todo completions bash > /etc/bash_completion.d/todo
$ todo completions zsh  > "${fpath[1]}/_todo"
$ todo completions fish > ~/.config/fish/completions/todo.fish
```

To place the command yourself — inside a group, say — use the underlying
factory. It takes the tree as a thunk, since the command lives inside the tree
it describes:

```ts
const cmds: SubCmds = {
  name: 'todo',
  cmds: [add, { name: 'util', cmds: [completionsCmd(() => cmds)] }],
}
```

`completion(cmds, shell, opts?)` returns the script directly if you would rather
generate it at build time than ship a subcommand.

## Exit codes

`run` never ends the process — it resolves to a code and leaves the decision to
you, which also makes it straightforward to test.

| Code | Meaning                                                            |
| ---- | ------------------------------------------------------------------ |
| `0`  | the command ran, or help was asked for                             |
| `1`  | the command threw                                                  |
| `2`  | the invocation was wrong: unknown command, bad flag, missing input |

Errors go to stderr in the selected format, so a `-o json` caller gets something
parseable whatever goes wrong:

```console
$ todo add
error: missing required argument '<title>'
Try 'todo add --help' for more information.

$ todo add -o json
{
  "error": {
    "message": "missing required argument '<title>'"
  }
}
```

## Testing

```ts
run(cmds, argv, opts?: RunOpts): Promise<number>

interface RunOpts {
  name?: string // program name in usage lines; defaults to the root group's name
  stdout?: (s: string) => void
  stderr?: (s: string) => void
}
```

Passing `stdout`/`stderr` captures the output instead of writing to the process:

```ts
let out = ''
const code = await run(cmds, ['add', 'buy milk'], { stdout: (s) => (out += s), stderr: () => {} })

expect(code).toBe(0)
expect(out).toBe('id:    1\ntitle: buy milk\ntags:\n')
```
