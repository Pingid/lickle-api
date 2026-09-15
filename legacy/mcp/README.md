# @lickle/api-legacy-mcp

Serve a `@lickle/api-legacy` command tree as an [MCP](https://modelcontextprotocol.io) server.

A tool is a named operation with a description and a typed input schema — which is what a
command already is, with `run` as the handler. So nothing is declared twice: the same
operation a CLI or a GitHub Action renders produces the tools a model calls.

Implements protocol revision **2026-07-28** directly, with **no dependencies**.

```sh
pnpm add @lickle/api-legacy-mcp
```

`@lickle/api-legacy-mcp/cmd` re-exports `@lickle/api-legacy`, so this one package is enough to write a
server. Depend on `@lickle/api-legacy` directly when a package defines operations without
serving them.

## A server

Two import sites: the root is what this package _does_, and `/cmd` is how you describe the
operations it serves.

```ts
// todo.ts
import { server, serveStdio } from '@lickle/api-legacy-mcp'
import { choice, cmd, field, list, ns, num, string } from '@lickle/api-legacy-mcp/cmd'

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
import { httpHandler, server, serveStdio } from '@lickle/api-legacy-mcp'

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

A field's type is a [Standard Schema](https://standardschema.dev) and validates itself, so one
validator serves both wires: a command line hands it `'2'` and a tool call hands it `2`. Values
are coerced to what the type declares rather than rejected for arriving stringly typed — which
suits a model that sends `"2"` for a number, at the cost of not correcting it. What cannot be
coerced is still rejected, and a `list` still demands a real array. A command that throws core's
`InputError` is a caller error on every target.

Because the type is the schema, an outside library's constraints reach the model directly — a
`z.string().email()` field contributes its own `format` and `pattern` to `inputSchema`, which is
more than core's own types could say:

```ts
import { z } from 'zod'

email: field({ description: 'Who to tell.', type: z.string().email() })
// → { "type": "string", "format": "email", "pattern": "…", "description": "Who to tell." }
```

## Two things to know

**stdout belongs to the protocol.** On stdio, anything a command prints corrupts the session.
Return values rather than printing; send diagnostics to stderr.

**The `mcp` command is not itself a tool** — a model has no business asking the server it is
talking to for another server. Keep anything else out the same way, at the point you bind it
into the tree:

```ts
cmds: [
  hideFromTools(deploy),                                          // one command
  hideFromTools({ name: 'ops', description: 'Operator only.', cmds: [...] }), // a whole group
]
```

`hideFromTools` writes `meta: { mcp: { hidden: true } }` for you. On a namespace it is a
prune, not a filter — `operations(tree, isHiddenFromTools)` never walks into it, so the whole
subtree is absent from the tool list while remaining a complete tree for whatever else renders
it. Core takes the predicate and never learns what "hidden" means.

It is plain data on the node, so it shows up in a dump of the tree, survives two copies of
this package being loaded, and hides only what carries it.

## Protocol revision

Types are transcribed from `schema/2026-07-28/schema.ts` at commit `aa8ce049`, cited in
`src/types.ts`. Interoperating with older, `initialize`-based revisions is not supported.
