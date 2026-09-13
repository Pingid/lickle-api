import { KIND, fold, hasDefault, isList, isOptional, itemOf } from '@lickle/cmd-core'
import type { InputField, Type } from '@lickle/cmd-core'

/** A flag that takes no value on the command line: `bool` or `optional(bool)`. */
export const isBoolFlag = (t: Type): boolean => !isList(t) && itemOf(t).kind === KIND.bool

/**
 * Whether a value must be given on the command line.
 *
 * This is CLI policy rather than a property of the operation: the parser
 * substitutes `false` for an absent bool and `[]` for an absent list, so neither
 * is ever demanded. Other targets pass their own rule to `bind`.
 */
export const isRequired = (f: InputField): boolean =>
  !hasDefault(f) && !isOptional(f.type) && !isList(f.type) && !isBoolFlag(f.type)

/** Human-readable type for help output: `num`, `string[]`, `string?`, `fast|safe`. */
export const typeLabel = (t: Type): string =>
  fold(t, {
    bool: () => KIND.bool,
    string: () => KIND.string,
    num: () => KIND.num,
    choice: (values) => values.join('|'),
    optional: (item) => `${typeLabel(item)}?`,
    list: (item) => `${typeLabel(item)}[]`,
  })
