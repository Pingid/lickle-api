# @lickle/mcp

Serve a `@lickle/api` operation as an MCP server.

The operation is the single source of truth: it describes the inputs, the output
and the subcommands, and this package derives the tool list, the input and output
schemas, the argument checking and the result shape from it. Nothing is declared
twice, and the same tree that runs as a command line serves as a set of tools.

Implements protocol revision **2026-07-28** directly, with **no dependencies**.

```sh
pnpm add @lickle/mcp
```

## A server

```ts
import { t } from '@lickle/api'
import { serveStdio, server } from '@lickle/mcp'

const add = t.op({
  name: 'add',
  description: 'Add a task.',
  in: { title: t.string('What to do.'), tags: t.array(t.string(), 'Tags to file it under.') },
  out: t.object({ id: t.number('The new task id.'), title: t.string('What it says.') }),
  handle: async (i) => ({ id: 1, title: i.title }),
})

const todo = t.ns({ name: 'todo', description: 'A tiny task list.', operations: [add] })

await serveStdio(server(todo))
```

`server` is the whole protocol as one function — message in, message out — so it
is testable without a transport or a subprocess. The transports only move bytes:

```ts
await serveStdio(dispatch) // newline-delimited JSON-RPC on stdin/stdout
export default { fetch: httpHandler(dispatch) } // a POST endpoint, Request/Response
```

`run(todo, argv)` from `@lickle/cli` serves the same tree as a command line.

## One program, both

`mcp` is an operation you put _inside_ the tree it serves, so a program is a CLI
that can also be spoken to as a server. The tree is a thunk because the operation
lives in the tree it describes:

```ts
import { run } from '@lickle/cli'
import { mcp } from '@lickle/mcp'

const todo: Namespace = t.ns({
  name: 'todo',
  description: 'A tiny task list.',
  operations: [add, mcp(() => todo)],
})

process.exit(await run(todo, process.argv.slice(2)))
```

```console
$ todo add 'buy milk'        # a command
$ todo mcp                   # a server on stdin/stdout
```

It hides itself from the tool list: a model has no business asking the server it
is already talking to for another one. Note that an operation of your own that
_prints_ will corrupt a session — stdout carries JSON-RPC. Return a value instead.

## Tools

A tree is nested and a tool list is flat, so the path becomes the name and the
title:

```console
todo/task/add  ->  name: task_add   title: "task add"
```

Names are held to `[A-Za-z0-9_-.]` within 64 characters, which is the
conservative intersection of what the spec allows (1–128, dots included) and what
Claude's tool-use API has historically accepted. A deep tree can opt into the
full range, and collisions are suffixed and reported:

```ts
server(todo, { naming: { separator: '.', max: 128 }, onWarn: (m) => process.stderr.write(m) })
```

`onWarn` must never write to stdout.

## What a tool answers with

An operation returns one value described by one schema, and `structuredContent`
takes any JSON value — so there is nothing to branch on. Whatever the operation
declares is published structurally _and_ rendered as text beside it, so a client
that ignores structured content can still show the model something.

| `out`                       | `outputSchema`                | result                     |
| --------------------------- | ----------------------------- | -------------------------- |
| `t.object({ … })`           | the object schema             | `structuredContent` + text |
| `t.string()`                | `{ type: 'string' }`          | `structuredContent` + text |
| `t.output(x, 'async-iter')` | `{ type: 'array', items: x }` | drained into a list        |
| nothing                     | absent                        | `"Done."`                  |

There is no streaming tool result in this revision — a call answers once — so a
streaming operation is drained and answered all at once, against the array schema
its tool already declared. If the caller supplied a `progressToken` and the
transport can interleave, it is told how far along the drain is as it goes.

## Arguments

Arguments arrive as JSON, which has types, so they are checked rather than
converted: a model sending `"2"` where a number was described gets a refusal
naming what was expected, which it can act on. A command line converts instead,
because argv is text — the difference is a fact about where the values came from,
not a setting.

Unlike a command line, a tool call substitutes nothing for an argument it did not
send: an absent list is not empty and an absent bool is not `false`. Only a
default the schema declares fills a gap, and an input that declares one is not
listed as required.

Every problem comes back at once, so one turn can fix them all:

```console
unknown argument 'titel'; expected 'title' and 'tags'; missing required argument 'tags'
```

## Errors

Two channels, on purpose. Failing to _find_ a tool is a protocol error. Everything
that goes wrong once it is found is a result with `isError: true`, because that is
the one a client is obliged to show the model:

```ts
import { InputError } from '@lickle/api'

throw new InputError('that task is already done')
```

`InputError` is portable — the same throw is exit `2` on a command line and
`isError` here — but any thrown value becomes a tool result, so a handler need
not know which target it is running under.

## Configuration belongs to the binding

What to call a tool, whether to publish it at all, and what to claim about it are
decisions made where a program is assembled, not facts about the operation. They
attach under a key named for this target:

```ts
op.meta('mcp', { hidden: true, title: 'Create a task', annotations: { readOnlyHint: true } })
ns.meta('mcp', { hidden: true }) // prunes the whole subtree
```

Nothing derives `annotations`: an operation cannot know it is read-only, because
that is a claim about what its handler does. A client is right to treat them as
untrusted unless it trusts the server.

There is no MCP-specific way to _write_ an operation, and that is deliberate — a
tool's name comes from the tree, its description from the operation and both its
schemas from the types, so an "MCP-native" declaration would be the same
`t.op({ … })` written twice.

## Options

```ts
server(program, opts?: McpOpts & { context? })

interface McpOpts {
  name?: string      // serverInfo.name; defaults to the root node's own name
  version?: string   // serverInfo.version; defaults to '0.0.0'
  title?: string
  instructions?: string                        // defaults to the root's description
  naming?: { separator?: string; max?: number }
  cache?: { ttlMs?: number; scope?: 'public' | 'private' }
  pageSize?: number  // omitted means one page and no cursor
  onWarn?: (message: string) => void
}
```

`tools/list` says how long it may be trusted (`ttlMs`) and by whom (`cacheScope`,
`private` by default since a list may vary with the authorization presented).
Paging is off unless `pageSize` is set; the cursor is the next page's first tool
name, so it survives a restart and one this server could not have issued is
refused rather than misread.

A tree whose operations need a context is given one: `server(tree, { context })`,
the same as `run`.

## Security

`httpHandler` implements none of the Streamable HTTP transport's security
requirements — no `Origin` validation, no protection against DNS rebinding, no
checking of headers mirrored from the body. Putting it on a public port needs a
layer in front of it.

An operation that streams without end will hold a tool call open without end:
there is no cancellation here, and truncating a result so that it _looked_
complete would be worse.
