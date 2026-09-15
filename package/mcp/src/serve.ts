import { t, type Api, type Namespace } from '@lickle/api'

import { server, type McpOpts } from './core/server.ts'
import { serveStdio, type StdioIO } from './core/stdio.ts'

type ServeArgs<T extends Api.Program> = McpOpts & { io?: Partial<StdioIO> } & (Namespace.Cx<T> extends void
    ? { context?: Namespace.Cx<T> }
    : { context: Namespace.Cx<T> })

/**
 * An `mcp` operation for a tree, so one program is both a command line and an
 * MCP server.
 *
 * The tree arrives as a thunk because this operation lives inside the tree it
 * serves; it is read when the operation runs, by which point the tree exists.
 *
 * Two things this has to get right, either of which would corrupt a session:
 *
 * - It must not resolve while serving. A command-line runner awaits the handler
 *   and then returns an exit code for the caller to act on, so `serveStdio`
 *   settling only when the input ends is what keeps the process alive for
 *   exactly as long as a client is attached.
 * - It must print nothing. It declares no output and returns nothing, so the
 *   runner writes nothing — stdout belongs to JSON-RPC. An operation of your own
 *   that prints will break this too: return a value instead.
 *
 * It hides itself from the tool list: a model has no business asking the server
 * it is already talking to for another one.
 */
export const mcp = <T extends Api.Program>(tree: () => T, opts: ServeArgs<T> = {} as ServeArgs<T>) =>
  t
    .op({
      name: 'mcp',
      description: 'Serve this program as an MCP server over stdio.',
      handle: async () => {
        await serveStdio(server(tree(), opts as never), opts.io)
      },
    })
    .meta('mcp', { hidden: true })
