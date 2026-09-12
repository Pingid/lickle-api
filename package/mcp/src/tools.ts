import { isSubCmds, jsonSchema, walk } from '@lickle/cmd-core'
import type { Cmd, Spec, SubCmds } from '@lickle/cmd-core'
import { toolName, uniqueName } from './name.ts'
import type { Tool } from './types.ts'

/**
 * Commands that should not be offered as tools.
 *
 * A tree may hold commands that make no sense to a model — serving the tree
 * itself over MCP being the obvious one, since a model could otherwise ask the
 * server to start another server.
 */
const hidden = new WeakSet<Spec>()

/** Keep a command out of the tool list. It stays a normal CLI command. */
export const hideFromTools = <S extends Spec>(spec: S): S => {
  hidden.add(spec)
  return spec
}

export const isHiddenFromTools = (spec: Spec): boolean => hidden.has(spec)

export interface ToolEntry {
  tool: Tool
  cmd: Cmd
  /** Path through the tree, for diagnostics and the tool's title. */
  path: string[]
}

export interface ToolsOpts {
  /** Where to report a name collision. Never stdout — that carries JSON-RPC. */
  onWarn?: (message: string) => void
}

/**
 * Every command in the tree as an MCP tool. Groups contribute path segments
 * but are not themselves callable, so only leaves become tools.
 */
export const tools = (cmds: SubCmds, opts: ToolsOpts = {}): ToolEntry[] => {
  const warn = opts.onWarn ?? ((m: string) => void console.error(m))
  const taken = new Set<string>()

  return walk(cmds)
    .filter((reached) => !isSubCmds(reached.node) && !isHiddenFromTools((reached.node as Cmd).spec))
    .map(({ path, node }) => {
      const cmd = node as Cmd
      const wanted = toolName(path)
      const name = uniqueName(wanted, taken)
      if (name !== wanted) warn(`mcp: tool name '${wanted}' is taken; '${path.join(' ')}' registered as '${name}'`)
      taken.add(name)

      const outputs = cmd.spec.outputs
      const tool: Tool = {
        name,
        title: path.join(' '),
        description: cmd.spec.description,
        inputSchema: jsonSchema(cmd.spec.inputs),
        ...(outputs === undefined ? {} : { outputSchema: jsonSchema(outputs) }),
      }
      return { tool, cmd, path }
    })
}
