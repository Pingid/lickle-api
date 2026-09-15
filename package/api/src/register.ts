export type Meta = { meta?: Record<string, unknown>; description?: string; default?: any }
let _meta: WeakMap<any, Meta> | undefined = undefined

const reg = <T extends object>(): WeakMap<T, Meta> => {
  if (_meta) return _meta
  _meta = new WeakMap()
  return _meta
}

export const update = <T extends object>(t: T, m: Partial<Meta>) => {
  const _meta = reg<T>()
  const current = _meta.get(t) ?? {}
  return _meta.set(t, { ...current, ...m, meta: { ...(current.meta ?? {}), ...m.meta } })
}

export const get = <T extends object>(t: T): Meta => {
  const _meta = reg<T>()
  return _meta.get(t) ?? {}
}

/**
 * A target's own configuration for a node.
 *
 * `.meta(key, …)` records the arguments it was called with, so what is stored is
 * an array and a target reads the first of it. That convention is this module's
 * choice, so answering for it is this module's job rather than a line every
 * target copies.
 */
export const of = <T>(t: object, key: string): T | undefined => {
  const args = get(t).meta?.[key]
  return Array.isArray(args) ? (args[0] as T) : (args as T | undefined)
}
