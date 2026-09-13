import { isNamespace } from './cons.ts'
import type { Command, Namespace } from './types.ts'

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
export const findChild = (ns: Namespace, segment: string): Command | Namespace | undefined =>
  ns.cmds.find((c) => c.name === segment)

/** Every node in the tree, depth first, each with the path that reaches it. */
export const walk = (ns: Namespace, path: string[] = []): Located<Command | Namespace>[] =>
  ns.cmds.flatMap((node) => {
    const here = [...path, node.name]
    const located: Located<Command | Namespace> = { path: here, node }
    return isNamespace(node) ? [located, ...walk(node, here)] : [located]
  })

/**
 * Every callable command in the tree, with its path. Namespaces contribute path
 * segments but are not themselves callable, so only leaves appear.
 *
 * This is the shape every target consumes: a target is a function from these to
 * whatever it emits.
 */
export const operations = (ns: Namespace): Located<Command>[] =>
  walk(ns).filter((l): l is Located<Command> => !isNamespace(l.node))
