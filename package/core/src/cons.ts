import type {
  Builder,
  Cmd,
  InputField,
  Inputs,
  OutputField,
  Outputs,
  Primitive,
  Run,
  Spec,
  Struct,
  SubCmds,
  Type,
} from './types.ts'
import { KIND } from './types.ts'

// ---------------- Constructors --------------------------
export const spec = <const T extends Spec>(t: T) => t

export const type = <const T extends Type>(t: T) => t
export const num = type({ type: KIND.num })
export const string = type({ type: KIND.string })
export const bool = type({ type: KIND.bool })
export const optional = <T extends Primitive>(item: T) => type({ type: KIND.optional, item })
export const list = <T extends Primitive>(item: T) => type({ type: KIND.list, item })

export const field = <const T extends InputField | OutputField>(t: T) => t

export const cmdFor = <const S extends Spec>(spec: S, run: (i: Inputs<S>) => Outputs<S> | Promise<Outputs<S>>): Cmd =>
  ({ spec, run }) as any

export const cmd = <const S extends Spec, const R extends Run<S>>(spec: S, run: R) => ({ spec, run }) as Cmd

// ---------------- Command tree --------------------------
/** Narrow a tree node: a group holds `cmds`, a command holds a `spec`. */
export const isSubCmds = (c: Cmd | SubCmds): c is SubCmds => 'cmds' in c

/** Identity, for inference — keeps a tree literal's names and shape. */
export const commands = <const C extends SubCmds>(cmds: C) => cmds

// ---------------- Builder --------------------------
export const build = <N extends string>(name: N): Builder<{ name: N }> => {
  const bld = (s: Struct) =>
    new Proxy(s, {
      get(target, prop) {
        if (prop === 'spec') return () => target
        if (prop === 'cmd') return (run: any) => ({ spec: target, run })
        return (v: any) => bld({ ...target, [prop]: v })
      },
    })
  return bld({ name }) as Builder<{ name: N }>
}
