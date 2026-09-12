import { KIND } from './types.ts'
import type { InputField, List, Optional, Primitive, Type } from './types.ts'

export const isOptional = (k: Type): k is Optional<Primitive> => k.type === KIND.optional

export const isList = (k: Type): k is List<Primitive> => k.type === KIND.list

/** The underlying primitive of a type, unwrapping `optional` and `list`. */
export const itemOf = (k: Type): Primitive => (isOptional(k) || isList(k) ? k.item : k)

export const hasDefault = (f: InputField): boolean => f.default !== undefined

/*
 * There is deliberately no shared `isRequired` here. Whether an input must be
 * supplied is target policy, not a fact about the spec: the CLI treats `bool`
 * and `list` inputs as never-required because its parser substitutes `false`
 * and `[]`, while a GitHub Action input of list kind has no such default.
 * Targets compose the primitives above into their own rule.
 */
