import { KIND } from '@lickle/cmd-core'
import type { InputField, List, Optional, Primitive, Type } from '@lickle/cmd-core'

export const isOptional = (k: Type): k is Optional<Primitive> => k.type === KIND.optional

export const isList = (k: Type): k is List<Primitive> => k.type === KIND.list

/** The underlying primitive of a type, unwrapping `optional` and `list`. */
export const itemOf = (k: Type): Primitive => (isOptional(k) || isList(k) ? k.item : k)

/** A flag that takes no value on the command line: `bool` or `optional(bool)`. */
export const isBoolFlag = (k: Type): boolean => !isList(k) && itemOf(k).type === KIND.bool

/**
 * Whether a value must be supplied. Optionals, lists, bools and anything with a
 * default can all be omitted; everything else is required.
 */
export const isRequired = (f: InputField): boolean =>
  f.default === undefined && !isOptional(f.kind) && !isList(f.kind) && !isBoolFlag(f.kind)

/** Human-readable type for help output: `num`, `string[]`, `string?`. */
export const typeLabel = (k: Type): string =>
  isOptional(k) ? `${itemOf(k).type}?` : isList(k) ? `${itemOf(k).type}[]` : itemOf(k).type
