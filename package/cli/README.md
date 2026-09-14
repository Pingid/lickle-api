# @lickle/cmd-cli

Run a `@lickle/cmd-core` operation as a command-line program.

The operation is the single source of truth: it describes the inputs, outputs and
subcommands, and this package derives the argument parsing, the `--help` text
and the printed result from it. Nothing is declared twice.

Fields carry core's own small type set or any
[Standard Schema](https://standardschema.dev) — zod, valibot, arktype.

```sh
pnpm add @lickle/cmd-cli
```

`@lickle/cmd-cli/cmd` re-exports `@lickle/cmd-core`, so this one package is
enough to write a CLI. Depend on `@lickle/cmd-core` directly when a package
defines operations without running them.

## A whole CLI

Two import sites: the root is what this package _does_, and `/cmd` is how you
describe the operations it runs.

```ts
// todo.ts
import { cli, run } from '@lickle/cmd-cli'
import { bool, cmd, field, list, num, string, type Namespace } from '@lickle/cmd-cli/cmd'

const add = cmd(
  {
    name: 'add',
    description: 'Add a task.',
    inputs: {
      title: field({ description: 'What to do.', type: string }),
      tag: field({ description: 'Tags to file it under.', type: list(string), alias: ['t'] }),
      done: field({ description: 'Mark it done immediately.', type: bool, alias: ['d'] }),
    },
    outputs: {
      id: field({ description: 'The new task id.', type: num }),
      title: field({ description: 'What it says.', type: string }),
      tags: field({ description: 'Tags it was filed under.', type: list(string) }),
    },
  },
  (i) => ({ id: 1, title: i.done ? `${i.title} (done)` : i.title, tags: i.tag }),
)

// `cli(…)` is applied where the program is assembled, not in the operation.
const cmds: Namespace = {
  name: 'todo',
  description: 'A tiny task list.',
  cmds: [cli(add, { positionals: ['title'] })],
}

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

`i` is typed from the operation — `i.title` is a `string`, `i.tag` a `string[]`,
`i.done` a `boolean` — and so is the object you return. No annotation, no cast.

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

A command whose `outputs` is a single unnamed field returns a document rather
than a set of fields, and text output prints it bare — that is how `completions`
prints a shell script:

```ts
outputs: field({ description: 'The completion script.', type: string })
```

## Help

`--help`/`-h` works on every command and namespace, written from the operation:

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

| Type                 | On the command line                         | When omitted |
| -------------------- | ------------------------------------------- | ------------ |
| `string`, `num`      | `--title x`, `--title=x`, `-t x`, `-t=x`    | required     |
| `bool`               | `--done`, `--no-done`, `--done=false`, `-d` | `false`      |
| `list(string)`       | repeat it: `-t home -t errands`             | `[]`         |
| `optional(string)`   | same as its item                            | unset        |
| `choice([…])`        | one of the members: `--mode fast`           | required     |
| any Standard Schema  | as its JSON Schema describes it             | see above    |
| any with a `default` | same as its type                            | the default  |

Single-character aliases become short flags and can be grouped (`-dt home`);
longer ones become additional long flags. `--` ends flag parsing, so everything
after it is positional. `--help`, `-h`, `--output` and `-o` are reserved — an
operation that uses those names for its own inputs is rejected.

## Closed sets

`choice` is a type, not an annotation — so the handler sees the members, not just
`string`:

```ts
const Mode = choice(['fast', 'safe'])

mode: field({ description: 'How to apply them.', type: Mode })
// in the handler, `i.mode` is 'fast' | 'safe'
```

Because it is a `Primitive` it composes like any other type: `optional(Mode)`
gives `'fast' | 'safe' | undefined`, and `list(Mode)` gives `('fast' | 'safe')[]`
with every element checked. Members must be all strings or all numbers, so
`choice([1, 2, 3])` works and yields `1 | 2 | 3`.

The parser rejects anything else, help shows the members in place of the type,
completions offer them, and JSON Schema emits them as `enum`:

```console
$ todo add 'buy milk' --mode sloppy
error: invalid value for 'mode': 'sloppy' (expected 'fast' or 'safe')

$ todo add 'buy milk' --level 9
error: invalid value for 'level': 9 (expected 1, 2 or 3)
```

## Bring your own schema

A field's `type` is a [Standard Schema](https://standardschema.dev), so anything
implementing it — zod, valibot, arktype — can sit where a core type does:

```ts
import { z } from 'zod'

inputs: {
  email: field({ description: 'Who to tell.', type: z.string().email() }),
  count: field({ description: 'How many.', type: z.coerce.number().int().min(1) }),
  mode: field({ description: 'How.', type: z.enum(['fast', 'safe']) }),
}
```

`i.email` is a `string` and `i.mode` is `'fast' | 'safe'`, inferred from the
schema. The library's rejections come back as ordinary usage errors:

```console
$ todo add x --email nope
error: invalid value for 'email': Invalid email address

$ todo add x --email a@b.com --count 0
error: invalid value for 'count': Too small: expected number to be >=1
```

**How help and completions still work.** Standard Schema is validate-only — it
cannot say whether a flag takes a value, repeats, or has members. Those come
from the JSON Schema the library already emits, so a zod-typed input renders and
completes like a native one:

```console
      --count <num>       How many. (required)
      --mode <fast|safe>  How. (required)
      --quiet             Stay quiet.          # z.boolean(), so --no-quiet works
  -t, --tag <string...>   Tags.                # z.array(), so it repeats
      --note <string>     A note.              # z.optional(), so not required
```

A validator implementing neither `StandardJSONSchemaV1` nor anything else falls
back to a required, value-taking flag; `withJsonSchema(schema, json)` fills the
gap if you hit one.

**Core types are still the default.** They describe shape; an outside schema adds
constraints core does not model. Use whichever the input actually needs.

## Configuration belongs to the binding

Which inputs may be given by position is this target's business — MCP has no
notion of it, and a GitHub Action's inputs are always named. So it is not part of
the operation at all. An `Operation` is a portable description; configuration
attaches when you _bind_ it — to a `Command`, or to a `Namespace` — under a key
named for the target:

```ts
meta: {
  cli: {
    positionals: ['title']
  }
}
```

`cli()` writes that key, and checks it against the command's inputs, so a
positional naming an input that does not exist is a compile error rather than a
runtime one:

```ts
cli(add, { positionals: ['nope'] })
//                       ~~~~~~
// Type '["nope"]' is not assignable to type '[..."title"[], "title"]'.
```

The reason it takes the command and not the operation: a library can then export
commands, and each consumer decides its own ergonomics. The same command can be
bound twice with different positionals, and neither binding touches the other.

```ts
import { add } from 'some-package' // knows nothing about any target

cmds: [cli(add, { positionals: ['title'] })]
```

Because it is per-node data, importing this package cannot change what any other
target sees, and two targets can never collide over a key.

## Subcommands

A namespace takes a path segment. Every namespace is named: commands that should
live in the parent's own namespace are simply listed there.

```ts
const cmds: Namespace = {
  name: 'todo',
  description: 'A tiny task list.',
  cmds: [{ name: 'task', description: 'Task commands.', cmds: [add, remove] }, version],
}
```

```console
$ todo task add 'buy milk'
```

To fold in a list assembled elsewhere, spread it:

```ts
cmds: [...builtins, version]
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
# Generated from the command tree — regenerate when the CLI changes.
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

To place the command yourself — inside a namespace, say — use the underlying
factory. It takes the tree as a thunk, since the command lives inside the tree
it describes:

```ts
const cmds: Namespace = {
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

A command that wants to report a caller's mistake rather than its own failure
throws core's `InputError`. That is portable: exit `2` here, `isError: true` over
MCP, `400` over HTTP.

```ts
import { InputError } from '@lickle/cmd-cli/cmd'

throw new InputError('that task is already done')
```

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
  name?: string // program name in usage lines; defaults to the root namespace's name
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
