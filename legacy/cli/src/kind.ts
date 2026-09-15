import { hasDefault, shapeOf } from '@lickle/api-legacy'
import type { FieldType, InputField } from '@lickle/api-legacy'

/** A flag that takes no value on the command line: anything boolean-shaped. */
export const isBoolFlag = (t: FieldType): boolean => {
  const shape = shapeOf(t)
  return !shape.list && shape.type === 'boolean'
}

/** A flag that may be given more than once, building a list. */
export const isListFlag = (t: FieldType): boolean => shapeOf(t).list

/**
 * Whether a value must be given on the command line.
 *
 * This is CLI policy rather than a property of the operation: the parser
 * substitutes `false` for an absent bool and `[]` for an absent list, so neither
 * is ever demanded. Other targets pass their own rule to `bind`.
 */
export const isRequired = (f: InputField): boolean => {
  const shape = shapeOf(f.type)
  return !hasDefault(f) && !shape.optional && !shape.list && shape.type !== 'boolean'
}

/**
 * Human-readable type for help output: `num`, `string[]`, `string?`, `fast|safe`.
 *
 * Built from the shape rather than the kind, so a zod-typed input labels itself
 * from the JSON Schema it emits.
 */
export const typeLabel = (t: FieldType): string => {
  const { type, list, optional, values } = shapeOf(t)
  const base = values !== undefined ? values.join('|') : (LABEL[type ?? 'unknown'] ?? 'value')
  return `${base}${list ? '[]' : ''}${optional ? '?' : ''}`
}

/** The command line's names for the JSON types, kept from core's own vocabulary. */
const LABEL: Record<string, string> = { string: 'string', number: 'num', boolean: 'bool' }

/** The label used inside a flag's angle brackets: `<fast|safe>`, `<string...>`. */
export const valueLabel = (t: FieldType): string => {
  const { type, list, values } = shapeOf(t)
  const base = values !== undefined ? values.join('|') : (LABEL[type ?? 'unknown'] ?? 'value')
  return `${base}${list ? '...' : ''}`
}
