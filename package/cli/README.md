# @lickle/cli

Run a `@lickle/api` operation as a command-line program.

The operation is the single source of truth: it describes the inputs, the output
and the subcommands, and this package derives the argument parsing, the `--help`
text and the printed result from it. Nothing is declared twice.

A type is a [Standard Schema](https://standardschema.dev) that also emits JSON
Schema, so core's own small type set and anything else implementing it — zod,
valibot, arktype — sit in the same place.

```sh
pnpm add @lickle/cli
```

## A whole CLI

```ts
// todo.ts
import { t } from '@lickle/api'
import { cmd, flag, list, run, string } from '@lickle/cli'

const add = cmd({
  name: 'add',
  description: 'Add a task.',
  args: {
    title: { description: 'What to do.', type: string() },
    tag: { description: 'Tags to file it under.', short: 't', type: list() },
    done: { description: 'Mark it done immediately.', short: 'd', type: flag() },
  },
  positional: ['title'],
  handle: async (a) => console.log(`${a.done ? '[x]' : '[ ]'} ${a.title} ${a.tag.join(', ')}`),
})

const todo = t.ns({ name: 'todo', description: 'A tiny task list.', operations: [add] })

process.exit(await run(todo, process.argv.slice(2)))
```

```console
$ todo add 'buy milk' -t home -t errands
[ ] buy milk home, errands
```

`a` is typed from the args — `a.title` is a `string`, `a.tag` a `string[]`,
`a.done` a `boolean`. No annotation, no cast.

## Two ways to write a command

`cmd` takes a command written for this target, and compiles it to an operation
that it hangs off the command under the api key. The same declaration is a
command here and a tool everywhere else:

```ts
import { apiOf } from '@lickle/api'

apiOf(add) // Operation<'add', Type.Object<{ title: …; tag: …; done: … }>, Type.Void>
```

Or write the operation directly and configure it for this target with `meta`:

```ts
const show = t
  .op({
    name: 'show',
    description: 'Show a task.',
    in: { id: t.number('Which task.'), verbose: t.boolean('Say more.').meta('cli', { short: 'v' }) },
    out: t.object({ id: t.number('The id.'), title: t.string('What it says.') }),
    handle: async (i) => ({ id: i.id, title: 'buy milk' }),
  })
  .meta('cli', { positionals: ['id'] })
```

`cmd` passes an operation or a namespace straight through, so a tree can hold
both:

```ts
t.ns({ name: 'todo', operations: [add, show] })
```

A single operation can also be the whole program — `run` takes an operation, a
namespace, or anything carrying one.

## Arguments

Inputs become flags. Those named in `positionals` can also be given by position,
in order — only the last may be a list, which then takes everything left over.

| Type                 | On the command line                         | When omitted |
| -------------------- | ------------------------------------------- | ------------ |
| `string()`, `num()`  | `--title x`, `--title=x`, `-t x`, `-t=x`    | required     |
| `flag()`             | `--done`, `--no-done`, `--done=false`, `-d` | `false`      |
| `list()`             | repeat it: `-t home -t errands`             | `[]`         |
| `optional(string())` | same as its item                            | unset        |
| `choice([…])`        | one of the members: `--mode fast`           | required     |
| any Standard Schema  | as its JSON Schema describes it             | see above    |
| any with a `default` | same as its type                            | the default  |

Single-character names become short flags and can be grouped (`-dt home`); longer
ones become additional long flags. `--` ends flag parsing, so everything after it
is positional. `--help`, `-h`, `--output` and `-o` are reserved — an operation
that uses those names for its own inputs is rejected.

## Output: text or json

Every command answers to `--output`/`-o`. Text is the default; `json` prints the
value verbatim, for piping into something else.

```console
$ todo show 1
id:    1
title: buy milk

$ todo show 1 -o json
{
  "id": 1,
  "title": "buy milk"
}
```

An operation whose `out` is a single value prints it bare — that is what a
document needs, since there is no field name to print. One that returns nothing
prints nothing at all.

An operation that declares `t.output(type, 'async-iter')` hands back items as it
produces them, and each is printed as it arrives rather than collected first.

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
```

## Bring your own schema

An input's type is a Standard Schema, so anything implementing it can sit where a
core type does:

```ts
t.op({
  name: 'mail',
  in: {
    email: z.string().email().describe('Who to tell.'),
    count: z.coerce.number().int().min(1).describe('How many.'),
  },
  out: t.string(),
  handle: async (i) => `${i.email} x${i.count}`,
})
```

`i.email` is a `string` and `i.count` a `number`, inferred from the schema. The
library's rejections come back as ordinary usage errors:

```console
$ mail --email nope --count 1
error: invalid value for '--email': Invalid email address
```

**How help still works.** Standard Schema is validate-only — it cannot say
whether a flag takes a value, repeats, or has members, and it cannot turn the
string `'3'` into the number `3`. Those come from the JSON Schema the type emits,
so a zod-typed input parses, renders and completes like a native one. The whole
object may be foreign too (`in: z.object({ … })`), in which case it is validated
in one go and each issue is reported against the flag that carried it.

## Configuration belongs to the binding

Which inputs may be given by position is this target's business — MCP has no
notion of it, and a GitHub Action's inputs are always named. So it is not part of
the operation at all: it attaches under a key named for the target.

```ts
op.meta('cli', { positionals: ['id'], aliases: { verbose: ['v'] } })
type.meta('cli', { short: 'v', aliases: ['loud'] })
```

Positionals are checked against the operation's inputs, so one naming an input
that does not exist is a compile error rather than a runtime one. Because it is
per-node data, importing this package cannot change what any other target sees,
and two targets can never collide over a key.

## Exit codes

`run` never ends the process — it resolves to a code and leaves the decision to
you, which also makes it straightforward to test.

| Code | Meaning                                                            |
| ---- | ------------------------------------------------------------------ |
| `0`  | the command ran, or help was asked for                             |
| `1`  | the command threw                                                  |
| `2`  | the invocation was wrong: unknown command, bad flag, missing input |

A command that wants to report the caller's mistake rather than its own failure
throws `CliError`:

```ts
import { CliError } from '@lickle/cli'

throw new CliError('that task is already done')
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
run(program, argv, opts?: RunOpts): Promise<number>

interface RunOpts {
  name?: string // program name in usage lines; defaults to the root node's own name
  stdout?: (s: string) => void
  stderr?: (s: string) => void
}
```

Passing `stdout`/`stderr` captures the output instead of writing to the process:

```ts
let out = ''
const code = await run(todo, ['show', '1'], { stdout: (s) => (out += s), stderr: () => {} })

expect(code).toBe(0)
expect(out).toBe('id:    1\ntitle: buy milk\n')
```
