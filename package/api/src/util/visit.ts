import { apiOf, type AnyOperation, type Api, type Namespace } from '../types.ts'
import * as is from './guard.ts'

import { getDefault } from './schema.ts'

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
export const findChild = (ns: Namespace | Api<Namespace>, segment: string): AnyOperation | Namespace | undefined =>
  apiOf(apiOf(ns).operations.find((c) => apiOf(c).name === segment))

/**
 * A node a target does not want, and does not want walked into.
 *
 * Core never decides what this means — it takes the predicate. That is what
 * lets MCP hide a whole namespace of tools without core learning the word
 * "hidden".
 */
export type Skip = (node: AnyOperation | Namespace) => boolean

/** Every node in the tree, depth first, each with the path that reaches it. */
export const walk = (ns: Namespace, skip?: Skip, path: string[] = []): Located<AnyOperation | Namespace>[] =>
  ns.operations
    .map((x) => apiOf(x))
    .flatMap((node) => {
      if (skip?.(node) === true) return []
      const here = [...path, node.name]
      const located: Located<AnyOperation | Namespace> = { path: here, node: node }
      return is.namespace(node) ? [located, ...walk(node as Namespace, skip, here)] : [located]
    })

/**
 * Every callable operation<> in the tree, with its path. Namespaces contribute path
 * segments but are not themselves callable, so only leaves appear.
 *
 * This is the shape every target consumes: a target is a function from these to
 * whatever it emits.
 */
export const operations = (ns: Namespace, skip?: Skip): Located<AnyOperation>[] =>
  walk(ns, skip).filter((l): l is Located<AnyOperation> => !is.namespace(l.node))

/** Collect the inputs for an operation. */
export const collectInputs = (op: AnyOperation, get: (key: string) => { value: any } | undefined): Res => {
  let result: Record<string, any> = {}
  let missing: string[] = []
  const keys = Object.keys(op.in)
  for (const key of keys) {
    const v = get(key) ?? getDefault(op.in, key)
    if (!v) missing.push(key)
    else result[key] = v.value
  }
  if (missing.length > 0) return { ok: false, missing }
  return { ok: true, value: result }
}

type Res = { ok: true; value: Record<string, any> } | { ok: false; missing: string[] }
