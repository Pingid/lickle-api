import type { Operation, Op, Schema, Tp, Type } from '@lickle/api'

// Imported so the blocks below augment `@lickle/api/meta` rather than shadow it.
import '@lickle/api/meta'

/**
 * Command-line configuration for a single input.
 *
 * It lives under the `cli` meta key rather than on the type because it is this
 * target's policy: MCP has no notion of a short flag, and a GitHub Action's
 * inputs are always named in full. Core neither declares nor reads it.
 */
export interface FieldMeta {
  aliases?: string[]
  short?: string
}

declare module '@lickle/api/meta' {
  export interface TypeMeta<T> {
    cli: (m: FieldMeta) => Tp<T>
  }
}

/**
 * Command-line configuration for an operation.
 *
 * Which inputs may be given by position is a choice made where a program is
 * assembled, not a fact about the operation — so a library can ship operations
 * and let each consumer decide its own ergonomics.
 */
export interface OpMeta<T extends Operation.Any> {
  positionals?: Positionals<T['in']>
  aliases?: { [K in keyof T['in']['properties']]?: string[] }
}

declare module '@lickle/api/meta' {
  export interface OperationMeta<T> {
    cli: (m: OpMeta<T extends Operation.Any ? T : Operation.Any>) => Op<T>
  }
}

type FieldsOf<T extends Schema, Extract extends 'Array' | 'Other' = 'Other'> =
  T extends Type.Object<any>
    ? {
        [K in keyof T['properties']]: T['properties'][K] extends Type.Array<any>
          ? { Array: K; Other: never }[Extract]
          : { Array: never; Other: K }[Extract]
      }[keyof T['properties']]
    : never

type Positionals<T extends Schema> = [...FieldsOf<T>[], FieldsOf<T> | FieldsOf<T, 'Array'>]
