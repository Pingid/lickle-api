import { isSubCmds } from './cons.ts'
import type { Cmd, SubCmds } from './types.ts'

export interface Child {
  name: string
  description: string
  node: Cmd | SubCmds
}

/**
 * Direct children of a group, flattening unnamed groups since they contribute
 * their commands to the parent's namespace rather than a path segment.
 */
export const children = (group: SubCmds): Child[] =>
  group.cmds.flatMap((node): Child[] => {
    if (!isSubCmds(node)) return [{ name: node.spec.name, description: node.spec.description, node }]
    if (node.name === undefined) return children(node)
    return [{ name: node.name, description: node.description ?? '', node }]
  })

/** Match one path segment against a group's children. */
export const findChild = (group: SubCmds, segment: string): Cmd | SubCmds | undefined =>
  children(group).find((c) => c.name === segment)?.node

export interface Reached extends Child {
  /** Segments leading here, program name excluded. */
  path: string[]
}

/** Every node in the tree, depth first, each with the path that reaches it. */
export const walk = (group: SubCmds, path: string[] = []): Reached[] =>
  children(group).flatMap((child) => {
    const here = [...path, child.name]
    const reached: Reached = { ...child, path: here }
    return isSubCmds(child.node) ? [reached, ...walk(child.node, here)] : [reached]
  })
