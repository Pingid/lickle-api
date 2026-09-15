import type { Operation, Schema } from '@lickle/api'
import { bind, meta, schema as js } from '@lickle/api/util'

import type { FieldMeta, OpMeta } from '../meta.ts'

/**
 * An operation's inputs, as the command line sees them.
 *
 * Everything structural — what a written word should become, whether it repeats,
 * whether it may be left out — is read off the JSON Schema by `@lickle/api/util`
 * and is the same for every target. What is here is only what a command line
 * adds: the spellings a flag answers to, what it is worth when nobody writes it,
 * and the names a terminal uses for the types.
 */

/** One input, as a flag. */
export interface Field {
  key: string
  /** Every spelling that reaches it, `key` first and without dashes. */
  names: string[]
  description: string
  shape: js.Shape
  /** Its own schema, when the operation's input exposes its fields. */
  schema?: Schema
  /** It has to be written: the document requires it and nothing stands in for it. */
  required: boolean
  /** The default the schema itself declares, which help shows. */
  default?: unknown
}

export interface Inputs {
  /** The input schema read once, so binding a call does not read it again. */
  inputs: bind.Inputs
  fields: Field[]
  /** Which inputs may be written by position, in order. */
  positionals: string[]
}

/** Read an operation's inputs the way the command line needs them. */
export const inputsOf = (op: Operation.Any): Inputs => {
  const cli = operationMeta(op)
  const inputs = bind.inputs(op.in)

  const fields = inputs.properties.map((property): Field => {
    const field = property.schema === undefined ? {} : fieldMeta(property.schema)
    const aliases = [...(field.short === undefined ? [] : [field.short]), ...(field.aliases ?? [])]
    return {
      key: property.key,
      names: [...new Set([property.key, ...aliases, ...(cli.aliases?.[property.key] ?? [])])],
      description: property.json.description ?? '',
      shape: property.shape,
      schema: property.schema,
      required: js.defaultOf(property.json) === undefined && fallbackFor(property) === undefined,
      default: js.defaultOf(property.json)?.value,
    }
  })

  return { inputs, fields, positionals: [...(cli.positionals ?? [])].map(String) }
}

/**
 * What an input is worth when it was not written.
 *
 * This is the command line's policy rather than a fact about the operation: a
 * bool that is not passed is `false` and a list that is not repeated is empty,
 * so neither is ever demanded. Another target answers the same question its own
 * way — a tool call substitutes nothing at all — which is why the operation does
 * not answer it.
 *
 * A default the schema declares is not here: `bind` applies that for every
 * target before it asks. What is left is only this target's own standing in,
 * which is why this is `Policy.fallback` as it is written.
 */
export const fallbackFor = (property: js.Property): { value: unknown } | undefined => {
  if (property.shape.list) return { value: [] }
  if (property.shape.type === 'boolean') return { value: false }
  if (property.shape.optional || !property.required) return { value: undefined }
  return undefined
}

// ---------------- Labels ---------------------------------------------------

/** The command line's names for the JSON types, so help reads as a terminal does. */
const LABEL: Record<js.Scalar, string> = {
  string: 'string',
  number: 'num',
  integer: 'int',
  boolean: 'bool',
  null: 'null',
  object: 'json',
  unknown: 'value',
}

const base = (shape: js.Shape): string => (shape.values === undefined ? LABEL[shape.type] : shape.values.join('|'))

/** Type as help writes it: `num`, `string[]`, `string?`, `fast|safe`. */
export const typeLabel = (shape: js.Shape): string =>
  `${base(shape)}${shape.list ? '[]' : ''}${shape.optional ? '?' : ''}`

/** The label inside a flag's angle brackets: `<fast|safe>`, `<string...>`. */
export const valueLabel = (shape: js.Shape): string => `${base(shape)}${shape.list ? '...' : ''}`

// ---------------- Meta -----------------------------------------------------

export const fieldMeta = (schema: Schema): FieldMeta => meta.of<FieldMeta>(schema, 'cli') ?? {}

export const operationMeta = (op: Operation.Any): OpMeta<Operation.Any> =>
  meta.of<OpMeta<Operation.Any>>(op, 'cli') ?? {}
