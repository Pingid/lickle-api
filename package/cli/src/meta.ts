import type { FieldKeys, InputFields, Meta, Operation, PrimitiveKeys } from '@lickle/cmd-core'

/**
 * Command-line configuration, stored under an operation's `meta.cli`.
 *
 * It lives here rather than on `Operation` because it is this target's policy:
 * MCP has no notion of positional arguments, and a GitHub Action's inputs are
 * always named. Core neither declares nor reads this key.
 */
export interface CliMeta {
  /** Which inputs may be given by position, in order. */
  positionals?: readonly string[]
}

export const CLI_META = 'cli'

export const cliMeta = (op: Operation): CliMeta => (op.meta?.[CLI_META] as CliMeta | undefined) ?? {}

export const positionalsOf = (op: Operation): readonly string[] => cliMeta(op).positionals ?? []

/**
 * Which inputs may be given by position, in order.
 *
 * Only the last may be a `list`, since it takes everything left over — so every
 * earlier entry has to name an input of primitive kind.
 */
export type Positionals<O extends Operation> = O['inputs'] extends InputFields
  ? [...PrimitiveKeys<O['inputs']>[], FieldKeys<O['inputs']>]
  : never

/**
 * Attach command-line configuration to an operation, checking the positional
 * keys against its inputs.
 *
 * ```ts
 * cli({ name: 'add', description: 'Add a task.', inputs: { title } }, { positionals: ['title'] })
 * ```
 *
 * Writing `meta: { cli: { … } }` inline works too; this is the spelling that
 * catches a positional naming an input that does not exist.
 */
export const cli = <const O extends Operation, const P extends Positionals<O>>(
  op: O,
  meta: { positionals: P },
): O & { meta: Meta } => ({ ...op, meta: { ...op.meta, [CLI_META]: meta } })
