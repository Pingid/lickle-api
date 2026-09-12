import { cmd, spec as makeSpec, type Cmd, type SubCmds } from '@lickle/cmd-core'
import { server, type McpOpts } from './server.ts'
import { serveStdio, type StdioIO } from './stdio.ts'
import { hideFromTools } from './tools.ts'

// Hidden from the tool list: a model has no business asking the server it is
// talking to for another server.
const mcpSpec = hideFromTools(
  makeSpec({
    name: 'mcp',
    description: 'Serve this program as an MCP server over stdio.',
  }),
)

/**
 * An `mcp` command for a tree, so one program is both a CLI and an MCP server.
 *
 * The tree is passed as a thunk because the command lives inside the tree it
 * serves; it is read when the command runs, by which point the tree exists.
 *
 * Two things this must get right, both of which would corrupt a session:
 *
 * - It must not resolve while serving. The CLI runner awaits `run`, then
 *   returns an exit code the caller hands to `process.exit`. `serveStdio`
 *   settles only when the input ends, so awaiting it keeps the process alive
 *   for exactly as long as a client is attached.
 * - It must print nothing. The spec declares no `outputs` and the run returns
 *   void, so the runner renders the empty string and writes nothing — stdout
 *   belongs to JSON-RPC. A command of your own that prints will break this too:
 *   return values instead.
 */
export const mcpCmd = (tree: () => SubCmds, opts: McpOpts & { io?: Partial<StdioIO> } = {}): Cmd =>
  cmd(mcpSpec, async () => {
    await serveStdio(server(tree(), opts), opts.io)
  })
