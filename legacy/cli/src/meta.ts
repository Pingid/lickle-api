import type {
  Addressable,
  Configured,
  FieldKeys,
  InputFields,
  Meta,
  Operation,
  PrimitiveKeys,
} from '@lickle/api-legacy'

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

export const cliMeta = (node: Addressable): CliMeta => (node.meta?.[CLI_META] as CliMeta | undefined) ?? {}

export const positionalsOf = (node: Addressable): readonly string[] => cliMeta(node).positionals ?? []

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
 * Attach command-line configuration to a bound command, checking the positional
 * keys against its inputs.
 *
 * ```ts
 * const add = cmd({ name: 'add', description: 'Add a task.', inputs: { title } }, handler)
 *
 * ns({ name: 'todo', cmds: [cli(add, { positionals: ['title'] })] })
 * ```
 *
 * It takes the command rather than the operation on purpose: which inputs may be
 * given by position is a choice made where the program is assembled, not a fact
 * about the operation. A library can ship commands and let each consumer decide.
 *
 * There is no `cli()` for a namespace because a namespace has no inputs to place;
 * write `meta: { cli: { … } }` on it directly if some future key needs it.
 */
export const cli = <const C extends Operation & Configured, const P extends Positionals<C>>(
  command: C,
  meta: { positionals: P },
): C & { meta: Meta } => ({ ...command, meta: { ...command.meta, [CLI_META]: meta } })
