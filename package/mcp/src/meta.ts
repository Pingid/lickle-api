import type { Addressable, Meta } from '@lickle/api'

/**
 * MCP configuration, stored under an operation's `meta.mcp`.
 *
 * Plain data rather than a module-level registry: a `WeakSet` keyed on the
 * operation object is invisible in a dump of the tree, silently no-ops when two
 * copies of this package are loaded, and hides every command that happens to
 * share an operation literal.
 */
export interface McpMeta {
  /**
   * Keep this out of the tool list. On a command it hides that command; on a
   * namespace it hides everything beneath it. Either stays a normal CLI command.
   */
  hidden?: boolean
}

export const MCP_META = 'mcp'

export const mcpMeta = (node: Addressable): McpMeta => (node.meta?.[MCP_META] as McpMeta | undefined) ?? {}

export const isHiddenFromTools = (node: Addressable): boolean => mcpMeta(node).hidden === true

/** Attach MCP configuration to a bound command or a namespace. */
export const mcp = <const N extends Addressable>(node: N, meta: McpMeta): N & { meta: Meta } => ({
  ...node,
  meta: { ...node.meta, [MCP_META]: meta },
})

/**
 * Keep a command, or a whole namespace, out of the tool list.
 *
 * A tree may hold commands that make no sense to a model — serving the tree
 * itself over MCP being the obvious one, since a model could otherwise ask the
 * server to start another server. Applied to a namespace it prunes the subtree,
 * so a group of operator-only commands can be excluded in one place.
 */
export const hideFromTools = <const N extends Addressable>(node: N): N & { meta: Meta } => mcp(node, { hidden: true })
