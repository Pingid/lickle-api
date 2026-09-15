/**
 * Giving the nodes of a tree names a flat namespace can hold.
 *
 * A command line navigates a tree one segment at a time, so it never needs this.
 * A target that publishes every operation at once does: a tool list, a route
 * table, a directory of generated actions. Each has its own idea of what a name
 * may contain and how long it may be, so this states none of it — every rule
 * arrives from the caller, and what is here is only the part that is easy to get
 * wrong: a collision suffix has to be carved out of the length cap rather than
 * appended past it.
 */

export interface Naming {
  /** Joins the segments. Defaults to `_`. */
  separator?: string
  /** Characters kept. Anything else becomes `replacement`. */
  allow?: RegExp
  replacement?: string
  /** The longest a name may be, collision suffix included. Uncapped by default. */
  max?: number
  /** Applied after joining and before the charset is enforced — lowercasing, say. */
  transform?: (name: string) => string
  /** Names already spoken for: a target with reserved words passes them here. */
  taken?: Iterable<string>
}

export interface Named {
  path: readonly string[]
  name: string
  /** What it would have been, when a collision moved it. */
  wanted?: string
}

/**
 * Every path as a distinct name, in the order given.
 *
 * A collision is reported rather than announced — `wanted` says a name moved,
 * and where that is said is the target's business. An MCP server in particular
 * must never say it on stdout, which carries the protocol.
 */
export const names = (paths: readonly (readonly string[])[], opts: Naming = {}): Named[] => {
  const { separator = '_', replacement = '_', max, transform } = opts
  // A global regex carries `lastIndex` between tests, so the flag is dropped.
  const allow = opts.allow === undefined ? undefined : new RegExp(opts.allow.source, opts.allow.flags.replace('g', ''))
  const taken = new Set(opts.taken ?? [])

  return paths.map((path) => {
    let name = path.join(separator)
    if (transform !== undefined) name = transform(name)
    if (allow !== undefined) name = [...name].map((c) => (allow.test(c) ? c : replacement)).join('')
    if (max !== undefined) name = name.slice(0, max)

    const wanted = name
    if (taken.has(name)) name = free(name, taken, max)
    taken.add(name)
    return name === wanted ? { path, name } : { path, name, wanted }
  })
}

/** `name_2`, `name_3`, … with the suffix taken out of the cap rather than added past it. */
const free = (wanted: string, taken: ReadonlySet<string>, max?: number): string => {
  for (let n = 2; ; n++) {
    const suffix = `_${n}`
    const head = max === undefined ? wanted : wanted.slice(0, Math.max(0, max - suffix.length))
    const name = `${head}${suffix}`
    if (!taken.has(name)) return name
  }
}
