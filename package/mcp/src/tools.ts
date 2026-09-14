import { jsonSchema, operations, outputFields } from '@lickle/cmd-core'
import type { Command, Namespace } from '@lickle/cmd-core'
import { isHiddenFromTools } from './meta.ts'
import { toolName, uniqueName } from './name.ts'
import type { Tool } from './types.ts'

export interface ToolEntry {
  tool: Tool
  cmd: Command
  /** Path through the tree, for diagnostics and the tool's title. */
  path: string[]
}

export interface ToolsOpts {
  /** Where to report a name collision. Never stdout — that carries JSON-RPC. */
  onWarn?: (message: string) => void
}

/**
 * Every command in the tree as an MCP tool. Namespaces contribute path segments
 * but are not themselves callable, so `operations` yields only the leaves.
 *
 * Hiding is a prune, not a filter: passing the predicate to `operations` means a
 * hidden namespace takes its whole subtree with it, and core never learns what
 * "hidden" means.
 */
export const tools = (tree: Namespace, opts: ToolsOpts = {}): ToolEntry[] => {
  const warn = opts.onWarn ?? ((m: string) => void console.error(m))
  const taken = new Set<string>()

  return operations(tree, isHiddenFromTools).map(({ path, node }) => {
    const wanted = toolName(path)
    const name = uniqueName(wanted, taken)
    if (name !== wanted) warn(`mcp: tool name '${wanted}' is taken; '${path.join(' ')}' registered as '${name}'`)
    taken.add(name)

    // Only a field map becomes an `outputSchema`: `structuredContent` is an
    // object, so an operation returning a single unnamed value comes back as
    // text and declares no schema.
    const fields = outputFields(node.outputs)

    const tool: Tool = {
      name,
      title: path.join(' '),
      description: node.description,
      inputSchema: jsonSchema(node.inputs),
      ...(fields === undefined ? {} : { outputSchema: jsonSchema(fields) }),
    }
    return { tool, cmd: node, path }
  })
}
