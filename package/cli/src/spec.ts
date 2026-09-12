export * from '@lickle/cmd-core'

declare module '@lickle/cmd-core/types' {
  export type PositionalsSpec<D extends FieldsSpec> = [...Fields.Primitives<D>[], Fields.Types<D>]

  type SpecInputs<S> = S extends { inputs: infer I } ? (I extends FieldsSpec ? I : never) : never

  /** Which inputs may be given by position, in order. A command-line concept. */
  export interface Spec {
    positionals?: string[]
  }
  interface BaseBuilder<S extends Struct> {
    positionals: <D extends PositionalsSpec<SpecInputs<S>>>(d: D) => Builder<S & { positionals: D }>
  }
}
