import { KIND } from '@lickle/cmd-core'
import type { InputField, InputsSpec, Primitive, Spec } from '@lickle/cmd-core'
import { CliError } from './errors.ts'
import { isBoolFlag, isList, isOptional, itemOf } from './kind.ts'
import { isFormat, type Format } from './output.ts'

/** Flags every command answers to, regardless of its spec. */
export const RESERVED = ['help', 'h', 'output', 'o'] as const

export interface ParsedArgs {
  /** Inputs coerced to the types declared by the spec, defaults applied. */
  inputs: Record<string, unknown>
  /** `--help` / `-h` was given; the runner prints help instead of running. */
  help: boolean
  /** `--output` / `-o`, defaulting to `text`. */
  output: Format
}

/**
 * Find `--output`/`-o` in a raw argv, ignoring everything else.
 *
 * Parsing can fail before it reaches the output flag — or before a command is
 * even resolved — so the runner peeks first to report those failures in the
 * format that was asked for. `parseArgs` remains authoritative once it succeeds.
 */
export const peekFormat = (argv: string[]): Format => {
  let format: Format = 'text'
  for (const [i, arg] of argv.entries()) {
    if (arg === '--') break
    const raw =
      arg === '--output' || arg === '-o'
        ? argv[i + 1]
        : arg.startsWith('--output=')
          ? arg.slice('--output='.length)
          : arg.startsWith('-o') && arg !== '-o'
            ? arg.slice(arg.startsWith('-o=') ? 3 : 2)
            : undefined
    if (raw !== undefined && isFormat(raw)) format = raw
  }
  return format
}

/**
 * Parse `argv` (already stripped of the command path) against a spec.
 *
 * Supports `--name value`, `--name=value`, `-n value`, `-n=value`, grouped short
 * bool flags (`-abc`), `--no-name` to clear a bool, repeated flags to build a
 * list, and `--` to end flag parsing. Positionals are bound to the input keys
 * named by `spec.positionals`, in order.
 *
 * When `--help` is present, parsing stops short of validating required inputs —
 * asking for help should never be an error.
 */
