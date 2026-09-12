import { KIND, isList, isOptional, itemOf, hasDefault } from '@lickle/cmd-core'
import type { InputField, Type } from '@lickle/cmd-core'

/** A flag that takes no value on the command line: `bool` or `optional(bool)`. */
export const isBoolFlag = (k: Type): boolean => !isList(k) && itemOf(k).type === KIND.bool

/**
 * Whether a value must be given on the command line.
 *
 * This is CLI policy rather than a property of the spec: the parser substitutes
 * `false` for an absent bool and `[]` for an absent list, so neither is ever
 * demanded. Other targets compose their own rule from the core primitives.
 */
export const isRequired = (f: InputField): boolean =>
  !hasDefault(f) && !isOptional(f.kind) && !isList(f.kind) && !isBoolFlag(f.kind)

/** Human-readable type for help output: `num`, `string[]`, `string?`. */
export const typeLabel = (k: Type): string =>
  isOptional(k) ? `${itemOf(k).type}?` : isList(k) ? `${itemOf(k).type}[]` : itemOf(k).type
