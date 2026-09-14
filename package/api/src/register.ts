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
