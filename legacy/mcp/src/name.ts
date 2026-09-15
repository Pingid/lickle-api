/**
 * Tool names are flat, but a command tree is nested, so a tool's name is its
 * path joined with `_`: `['db','migrate']` becomes `db_migrate`.
 *
 * Names are held to `^[A-Za-z0-9_-]{1,64}$` — the pattern Claude's tool-use
 * API enforces — so the tools stay usable wherever they surface.
 */
export const MAX_NAME = 64

export const toolName = (path: string[]): string => {
  const raw = path.join('_').replace(/[^A-Za-z0-9_-]/g, '_')
  return raw.length <= MAX_NAME ? raw : raw.slice(0, MAX_NAME)
}

/**
 * Make a name unique against those already taken, by suffixing `_2`, `_3`, …
 * and trimming to stay inside the length cap.
 */
export const uniqueName = (name: string, taken: ReadonlySet<string>): string => {
  if (!taken.has(name)) return name
  for (let n = 2; ; n++) {
    const suffix = `_${n}`
    const candidate = `${name.slice(0, MAX_NAME - suffix.length)}${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}
