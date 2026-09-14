import { bind } from '@lickle/cmd-core'
import type { Configured, InputField, InputFields, Policy } from '@lickle/cmd-core'
import { CliError } from './errors.ts'
import { isBoolFlag, isListFlag } from './kind.ts'
import { positionalsOf } from './meta.ts'
import { isFormat, type Format } from './output.ts'
import { tokenise } from './tokenise.ts'

/** Flags every command answers to, regardless of its operation. */
export const RESERVED = ['help', 'h', 'output', 'o'] as const

const isHelpFlag = (name: string): boolean => name === 'help' || name === 'h'
const isOutputFlag = (name: string): boolean => name === 'output' || name === 'o'

/**
 * What the parser needs of a node: a name for its diagnostics, whatever inputs
 * it declares, and its command-line configuration. Both a `Command` and a
 * `Namespace` satisfy it — a namespace simply declares no inputs, which is why
 * landing on one still answers the global flags.
 */
export type Parsable = Configured & { name: string; inputs?: InputFields }

export interface ParsedArgs {
  /** Inputs coerced to the types declared by the operation, defaults applied. */
  inputs: Record<string, unknown>
  /** `--help` / `-h` was given; the runner prints help instead of running. */
  help: boolean
  /** `--output` / `-o`, defaulting to `text`. */
  output: Format
}

/**
 * Read `--output`/`-o` out of a raw argv, knowing nothing else about it.
 *
 * Parsing can fail before it reaches the output flag — or before a command is
 * even resolved — so the runner peeks first to report those failures in the
 * format that was asked for. It runs the same grammar as `parseArgs` with only
 * the reserved flags declared, so the two cannot disagree about what was
 * written: `-vo json` reads as `json` here exactly as it does there.
 */
export const peekFormat = (argv: string[]): Format => {
  let format: Format = 'text'
  for (const token of tokenise(argv, isOutputFlag)) {
    const { name, value } = token
    if (name !== undefined && isOutputFlag(name) && typeof value === 'string' && isFormat(value)) format = value
  }
  return format
}

/**
 * Parse `argv` (already stripped of the command path) against an operation.
 *
 * Tokenising is separate from validating: the grammar runs first and produces
 * raw per-key strings, then `bind` hands each to its field's own schema. What is
 * left as this target's policy is only what it substitutes for an absent input —
 * `false` for a bool, `[]` for a list — and how it names one it did not get.
 *
 * Asynchronous because a field's type may be any Standard Schema, and those may
 * validate asynchronously.
 *
 * When `--help` is present, parsing stops short of validating required inputs —
 * asking for help should never be an error.
 */
export const parseArgs = async (op: Parsable, argv: string[]): Promise<ParsedArgs> => {
  const inputs: InputFields = op.inputs ?? {}
  assertNoReservedNames(op, inputs)

  const byFlag = new Map<string, string>()
  for (const [key, field] of Object.entries(inputs)) {
    byFlag.set(key, key)
    for (const alias of field.alias ?? []) byFlag.set(alias, key)
  }

  const fieldFor = (name: string): InputField | undefined => {
    const key = byFlag.get(name)
    return key === undefined ? undefined : inputs[key]
  }

  const takesValue = (name: string): boolean => {
    if (isHelpFlag(name)) return false
    if (isOutputFlag(name)) return true
    const field = fieldFor(name)
    return field !== undefined && !isBoolFlag(field.type)
  }

  const raw: Record<string, unknown> = {}
  const positionalArgs: string[] = []
  let help = false
  let output: Format = 'text'

  for (const { name, display, value } of tokenise(argv, takesValue)) {
    if (name === undefined) {
      positionalArgs.push(value as string)
      continue
    }
    if (isHelpFlag(name)) {
      help = true
      continue
    }
    if (isOutputFlag(name)) {
      if (value === true) throw new CliError(`option '${display}' requires a value`)
      if (!isFormat(value)) throw new CliError(`invalid value for '${display}': '${value}' (expected 'text' or 'json')`)
      output = value
      continue
    }

    // `--no-verbose` clears a bool without taking a value.
    const negated = byFlag.has(name) ? undefined : negatedKey(name, fieldFor)
    if (negated !== undefined) {
      raw[byFlag.get(negated)!] = false
      continue
    }

    const key = byFlag.get(name)
    const field = key === undefined ? undefined : inputs[key]
    if (key === undefined || field === undefined) throw new CliError(`unknown option '${display}'`)

    if (isBoolFlag(field.type)) {
      raw[key] = value
      continue
    }
    if (value === true) throw new CliError(`option '${display}' requires a value`)
    if (isListFlag(field.type)) push(raw, key, value)
    else raw[key] = value
  }

  if (help) return { inputs: {}, help, output }

  bindPositionals(op, inputs, positionalArgs, raw)
  return { inputs: await bind(inputs, raw, policyFor(op)), help, output }
}

/** The name behind `--no-x`, when `x` is a bool flag. */
const negatedKey = (name: string, fieldFor: (n: string) => InputField | undefined): string | undefined => {
  if (!name.startsWith('no-')) return undefined
  const base = name.slice(3)
  const field = fieldFor(base)
  return field !== undefined && isBoolFlag(field.type) ? base : undefined
}

const push = (raw: Record<string, unknown>, key: string, value: string): void => {
  const list = (raw[key] as string[] | undefined) ?? []
  list.push(value)
  raw[key] = list
}

/** Bind leftover positional arguments to the input keys named by `meta.cli`. */
const bindPositionals = (op: Parsable, inputs: InputFields, args: string[], raw: Record<string, unknown>): void => {
  const positionals = positionalsOf(op)
  let p = 0

  for (const [index, key] of positionals.entries()) {
    const field = inputs[key]
    if (field === undefined) throw new Error(`operation '${op.name}': positional '${key}' is not declared in inputs`)

    // Only the last positional may be a list, and it takes everything left.
    if (index === positionals.length - 1 && isListFlag(field.type)) {
      for (; p < args.length; p++) push(raw, key, args[p]!)
      continue
    }
    if (p < args.length) {
      if (raw[key] !== undefined) throw new CliError(`'${key}' was given both as an option and as an argument`)
      raw[key] = args[p]!
      p++
    }
  }

  if (p < args.length) throw new CliError(`unexpected argument '${args[p]}'`)
}

/**
 * The command line's half of the contract with `bind`.
 *
 * Coercion is gone from here: a field's type is a Standard Schema and validates
 * itself, which is what lets a zod schema sit where a core type does. What is
 * left is genuinely this target's — an absent bool is `false`, an absent list is
 * `[]`, and a missing input is named as an argument or an option depending on
 * how it can be given.
 */
const policyFor = (op: Parsable): Policy => {
  const positionals = new Set<string>(positionalsOf(op))
  return {
    fallback: (field) => (isListFlag(field.type) ? [] : isBoolFlag(field.type) ? false : undefined),
    missing: (_field, key) =>
      positionals.has(key) ? `missing required argument '<${key}>'` : `missing required option '--${key}'`,
  }
}

const assertNoReservedNames = (op: Parsable, inputs: InputFields): void => {
  for (const [key, field] of Object.entries(inputs)) {
    for (const name of [key, ...(field.alias ?? [])]) {
      if ((RESERVED as readonly string[]).includes(name))
        throw new Error(`operation '${op.name}': input '${key}' uses reserved flag name '${name}'`)
    }
  }
}
