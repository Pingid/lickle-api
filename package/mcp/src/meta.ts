import type { Meta, Operation } from '@lickle/cmd-core'

/**
 * MCP configuration, stored under an operation's `meta.mcp`.
 *
 * Plain data rather than a module-level registry: a `WeakSet` keyed on the
 * operation object is invisible in a dump of the tree, silently no-ops when two
 * copies of this package are loaded, and hides every command that happens to
 * share an operation literal.
 */
export interface McpMeta {
  /** Keep the command out of the tool list. It stays a normal CLI command. */
  hidden?: boolean
}

export const MCP_META = 'mcp'

export const mcpMeta = (op: Operation): McpMeta => (op.meta?.[MCP_META] as McpMeta | undefined) ?? {}

export const isHiddenFromTools = (op: Operation): boolean => mcpMeta(op).hidden === true

/** Attach MCP configuration to an operation. */
export const mcp = <const O extends Operation>(op: O, meta: McpMeta): O & { meta: Meta } => ({
  ...op,
  meta: { ...op.meta, [MCP_META]: meta },
})

/**
 * Keep a command out of the tool list.
 *
 * A tree may hold commands that make no sense to a model — serving the tree
 * itself over MCP being the obvious one, since a model could otherwise ask the
 * server to start another server.
 */
export const hideFromTools = <const O extends Operation>(op: O): O & { meta: Meta } => mcp(op, { hidden: true })
