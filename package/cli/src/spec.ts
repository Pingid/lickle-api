import type { Cmd } from '@lickle/cmd-core'

export * from '@lickle/cmd-core'

/**
 * A group of commands.
 *
 * A named group occupies one segment of the command path (`app db migrate`); an
 * unnamed group is a plain container whose commands live in its parent's
 * namespace, which is what the root of a CLI usually is.
 */
export interface SubCmds {
  name?: string
  description?: string
  cmds: ReadonlyArray<Cmd | SubCmds>
}

export const isSubCmds = (c: Cmd | SubCmds): c is SubCmds => 'cmds' in c

export const commands = <const C extends SubCmds>(cmds: C) => cmds

declare module '@lickle/cmd-core/types' {
  export type PositionalsSpec<D extends FieldsSpec> = [...Fields.Primitives<D>[], Fields.Types<D>]

  type SpecInputs<S> = S extends { inputs: infer I } ? (I extends FieldsSpec ? I : never) : never

  export interface Spec {
    positionals?: string[]
  }

  /**
   * A fixed set of accepted values. The parser rejects anything else, help
   * renders them as `<a|b|c>`, and completions offer them after the flag.
   */
  export interface InputField<T extends Type = Type> {
    values?: string[]
  }
  interface BaseBuilder<S extends Struct> {
    positionals: <D extends PositionalsSpec<SpecInputs<S>>>(d: D) => Builder<S & { positionals: D }>
  }
}
