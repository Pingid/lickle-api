import { t, type Api, type Namespace, type Operation, type Schema, type Tp, type Type } from '@lickle/api'
import { meta, api } from '@lickle/api/util'

import type { FieldMeta } from './meta.ts'

/**
 * A command, written the way a command line wants to be written: flags with
 * short names, some of them placeable by position, and a handler that prints
 * rather than returns.
 *
 * `cmd` compiles it to an operation and hangs it off the command under the api
 * key, so the same declaration is a command here and a tool everywhere else.
 * Nothing about it is a second source of truth — the operation is derived, never
 * written twice.
 */
export interface Cmd<
  N extends string = string,
  A extends Cmd.Args = Cmd.Args,
  P extends Cmd.Positional<A> = Cmd.Positional<A>,
> {
  name: N
  description: string
  args: A
  positional?: P
  handle: (args: Cmd.InferArgs<A>) => Promise<void>
}

export declare namespace Cmd {
  export interface CmdOp<N extends string = string, A extends Args = Args, P extends Positional<A> = Positional<A>>
    extends Cmd<N, A, P>, Api<Operation<N, Type.Object<{ [K in keyof A]: A[K]['type'] }>, Type.Void>> {}

  export type Args = Record<string, Arg>

  type PrimType = Type.Number | Type.String | Type.Boolean | Type.Enum<string>
  export type Type = PrimType | Type.Array<PrimType> | Type.Union<PrimType | Type.Undefined>

  export type InferArgs<A extends Args> = { [K in keyof A]: Schema.InferOutput<A[K]['type']> }
  export type Opts = FieldMeta
  export type Arg = FieldMeta & { description?: string; type: Type }

  /**
   * Which args may be written by position, in order.
   *
   * Only the last may be a list, since it takes everything left over — so every
   * earlier entry has to name an arg of a single value.
   */
  export type Positional<A extends Args> = [...One<A>[], One<A> | Many<A>]

  type One<A extends Args> = { [K in keyof A]: A[K]['type'] extends Type.Array<any> ? never : K }[keyof A]
  type Many<A extends Args> = { [K in keyof A]: A[K]['type'] extends Type.Array<any> ? K : never }[keyof A]
}

/**
 * Put anything into a command tree.
 *
 * A `Cmd` is compiled to the operation it describes. An operation or a namespace
 * built with `@lickle/api` is already one and passes straight through, so a
 * tree can mix commands written for this target with operations written for no
 * target in particular.
 */
export const cmd: {
  <const N extends string, const A extends Cmd.Args, const P extends Cmd.Positional<A>>(
    p: Cmd<N, A, P>,
  ): Cmd.CmdOp<N, A, P>
  <N extends string, I extends Operation.Input = Operation.Input, O extends Operation.Output = Operation.Output>(
    p: Operation<N, I, O> & Api<Operation<N, I, O>>,
  ): Operation<N, I, O> & Api<Operation<N, I, O>>
  <const O extends Api<Namespace>>(p: O): O
} = (p: any): any => {
  if (!isCmd(p)) return p

  // The args become the operation's input object, carrying their description in
  // the schema itself and their command-line spellings as this target's meta —
  // so everything the runner needs it reads back off the operation.
  const properties: Record<string, Schema> = {}
  for (const [key, arg] of Object.entries(p.args as Cmd.Args)) {
    const type = arg.type as Schema
    if (arg.description !== undefined) meta.update(type, { description: arg.description })
    const field: FieldMeta = {}
    if (arg.short !== undefined) field.short = arg.short
    if (arg.aliases !== undefined) field.aliases = arg.aliases
    if (Object.keys(field).length > 0) meta.update(type, { meta: { cli: [field] } })
    properties[key] = type
  }

  const operation = t.op({
    name: p.name,
    description: p.description,
    in: t.object(properties),
    out: t.empty(),
    handle: p.handle,
  } as any)

  if (p.positional !== undefined) meta.update(operation, { meta: { cli: [{ positionals: p.positional }] } })

  return api.on(p, operation as any)
}

/** A command written here has `args`; an operation or a namespace does not. */
const isCmd = (p: unknown): p is Cmd => typeof p === 'object' && p !== null && 'args' in p && 'handle' in p

export const flag = (description?: string) => t.boolean(description)
export const string = (description?: string) => t.string(description)
export const num = (description?: string) => t.number(description)

/** A closed set: the handler sees the members, not just `string`. */
export const choice = <const T extends string[]>(members: T, description?: string) => t.set(members, description)

/**
 * Repeated on the command line: `-t home -t errands`. Absent means empty.
 *
 * The item-less form is a separate, non-generic signature on purpose: an arg's
 * declared type is `Cmd.Type`, and a generic return would be inferred from that
 * context — making `list()` a list of anything a command line can express
 * rather than a list of strings.
 */
export const list: {
  (description?: string): Tp<Type.Array<Type.String>>
  <T extends Schema>(of: T, description?: string): Tp<Type.Array<T>>
} = (of?: Schema | string, description?: string): any =>
  typeof of === 'object' ? t.array(of, description) : t.array(string(), of)

/** May be left out entirely, which is not the same as having a default. */
export const optional = <T extends Schema>(of: T, description?: string) => t.union([of, t.undefined()], description)
