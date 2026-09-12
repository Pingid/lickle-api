import { Cmd } from "@lickle/cmd-core";

export * from "@lickle/cmd-core";

export interface SubCmds {
  cmds: ReadonlyArray<Cmd | SubCmds>;
}

declare module "@lickle/cmd-core/types" {
  export type PositionalsSpec<D extends FieldsSpec> = [
    ...Fields.Primitives<D>[],
    Fields.Types<D>,
  ];

  type SpecInputs<S> = S extends { inputs: infer I } ? I extends FieldsSpec ? I
    : never
    : never;

  export interface Spec {
    positionals?: string[];
  }
  interface BaseBuilder<S extends Struct> {
    positionals: <D extends PositionalsSpec<SpecInputs<S>>>(
      d: D,
    ) => Builder<S & { positionals: D }>;
  }
}
