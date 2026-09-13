import { InputError, bind } from '@lickle/cmd-core'
import type { InputFields, Operation } from '@lickle/cmd-core'

/**
 * Check an incoming `arguments` object against an operation's inputs and fill in
 * defaults.
 *
 * The per-value work belongs to the field's own type, which is a Standard Schema
 * and validates itself — so a zod schema on a field applies here exactly as it
 * does on a command line, and neither target can drift from the other. What is
 * left here is the one rule that is this target's: a tool call substitutes
 * nothing for an absent input, and naming an unexpected one is worth doing well
 * because a model reads it and corrects itself.
 */
export const bindArgs = async (op: Operation, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
  const inputs: InputFields = op.inputs ?? {}

  const unknown = Object.keys(args).filter((key) => !(key in inputs))
  if (unknown.length > 0)
    throw new InputError(`unknown ${plural('argument', unknown.length)} ${list(unknown)}; expected ${expected(inputs)}`)

  return bind(inputs, args, { missing: (_field, key) => `missing required argument '${key}'` })
}

const list = (items: readonly string[]): string => items.map((i) => `'${i}'`).join(', ')

const expected = (inputs: InputFields): string => {
  const keys = Object.keys(inputs)
  return keys.length === 0 ? 'no arguments' : list(keys)
}

const plural = (word: string, n: number): string => (n === 1 ? word : `${word}s`)
