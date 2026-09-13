import { KIND } from './types.ts'
import type { InputField, List, Optional, OutputField, OutputFields, Primitive, Type } from './types.ts'

export const isOptional = (t: Type): t is Optional<Primitive> => t.kind === KIND.optional

export const isList = (t: Type): t is List<Primitive> => t.kind === KIND.list

/** The underlying primitive of a type, unwrapping `optional` and `list`. */
export const itemOf = (t: Type): Primitive => (isOptional(t) || isList(t) ? t.item : t)

export const hasDefault = (f: InputField): boolean => f.default !== undefined

/*
 * There is deliberately no shared `isRequired` here. Whether an input must be
 * supplied is target policy, not a fact about the operation: a command line
 * substitutes `false` for an absent bool and `[]` for an absent list, so it
 * demands neither, while a GitHub Action input of list kind has no such
 * substitution. Targets pass their rule to `bind` instead.
 */

// ---------------- Folds --------------------------
/**
 * Every case of `Type`, so that a target handles all of them or fails to
 * compile. A `switch` with a `default` silently absorbs a new kind; this does
 * not.
 */
export interface Fold<R> {
  bool: () => R
  string: () => R
  num: () => R
  optional: (item: Primitive) => R
  list: (item: Primitive) => R
}

export const fold = <R>(t: Type, on: Fold<R>): R => {
  switch (t.kind) {
    case KIND.bool:
      return on.bool()
    case KIND.string:
      return on.string()
    case KIND.num:
      return on.num()
    case KIND.optional:
      return on.optional(t.item)
    case KIND.list:
      return on.list(t.item)
  }
}

export type PrimitiveFold<R> = Pick<Fold<R>, 'bool' | 'string' | 'num'>

export const foldPrimitive = <R>(p: Primitive, on: PrimitiveFold<R>): R => {
  switch (p.kind) {
    case KIND.bool:
      return on.bool()
    case KIND.string:
      return on.string()
    case KIND.num:
      return on.num()
  }
}

// ---------------- Outputs --------------------------
const KINDS = new Set<string>(Object.values(KIND))

export const isType = (v: unknown): v is Type => typeof v === 'object' && v !== null && KINDS.has((v as Type).kind)

/**
 * Whether an operation's `outputs` is a single unnamed value rather than a map.
 *
 * Checked by shape rather than by a key test, so a field map that happens to
 * hold a field named `type` or `description` is still read as a map.
 */
export const isOutputField = (o: OutputFields | OutputField): o is OutputField =>
  typeof (o as OutputField).description === 'string' && isType((o as OutputField).type)

/** An operation's outputs as a field map, or `undefined` if it returns one value. */
export const outputFields = (o: OutputFields | OutputField | undefined): OutputFields | undefined =>
  o === undefined || isOutputField(o) ? undefined : o

/** An operation's single output field, or `undefined` if it returns a map. */
export const outputField = (o: OutputFields | OutputField | undefined): OutputField | undefined =>
  o !== undefined && isOutputField(o) ? o : undefined
