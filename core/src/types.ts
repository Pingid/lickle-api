export const KIND = {
  bool: "bool",
  string: "string",
  num: "num",
  optional: "optional",
  list: "list",
} as const;

export interface Spec {
  name: string;
  description: string;
  inputs?: InputsSpec;
  outputs?: OutputsSpec;
}

export interface FieldsSpec extends Record<string, Field> {}

export interface InputsSpec extends Record<string, InputField> {}

export interface OutputsSpec extends Record<string, OutputField> {}

export interface Field {
  d: string;
  kind: Type;
}

export interface InputField<T extends Type = Type> extends Field {
  default?: any;
  alias?: string[];
  kind: T;
}

export interface OutputField<T extends Type = Type> extends Field {
  kind: T;
}

export interface Primitive {
  type: typeof KIND.bool | typeof KIND.string | typeof KIND.num;
}

export interface Optional<T extends Primitive> {
  type: typeof KIND.optional;
  item: T;
}

export interface List<T extends Primitive> {
  type: typeof KIND.list;
  item: T;
}

export type Type = Primitive | Optional<Primitive> | List<Primitive>;

// ---------------- Command --------------------------
export interface Cmd {
  spec: Spec;
  run: Run<this["spec"]>;
}

export type Run<S extends Spec> = (
  ...args: S["inputs"] extends InputsSpec ? [Fields<S["inputs"]>] : []
) => S["outputs"] extends OutputsSpec ? Result<Fields<S["outputs"]>>
  : Result<void>;
export type Result<T> = T | Promise<T>;

// ---------------- Builder --------------------------
export type Builder<S extends Record<string, unknown>> =
  & BaseBuilder<S>
  & (S extends Spec ? Build<S> : Struct<never>);

interface Build<S extends Spec> {
  cmd: (run: Run<S>) => { spec: Computed<S>; run: Run<S> };
  spec: () => Computed<S>;
}

export interface BaseBuilder<S extends Struct> {
  description: <T extends string>(d: T) => Builder<S & { description: T }>;
  inputs: <D extends FieldsSpec>(d: D) => Builder<S & { inputs: D }>;
  outputs: <D extends FieldsSpec>(d: D) => Builder<S & { outputs: D }>;
}

// ---------------- Inference --------------------------
export type Fields<D extends Record<string, Field>> =
  & {
    [K in FieldReq<D>["r"]]: FieldTypes<D>[K];
  }
  & { [K in FieldReq<D>["o"]]?: FieldTypes<D>[K] };

export type Inputs<S extends Spec> = S["inputs"] extends InputsSpec ? Fields<S["inputs"]>
  : never;

export type Outputs<S extends Spec> = S["outputs"] extends OutputsSpec ? Fields<S["outputs"]>
  : never;

export declare namespace Fields {
  export type Primitives<D extends FieldsSpec> = {
    [K in keyof D]: D[K]["kind"] extends Primitive ? K : never;
  }[keyof D];
  export type Types<D extends FieldsSpec> = { [K in keyof D]: K }[keyof D];
}

type TypeOfType<T extends Type> = T["type"] extends typeof KIND.bool ? boolean
  : T["type"] extends typeof KIND.string ? string
  : T["type"] extends typeof KIND.num ? number
  : T extends Optional<infer T> ? TypeOfType<T> | undefined
  : T extends List<infer T> ? TypeOfType<T>[]
  : never;

type FieldReq<D extends Record<string, Field>> = {
  [K in keyof D]: D[K]["kind"] extends "optional" ? { r: never; o: K }
    : { r: K; o: never };
}[keyof D];
type FieldTypes<D extends Record<string, Field>> = {
  [K in keyof D]: TypeOfType<D[K]["kind"]>;
};

// ---------------- Type utils --------------------------
export type Intersect<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void ? I
  : never;
export type Struct<V = any> = Record<string, V>;
export type Computed<T> = { [K in keyof T]: T[K] } & {};
