# @lickle/cmd-mcp

Serve a `@lickle/cmd-core` command tree as an [MCP](https://modelcontextprotocol.io) server.

A tool is a named operation with a description and a typed input schema — which is what a
command already is, with `run` as the handler. So nothing is declared twice: the same
operation a CLI or a GitHub Action renders produces the tools a model calls.

Implements protocol revision **2026-07-28** directly, with **no dependencies**.

```sh
pnpm add @lickle/cmd-mcp
```

`@lickle/cmd-mcp/cmd` re-exports `@lickle/cmd-core`, so this one package is enough to write a
server. Depend on `@lickle/cmd-core` directly when a package defines operations without
serving them.

## A server

Two import sites: the root is what this package _does_, and `/cmd` is how you describe the
operations it serves.

```ts
// todo.ts
import { server, serveStdio } from '@lickle/cmd-mcp'
import { choice, cmd, field, list, ns, num, string } from '@lickle/cmd-mcp/cmd'

const add = cmd(
  {
    name: 'add',
    description: 'Add a task to the list.',
    inputs: {
      title: field({ description: 'What to do.', type: string }),
      tag: field({ description: 'Tags to file it under.', type: list(string) }),
      priority: field({ description: 'How urgent.', type: choice(['low', 'high']), default: 'low' }),
    },
    outputs: {
      id: field({ description: 'The new task id.', type: num }),
      title: field({ description: 'What it says.', type: string }),
    },
  },
  (i) => ({ id: 1, title: `${i.title} [${i.priority}]` }),
)

const cmds = ns({
  name: 'todo',
  description: 'A tiny task list.',
  cmds: [{ name: 'task', description: 'Task commands.', cmds: [add] }],
})

await serveStdio(server(cmds))
```

`i` is typed from the operation — `i.title` is a `string`, `i.priority` is `'low' | 'high'`
because `choice` is a type rather than an annotation — and so is the object you return.

Each field's `description` becomes the schema `description`, which is exactly the prose a
model needs and the part hand-written tool schemas usually skip:

```jsonc
{
  "name": "task_add",
  "title": "task add",
  "description": "Add a task to the list.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "What to do." },
      "tag": { "type": "array", "items": { "type": "string" }, "description": "Tags to file it under." },
      "priority": { "type": "string", "enum": ["low", "high"], "description": "How urgent.", "default": "low" },
    },
    "required": ["title", "tag"],
    "additionalProperties": false,
  },
}
```

Nested commands get a flat name from their path (`task add` → `task_add`), held to
`^[A-Za-z0-9_-]{1,64}$`. A `choice` becomes `enum` — on outputs too; a map of `outputs`
becomes `outputSchema`, and the command's return value comes back as `structuredContent`.

An operation whose `outputs` is a single unnamed field returns a document rather than a set
of fields. `structuredContent` is an object, so such a tool declares no `outputSchema` and
its result comes back as text.

## Transports

`server` is a plain function from one decoded message to one response, so it needs no
transport to be useful — or to be tested:

```ts
import { httpHandler, server, serveStdio } from '@lickle/cmd-mcp'

const dispatch = server(cmds)

await serveStdio(dispatch) // newline-delimited JSON-RPC on stdin/stdout
export default { fetch: httpHandler(dispatch) } // a POST endpoint, web-standard Request/Response
```

`serveStdio` resolves when its input ends. `httpHandler` is built on `Request`/`Response`, so
it runs on Node, Deno, Bun and workers with no framework.

## Serving a tree from inside itself

`mcpCmd` returns an ordinary command that serves the tree it sits in, for a tree that is also
rendered some other way — so one program can be both. It takes the tree as a thunk, since the
command lives inside the tree it serves:

```ts
const cmds = ns({
  name: 'todo',
  description: 'A tiny task list.',
  cmds: [add, mcpCmd((): Namespace => cmds)],
})
```

It declares no outputs and returns nothing, which is what keeps stdout free for the protocol,
and it resolves only when its input ends — so whatever awaits it stays alive for exactly as
long as a client is attached.

## What it implements

`server/discover`, `tools/list` and `tools/call`. Capabilities advertise only `tools`, so
every other method answers `METHOD_NOT_FOUND` — which is a complete answer, not a gap.

Errors follow the line the specification draws: a failure _from_ a command comes back as a
tool result with `isError: true`, so the model can read it and correct itself, while a failure
to _find_ the tool is a protocol error.

```jsonc
// a command that threw
{ "content": [{ "type": "text", "text": "the database is on fire" }], "isError": true }
// arguments that did not match the operation
{ "content": [{ "type": "text", "text": "invalid value for 'priority': 'urgent' (expected 'low' or 'high')" }], "isError": true }
```

Arguments arrive already JSON-typed, so nothing is coerced from strings the way the CLI
parser must — a wrong type is an error, not a hint. Everything past that (defaults, `values`,
naming a missing input) is core's shared `bind`, so the two targets cannot drift apart on the
parts that are not policy. A command that throws core's `InputError` is a caller error on
every target.

## Two things to know

**stdout belongs to the protocol.** On stdio, anything a command prints corrupts the session.
Return values rather than printing; send diagnostics to stderr.

**The `mcp` command is not itself a tool** — a model has no business asking the server it is
talking to for another server. Keep any other command out of the tool list the same way:

```ts
{ name: 'deploy', description: 'Ship it.', meta: { mcp: { hidden: true } } }
```

`hideFromTools(op)` writes that key for you. It is plain data on the operation, so it shows up
in a dump of the tree, survives two copies of this package being loaded, and hides only the
command that carries it.

## Protocol revision

Types are transcribed from `schema/2026-07-28/schema.ts` at commit `aa8ce049`, cited in
`src/types.ts`. Interoperating with older, `initialize`-based revisions is not supported.
