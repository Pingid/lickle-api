# @lickle/cmd-mcp

Serve a `@lickle/cmd-core` command tree as an [MCP](https://modelcontextprotocol.io) server.

A tool is a named operation with a description and a typed input schema — which is what a
command already is, with `run` as the handler. So nothing is declared twice: the same spec
that produces a CLI produces the tools a model calls.

Implements protocol revision **2026-07-28** directly, with **no dependencies**.

```sh
pnpm add @lickle/cmd-mcp
```

## One program, two surfaces

`mcpCmd` adds an `mcp` command wired to the tree it sits in, so a CLI serves itself:

```ts
// todo.ts
import { run, spec } from '@lickle/cmd-cli'
import type { SubCmds } from '@lickle/cmd-cli'
import { mcpCmd } from '@lickle/cmd-mcp'

const add = spec.cmd(
  {
    name: 'add',
    description: 'Add a task to the list.',
    inputs: {
      title: spec.field({ d: 'What to do.', kind: spec.string }),
      tag: spec.field({ d: 'Tags to file it under.', kind: spec.list(spec.string) }),
      priority: spec.field({ d: 'How urgent.', kind: spec.string, values: ['low', 'high'], default: 'low' }),
    },
    outputs: {
      id: spec.field({ d: 'The new task id.', kind: spec.num }),
      title: spec.field({ d: 'What it says.', kind: spec.string }),
    },
    positionals: ['title'],
  },
  (i) => ({ id: 1, title: `${i.title} [${i.priority}]` }),
)

const cmds: SubCmds = {
  name: 'todo',
  description: 'A tiny task list.',
  cmds: [{ name: 'task', description: 'Task commands.', cmds: [add] }, mcpCmd((): SubCmds => cmds)],
}

process.exit(await run(cmds, process.argv.slice(2)))
```

`todo task add 'buy milk'` still works. `todo mcp` serves the same tree over stdio — point an
MCP client at `node todo.js mcp`.

Each field's `d` becomes the schema `description`, which is exactly the prose a model needs
and the part hand-written tool schemas usually skip:

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
`^[A-Za-z0-9_-]{1,64}$`. `values` becomes `enum`; `outputs` becomes `outputSchema`, and the
command's return value comes back as `structuredContent`.

## Without the CLI

The server is a plain function from one decoded message to one response, so it needs no
transport to be useful — or to be tested:

```ts
import { server, serveStdio, httpHandler } from '@lickle/cmd-mcp'

const dispatch = server(cmds)

await serveStdio(dispatch) // newline-delimited JSON-RPC on stdin/stdout
export default { fetch: httpHandler(dispatch) } // a POST endpoint, web-standard Request/Response
```

`serveStdio` resolves when its input ends. `httpHandler` is built on `Request`/`Response`, so
it runs on Node, Deno, Bun and workers with no framework.

## What it implements

`server/discover`, `tools/list` and `tools/call`. Capabilities advertise only `tools`, so
every other method answers `METHOD_NOT_FOUND` — which is a complete answer, not a gap.

Errors follow the line the specification draws: a failure _from_ a command comes back as a
tool result with `isError: true`, so the model can read it and correct itself, while a failure
to _find_ the tool is a protocol error.

```jsonc
// a command that threw
{ "content": [{ "type": "text", "text": "the database is on fire" }], "isError": true }
// arguments that did not match the spec
{ "content": [{ "type": "text", "text": "'priority' expects one of 'low', 'high', got \"urgent\"" }], "isError": true }
```

## Two things to know

**stdout belongs to the protocol.** On stdio, anything a command prints corrupts the session.
Return values rather than printing; send diagnostics to stderr.

**The `mcp` command is not itself a tool** — a model has no business asking the server it is
talking to for another server. Use `hideFromTools(spec)` to keep any other command out of the
tool list while leaving it a normal CLI command.

## Protocol revision

Types are transcribed from `schema/2026-07-28/schema.ts` at commit `aa8ce049`, cited in
`src/types.ts`. Interoperating with older, `initialize`-based revisions is not supported.
