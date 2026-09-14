import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec'
import type { Computed, Intersect } from './util/index.ts'

const API = `@lickle/api:1.0.0`

export const apiOf: {
  <T extends AnyOperation | Namespace>(t: T | Api<T>): T
  <T extends AnyOperation | Namespace>(t?: T | Api<T> | undefined): T | undefined
} = <T extends AnyOperation | Namespace>(t: T | Api<T>): T => {
  if (t === undefined) return undefined as any
  if ((t as any)[API]) return (t as any)[API]
  return t as any
}
export const apiAs: {
  <T extends AnyOperation | Namespace>(t: T | Api<T>): Api<T>
  <T extends AnyOperation | Namespace>(t?: T | Api<T> | undefined): Api<T> | undefined
} = <T extends AnyOperation | Namespace>(t: T | Api<T>): Api<T> => {
  if (t === undefined) return undefined as any
  if ((t as any)[API]) return t as any
  return { [API]: t } as any
}

export interface Api<T extends AnyOperation | AnyNamespace = AnyOperation | AnyNamespace> {
  [API]: T
}
export declare namespace Api {
  export type Extract<T> = T extends Api ? T[typeof API] : T
  export type Wrap<T extends AnyOperation | AnyNamespace | Api> = T extends AnyOperation | AnyNamespace ? Api<T> : T
}

export type AnyOperation = Operation<any, any, any>

export interface Operation<N extends string, I extends Input = Input, O extends Output = Output>
  extends Operation.Schema<N, I, O>, Operation.Handler<Input.Infer<I>, Output.Infer<O>> {}

export declare namespace Operation {
  export interface Schema<N extends string, I, O> {
    name: N
    description?: string
    in: I
    out: O
    config?: Record<string, any>
  }

  export interface Handler<I, O> {
    handle: (input: I) => O
  }
}

export type AnyNamespace = Namespace<any, any>
export interface Namespace<
  N extends string = string,
  O extends (Api<any> | AnyOperation | AnyNamespace)[] = (Api<any> | AnyOperation | AnyNamespace)[],
> {
  _type?: 'namespace'
  name: N
  description?: string
  operations: O
  config?: Record<string, any>
}

export declare namespace Namespace {
  type DecendTree<T, Sep extends string = '/', N extends string = ''> =
    T extends Api<infer I>
      ? DecendTree<I, Sep, N>
      : T extends AnyOperation
        ? { [ky in `${N}${Sep}${T['name']}`]: T }
        : T extends AnyNamespace
          ? DecendTree<T['operations'][number], Sep, `${N}${Sep}${T['name']}`>
          : never

  export type FlattenTree<T, Sep extends string = '/'> = Computed<Intersect<DecendTree<T, Sep>>>
}

export interface Input extends Schema<unknown, Record<string, any>> {}

export declare namespace Input {
  type Infer<S extends Input> = Schema.InferOutput<S>
}

export interface Output extends Schema {
  returns?: 'sync' | 'async-iter'
}

export declare namespace Output {
  export type Returns = 'sync' | 'async-iter'

  export type Infer<S extends Output> = S['returns'] extends 'async-iter'
    ? AsyncIterable<Schema.InferOutput<S>>
    : S['returns'] extends 'sync'
      ? Schema.InferOutput<S>
      : Promise<Schema.InferOutput<S>>
}

interface Standard<I = unknown, O = I> extends StandardJSONSchemaV1<I, O> {
  readonly '~standard': StandardJSONSchemaV1.Props<I, O> & Partial<StandardSchemaV1.Props<I, O>>
}

export interface Schema<Input = unknown, Output = Input> extends Standard<Input, Output> {
  description?: string
  config?: Record<string, any>
  default?: Output
}

export declare namespace Schema {
  type InferInput<S extends StandardJSONSchemaV1> = StandardJSONSchemaV1.InferInput<S>
  type InferOutput<S extends StandardJSONSchemaV1> = StandardJSONSchemaV1.InferOutput<S>
  type Props<I, O> = StandardJSONSchemaV1.Props<I, O>
}

export declare namespace Type {
  export interface Void extends Schema<unknown, void> {
    type: 'void'
  }

  export interface Number extends Schema<unknown, number> {
    type: 'number'
  }

  export interface String extends Schema<unknown, string> {
    type: 'string'
  }

  export interface Boolean extends Schema<unknown, boolean> {
    type: 'boolean'
  }

  export interface Null extends Schema<unknown, null> {
    type: 'null'
  }

  export interface Undefined extends Schema<unknown, undefined> {
    type: 'undefined'
  }

  export interface Unknown extends Schema<unknown, unknown> {
    type: 'unknown'
  }

  export interface Any extends Schema<unknown, any> {
    type: 'any'
  }

  export interface Array<T extends Schema = Schema> extends Schema<unknown, Schema.InferOutput<T>[]> {
    type: 'array'
    items: T
  }

  export interface Enum<T extends string> extends Schema<unknown, T> {
    type: 'enum'
    enum: T[]
  }

  export interface Union<T extends Schema> extends Schema<unknown, Schema.InferOutput<T>> {
    type: 'union'
    oneOf: T[]
  }

  export interface Object<T extends Fields> extends Schema<unknown, Fields.Infer<T>> {
    type: 'object'
    properties: T
  }

  export type Builtin =
    | Void
    | Number
    | String
    | Boolean
    | Null
    | Undefined
    | Unknown
    | Any
    | Array
    | Enum<string>
    | Union<any>
    | Object<any>
}

export interface Fields extends Record<string, Fields.Field> {}

export declare namespace Fields {
  export type Field = Schema & { optional?: true }

  export type Properties = Record<string, Field>

  type Keys<T extends Properties, Kind extends 'O' | 'R' = 'R'> = {
    [K in keyof T]: T[K] extends [never]
      ? { O: never; R: never }[Kind]
      : T[K] extends { O: true }
        ? { O: K; R: never }[Kind]
        : { O: never; R: K }[Kind]
  }[keyof T]

  export type Infer<T extends Properties> = Compute<
    { [K in Keys<T, 'R'>]: Schema.InferOutput<T[K]> } & {
      [K in Keys<T, 'O'>]?: Schema.InferOutput<T[K]> | undefined
    }
  >
  type Compute<T> = { [K in keyof T]: T[K] } & {}
}
