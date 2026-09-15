import type { Schema } from '../types.ts'
import {
  accept,
  defaultOf,
  issuePath,
  own,
  properties,
  validate,
  type Issue,
  type Property,
  type Reading,
} from './schema.ts'

/**
 * Binding a call's values onto an operation's inputs.
 *
 * Precedence is the same everywhere and is settled here: what the caller
 * supplied, then the default the schema declares, then whatever the target
 * stands in with, then nothing — and nothing is what makes an input required.
 *
 * What is left to a target is only what it substitutes for an absence, and how
 * it words a refusal. So refusals come back as data rather than as a thrown
 * message: a command line names a missing input by how it could have been
 * written (`<title>` or `--title`) and stops at the first one, while a tool call
 * names it plainly and wants every problem at once so a model can fix them in a
 * single turn. One sentence cannot serve both.
 */

/**
 * An object schema read once, so binding a call does not read it again.
 *
 * `properties` re-emits the JSON Schema document on every call — for a native
 * object that means re-serialising every field. A command line pays that once
 * per process; a server would pay it on every tool call.
 */
export interface Inputs {
  schema: Schema
  /** Its properties, in the order the document lists them. */
  properties: Property[]
  /** Its fields validate on their own; otherwise the object validates as a whole. */
  own: boolean
}

export const inputs = (schema: Schema): Inputs => ({
  schema,
  properties: properties(schema),
  own: own(schema) !== undefined,
})

export interface Policy {
  /** How this target's values arrive. Defaults to `'typed'`. */
  reading?: Reading
  /**
   * A stand-in when nothing was supplied and the schema declares no default.
   *
   * Returning `undefined` leaves the input unbound, which is what makes it
   * required. Returning `{ value: undefined }` binds the key to `undefined`,
   * which is not the same thing — a handler can tell `'note' in input` apart
   * from a missing argument.
   */
  fallback?: (property: Property) => { value: unknown } | undefined
  /** A key that is not an input. Refused unless a target says otherwise. */
  unknown?: 'reject' | 'ignore'
}

/** Why one input could not be bound. What it *reads like* is the target's business. */
export type Problem =
  | { kind: 'missing'; key: string }
  | { kind: 'unknown'; key: string }
  /** `expected` when it was the wrong shape, `issue` when the schema that declared it refused it. */
  | { kind: 'invalid'; key: string; path: string; expected?: string; issue?: Issue }

export type Result =
  | { ok: true; value: Record<string, unknown> }
  /** Every problem at once, and the keys that were expected, so a target need not walk them again. */
  | { ok: false; problems: Problem[]; expected: string[] }

/**
 * Bind `given` onto an object schema's inputs.
 *
 * A supplied value goes through `accept`, so it is checked against the shape the
 * schema describes and then against the schema's own validator when it has one.
 * A default or a fallback does not: a bad declared default is the author's
 * mistake, and surfacing it as a caller-facing refusal would blame the wrong
 * person.
 *
 * `undefined` means absent. `null` is a value, and the floor refuses it where
 * the schema does not describe one — a target whose callers write `null` for
 * "not set" drops those keys before calling here, because that leniency is its
 * own and not every target's.
 */
export const to = async (to: Schema | Inputs, given: Record<string, unknown>, policy: Policy = {}): Promise<Result> => {
  const { schema, properties, own } = '~standard' in to ? inputs(to) : to
  const reading = policy.reading ?? 'typed'
  const problems: Problem[] = []
  const value: Record<string, unknown> = {}

  if (policy.unknown !== 'ignore') {
    const keys = new Set(properties.map((p) => p.key))
    for (const key of Object.keys(given)) if (!keys.has(key)) problems.push({ kind: 'unknown', key })
  }

  // Document order, so the bound record's keys come out in the order the
  // operation declares them rather than the order the caller wrote them.
  for (const property of properties) {
    const key = property.key
    if (Object.hasOwn(given, key) && given[key] !== undefined) {
      const taken = await accept(given[key], property, reading)
      if (taken.ok) value[key] = taken.value
      else if ('issues' in taken)
        for (const issue of taken.issues) problems.push({ kind: 'invalid', key, path: issuePath(issue), issue })
      else problems.push({ kind: 'invalid', key, path: taken.path, expected: taken.expected })
      continue
    }
    const stood = defaultOf(property.json) ?? policy.fallback?.(property)
    if (stood !== undefined) value[key] = stood.value
    // The document already said this one need not be given, so it is left
    // unbound rather than missing — a target that would rather see the key
    // present says so by falling back to `{ value: undefined }`.
    else if (property.required) problems.push({ kind: 'missing', key })
  }

  const expected = properties.map((p) => p.key)
  if (problems.length > 0) return { ok: false, problems, expected }

  // A schema that does not hand its fields over validates once, at the end, with
  // each issue attributed to the input that carried it. Skipped when anything is
  // already wrong, or one mistake would be reported as two.
  if (own) return { ok: true, value }
  const checked = await validate(schema, value)
  if (checked.ok) return { ok: true, value: checked.value as Record<string, unknown> }
  return { ok: false, problems: checked.issues.map(attribute), expected }
}

/** An issue about the whole object, read as an issue about one of its inputs. */
const attribute = (issue: Issue): Problem => {
  const [head, ...rest] = issue.path ?? []
  const key = head === undefined ? '' : String(typeof head === 'object' ? head.key : head)
  return { kind: 'invalid', key, path: rest.map((s) => String(typeof s === 'object' ? s.key : s)).join('.'), issue }
}
