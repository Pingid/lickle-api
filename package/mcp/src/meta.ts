import type { Ns, Op } from '@lickle/api'

// Imported so the block below augments `@lickle/api/meta` rather than shadow it.
import '@lickle/api/meta'

import type { ToolAnnotations } from './core/wire.ts'

/**
 * What this target needs to know about a node that the operation itself cannot
 * say.
 *
 * It is the whole authoring surface for MCP, and its smallness is the point: a
 * tool's name comes from where the operation sits in the tree, its description
 * from the operation, and both of its schemas from the types. What is left is
 * the handful of decisions a *binding* makes — whether to publish this operation
 * at all, what to call it, and what to claim about it.
 */
export interface McpMeta {
  /** Keep it out of the tool list. On a namespace that prunes the whole subtree. */
  hidden?: boolean
  /** Override the name derived from the path. Still held to the name policy, still uniqued. */
  name?: string
  /** Override the display title, which is otherwise the path as written. */
  title?: string
  /**
   * Behavioural hints a model reads before calling.
   *
   * Nothing derives these: an operation cannot know it is read-only, because
   * that is a claim about what its handler does. A client is right to treat them
   * as untrusted unless it trusts the server.
   */
  annotations?: ToolAnnotations
}

declare module '@lickle/api/meta' {
  export interface OperationMeta<T> {
    mcp: (m: McpMeta) => Op<T>
  }
  export interface NamespaceMeta<T> {
    mcp: (m: Pick<McpMeta, 'hidden'>) => Ns<T>
  }
}

export type { ToolAnnotations }