export const parseArgs = (spec: Spec, argv: string[]): ParsedArgs => {
  const inputs: InputsSpec = spec.inputs ?? {}
  assertNoReservedNames(spec, inputs)

  const byFlag = new Map<string, string>()
  for (const [key, field] of Object.entries(inputs)) {
    byFlag.set(key, key)
    for (const alias of field.alias ?? []) byFlag.set(alias, key)
  }

  const values = new Map<string, unknown>()
  const positionalArgs: string[] = []
  let help = false
  let output: Format = 'text'
  let i = 0

  const next = (): string | undefined => argv[i++]

  const addValue = (key: string, field: InputField, raw: string): void => {
    if (field.values !== undefined && !field.values.includes(raw))
      throw new CliError(`invalid value for '${key}': '${raw}' (expected ${oneOf(field.values)})`)

    if (isList(field.kind)) {
      const list = (values.get(key) as unknown[]) ?? []
      list.push(coerce(field.kind.item, raw, key))
      values.set(key, list)
    } else {
      values.set(key, coerce(itemOf(field.kind), raw, key))
    }
  }

  /**
   * Consume one flag. Returns true when it used `inline` as its value.
   *
   * `explicit` distinguishes a value written with `=` from the tail of a short
   * cluster: in `-fv` the `v` is another flag, not the value of `-f`.
   */
  const takeFlag = (name: string, display: string, inline: string | undefined, explicit: boolean): boolean => {
    if (name === 'help' || name === 'h') {
      help = true
      return false
    }
    if (name === 'output' || name === 'o') {
      const raw = inline ?? next()
      if (raw === undefined) throw new CliError(`option '${display}' requires a value`)
      if (!isFormat(raw)) throw new CliError(`invalid value for '${display}': '${raw}' (expected 'text' or 'json')`)
      output = raw
      return inline !== undefined
    }

    const key = byFlag.get(name)
    const field = key === undefined ? undefined : inputs[key]
    if (key === undefined || field === undefined) throw new CliError(`unknown option '${display}'`)

    if (isBoolFlag(field.kind)) {
      const given = explicit && inline !== undefined
      values.set(key, given ? parseBool(inline!, display) : true)
      return given
    }

    const raw = inline ?? next()
    if (raw === undefined) throw new CliError(`option '${display}' requires a value`)
    addValue(key, field, raw)
    return inline !== undefined
  }

  let flagsEnded = false
  while (i < argv.length) {
    const arg = argv[i++]!

    if (flagsEnded || arg === '-' || !arg.startsWith('-')) {
      positionalArgs.push(arg)
      continue
    }
    if (arg === '--') {
      flagsEnded = true
      continue
    }

    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
      const inline = eq === -1 ? undefined : arg.slice(eq + 1)

      // `--no-verbose` clears a bool without taking a value.
      const negated = name.startsWith('no-') ? byFlag.get(name.slice(3)) : undefined
      const negatedField = negated === undefined ? undefined : inputs[negated]
      if (negated !== undefined && negatedField !== undefined && isBoolFlag(negatedField.kind)) {
        values.set(negated, false)
        continue
      }

      takeFlag(name, `--${name}`, inline, true)
      continue
    }

    // Short flags: `-n=value`, or a cluster where each char is a flag and the
    // first one that takes a value swallows the rest of the cluster.
    const body = arg.slice(1)
    if (body[1] === '=') {
      takeFlag(body[0]!, `-${body[0]}`, body.slice(2), true)
      continue
    }
    for (let c = 0; c < body.length; c++) {
      const rest = body.slice(c + 1)
      if (takeFlag(body[c]!, `-${body[c]}`, rest === '' ? undefined : rest, false)) break
    }
  }

  if (help) return { inputs: {}, help, output }

  const positionals = spec.positionals ?? []
  let p = 0
  for (const [index, key] of positionals.entries()) {
    const field = inputs[key]
    if (field === undefined) throw new Error(`spec '${spec.name}': positional '${key}' is not declared in inputs`)

    if (index === positionals.length - 1 && isList(field.kind)) {
      for (; p < positionalArgs.length; p++) addValue(key, field, positionalArgs[p]!)
      continue
    }
    if (p < positionalArgs.length) {
      if (values.has(key)) throw new CliError(`'${key}' was given both as an option and as an argument`)
      addValue(key, field, positionalArgs[p]!)
      p++
    }
  }
  if (p < positionalArgs.length) throw new CliError(`unexpected argument '${positionalArgs[p]}'`)

  const positionalKeys = new Set<string>(positionals)
  const result: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(inputs)) {
    if (values.has(key)) {
      result[key] = values.get(key)
    } else if (field.default !== undefined) {
      result[key] = field.default
    } else if (isList(field.kind)) {
      result[key] = []
    } else if (isBoolFlag(field.kind)) {
      result[key] = false
    } else if (!isOptional(field.kind)) {
      throw new CliError(
        positionalKeys.has(key) ? `missing required argument '<${key}>'` : `missing required option '--${key}'`,
      )
    }
  }

  return { inputs: result, help, output }
}

const coerce = (kind: Primitive, raw: string, key: string): unknown => {
  switch (kind.type) {
    case KIND.num: {
      const n = Number(raw)
      if (raw.trim() === '' || Number.isNaN(n)) throw new CliError(`'${key}' expects a number, got '${raw}'`)
      return n
    }
    case KIND.bool:
      return parseBool(raw, key)
    default:
      return raw
  }
}

/** `'a', 'b' or 'c'` — the tail of an "expected …" message. */
export const oneOf = (values: readonly string[]): string => {
  const quoted = values.map((v) => `'${v}'`)
  const last = quoted.pop()
  return quoted.length === 0 ? (last ?? '') : `${quoted.join(', ')} or ${last}`
}

const parseBool = (raw: string, display: string): boolean => {
  const v = raw.toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  throw new CliError(`'${display}' expects a boolean, got '${raw}'`)
}

const assertNoReservedNames = (spec: Spec, inputs: InputsSpec): void => {
  for (const [key, field] of Object.entries(inputs)) {
    for (const name of [key, ...(field.alias ?? [])]) {
      if ((RESERVED as readonly string[]).includes(name))
        throw new Error(`spec '${spec.name}': input '${key}' uses reserved flag name '${name}'`)
    }
  }
}
