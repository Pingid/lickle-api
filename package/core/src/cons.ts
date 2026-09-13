import { KIND } from './types.ts'
import type { Builder, Command, Handler, InputField, Namespace, Operation, Primitive, Struct, Type } from './types.ts'

// ---------------- Constructors --------------------------
export const op = <const O extends Operation>(o: O) => o

export const type = <const T extends Type>(t: T) => t
export const num = type({ kind: KIND.num })
export const string = type({ kind: KIND.string })
export const bool = type({ kind: KIND.bool })
export const optional = <T extends Primitive>(item: T) => type({ kind: KIND.optional, item })
export const list = <T extends Primitive>(item: T) => type({ kind: KIND.list, item })

/**
 * A field, with `default` and `values` checked against the declared type.
 *
 * The type parameter is the field's own `type`, so `default: 42` on a `string`
 * field is a compile error rather than an `any` that reaches every projection.
 * Output fields use this too — an `InputField` satisfies `OutputField`.
 */
export const field = <const T extends Type>(f: InputField<T>): InputField<T> => f

export const cmd = <const O extends Operation>(o: O, run: Handler<O>): Command<O> => ({ ...o, run })

// ---------------- Command tree --------------------------
/** Narrow a tree node: a namespace holds `cmds`, a command holds a `run`. */
export const isNamespace = (n: Command | Namespace): n is Namespace => 'cmds' in n

/** Identity, for inference — keeps a tree literal's names and shape. */
export const ns = <const N extends Namespace>(n: N) => n

// ---------------- Builder --------------------------
/**
 * A fluent alternative to an operation literal.
 *
 * Built from plain objects rather than a Proxy: a Proxy that answers every
 * property access with a setter also answers `then`, which makes the builder an
 * accidental thenable that never settles when awaited.
 */
export const build = <N extends string>(name: N): Builder<{ name: N }> => make({ name }) as Builder<{ name: N }>

const make = (o: Struct): Struct => ({
  description: (d: unknown) => make({ ...o, description: d }),
  inputs: (i: unknown) => make({ ...o, inputs: i }),
  outputs: (v: unknown) => make({ ...o, outputs: v }),
  meta: (m: unknown) => make({ ...o, meta: m }),
  op: () => o,
  cmd: (run: unknown) => ({ ...o, run }),
})
