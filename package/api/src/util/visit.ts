import type { Operation, Api, Namespace } from '../types.ts'
import * as api from './api.ts'
import * as is from './guard.ts'

/** A node in the tree, with the path that reaches it. */
export interface Located<T> {
  /** Segments leading here, program name excluded. */
  path: string[]
  node: T
}

/**
 * Match one path segment against a namespace's children.
 *
 * There is no `children()` helper: since every namespace is named, a
 * namespace's children are exactly its `cmds`.
 */
export const findChild = (ns: Namespace | Api<Namespace>, segment: string): Operation.Any | Namespace | undefined =>
  api.of(api.of(ns).operations.find((c: any) => api.of(c).name === segment))

/**
 * A node a target does not want, and does not want walked into.
 *
 * Core never decides what this means — it takes the predicate. That is what
 * lets MCP hide a whole namespace of tools without core learning the word
 * "hidden".
 */
export type Skip = (node: Operation.Any | Namespace) => boolean

/** Every node in the tree, depth first, each with the path that reaches it. */
export const walk = (ns: Namespace, skip?: Skip, path: string[] = []): Located<Operation.Any | Namespace>[] =>
  ns.operations
    .map((x) => api.of(x))
    .flatMap((node) => {
      if (skip?.(node) === true) return []
      const here = [...path, node.name]
      const located: Located<Operation.Any | Namespace> = { path: here, node: node }
      return is.namespace(node) ? [located, ...walk(node as Namespace, skip, here)] : [located]
    })

/**
 * Every callable operation<> in the tree, with its path. Namespaces contribute path
 * segments but are not themselves callable, so only leaves appear.
 *
 * This is the shape every target consumes: a target is a function from these to
 * whatever it emits.
 */
export const operations = (ns: Namespace, skip?: Skip): Located<Operation.Any>[] =>
  walk(ns, skip).filter((l): l is Located<Operation.Any> => !is.namespace(l.node))
