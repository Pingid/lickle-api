import { type Api, type Namespace, type Operation, type Schema, type Type, type Fields } from './types.ts'
import type { TypeMeta, NamespaceMeta, OperationMeta } from './meta.ts'
import * as reg from './register.ts'
import { api } from './util/index.ts'

export const op: {
  <N extends string, I extends Operation.Input, O extends Operation.Output, C extends Operation.Cx = void>(
    schema: Operation<N, I, O, C>,
  ): Op<Operation<N, I, O, C> & Api<Operation<N, I, O, C>>>
  <
    N extends string,
    I extends Record<string, Schema> = Record<string, never>,
    O extends Operation.Output = Type.Void,
    C extends Operation.Cx = void,
  >(
    schema: OpK<Operation.Spec<N, I, O>, 'out' | 'in'> & Operation.Handler<Fields.Infer<I>, Operation.InferOut<O>, C>,
  ): Op<Operation<N, Type.Object<I>, O, C> & Api<Operation<N, Type.Object<I>, O, C>>>
} = (schema: any) => {
  const s = schema
  // `in` is usually written as the bare record of fields it describes; an
  // operation always carries a schema, so the record becomes one here rather
  // than at every site that reads it.
  s.in = s.in === undefined ? object({}) : '~standard' in s.in ? s.in : object(s.in)
  s.out = s.out ?? empty()
  Object.defineProperty(s, 'describe', { enumerable: false, value: (d: string) => ((s.description = d), s) })
  Object.defineProperty(s, 'meta', {
    enumerable: false,
    value: (k: string, ...args: any[]) => (reg.update(s, { meta: { [k]: args } }), s),
  })
  return api.as(s) as any
}

export type Op<T> = T & {
  describe: (description: string) => Op<T>
  meta: <K extends keyof Omit<OperationMeta<T>, '_$'>>(k: K, ...args: Params<OperationMeta<T>[K]>) => Op<T>
}

export const ns = <const N extends string, O extends (Api<any> | Operation.Any | Namespace.Any)[]>(
  schema: Namespace<N, O>,
): Ns<Namespace<N, { [K in keyof O]: Api.Wrap<O[K]> }> & Api<Namespace<N, { [K in keyof O]: Api.Wrap<O[K]> }>>> => {
  const s: any = { ...schema, operations: schema.operations.map((x) => api.as(x)) }
  Object.defineProperty(s, 'describe', { enumerable: false, value: (d: string) => ((s.description = d), s) })
  Object.defineProperty(s, 'meta', {
    enumerable: false,
    value: (k: string, ...args: any[]) => (reg.update(s, { meta: { [k]: args } }), s),
  })
  return s as any
}

export type Ns<T> = T & {
  describe: (description: string) => Ns<T>
  meta: <K extends keyof Omit<NamespaceMeta<T>, '_$'>>(k: K, ...args: Params<NamespaceMeta<T>[K]>) => Ns<T>
}

export const output = <O extends Schema = Type.Void, R extends Operation.Returns | undefined = undefined>(
  o?: O,
  returns?: R,
): R extends undefined ? O : O & { returns: R } => {
  if (!o) return empty() as any
  if (returns) Object.defineProperty(o, 'returns', { value: returns })
  return o as any
}

const VENDOR = '@lickle/api-legacy'

const _type = <T extends Schema>(
  tt: Omit<T, '~standard'>,
  json: Record<string, unknown> | ((opts: any, s: reg.Meta) => Record<string, unknown>) = tt as any,
): Tp<T> => {
  const t = tt as unknown as Schema<any, any>

  const js = (opts: any): any => {
    const m = reg.get(t)
    // The type's own shape first, then whatever `describe`/`default` recorded
    // after it was built. An absent key is dropped rather than written as
    // `undefined`, so a bare type emits `{ type: 'string' }` and nothing else.
    const out: Record<string, unknown> = { ...(typeof json === 'function' ? json(opts, m) : json) }
    if (m.description !== undefined) out['description'] = m.description
    if (m.default !== undefined) out['default'] = m.default
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
    return out
  }
  const props: Schema.Props<any, any> = {
    version: 1,
    vendor: VENDOR,
    jsonSchema: { input: js, output: js },
  }
  Object.defineProperty(t, '~standard', { value: props, enumerable: false })
  Object.defineProperty(t, 'default', { value: (d: any) => (reg.update(t, { default: d }), t) })
  Object.defineProperty(t, 'describe', { value: (d: string) => (reg.update(t, { description: d }), t) })
  Object.defineProperty(t, 'meta', {
    value: (k: string, ...args: any[]) => (reg.update(t, { meta: { [k]: args } }), t),
  })
  return t as any
}

export type Tp<T> = T & {
  describe: (description: string) => Tp<T>
  default: (defaultValue: T extends Schema<any, infer O> ? O : never) => Tp<T>
  meta: <K extends keyof Omit<TypeMeta<T>, '_$'>>(k: K, ...args: Params<TypeMeta<T>[K]>) => Tp<T>
}

export const empty = (d?: string) => _type<Type.Void>({ type: 'void', description: d })

export const number = (d?: string) => _type<Type.Number>({ type: 'number', description: d })
export const string = (d?: string) => _type<Type.String>({ type: 'string', description: d })
export const boolean = (d?: string) => _type<Type.Boolean>({ type: 'boolean', description: d })
export const unknown = (d?: string) => _type<Type.Unknown>({ type: 'unknown', description: d })
export const any = (d?: string) => _type<Type.Any>({ type: 'any', description: d })
export const nul = (d?: string) => _type<Type.Null>({ type: 'null', description: d })
export const undef = (d?: string) => _type<Type.Undefined>({ type: 'undefined', description: d })

export const array = <T extends Schema>(p: T, description?: string) =>
  _type<Type.Array<T>>({ type: 'array', items: p, description }, (opts) => ({
    type: 'array',
    items: (p as any)['~standard'].jsonSchema.output(opts),
    description,
  }))

export const set = <const T extends string[]>(p: T, description?: string) =>
  _type<Type.Enum<T[number]>>({ type: 'enum', enum: p, description }, { type: 'string', enum: p, description })

export const union = <const T extends Schema[]>(p: T, description?: string) =>
  _type<Type.Union<T[number]>>({ type: 'union', oneOf: p, description }, (opts) => ({
    oneOf: p.map((s) => s['~standard'].jsonSchema.output(opts)),
    description,
  }))

export const object = <const T extends Fields.Properties>(p: T, description?: string) =>
  _type<Type.Object<T>>({ type: 'object', properties: p, description }, (opts) => {
    const properties = Object.entries(p).map(([k, v]) => [k, v['~standard'].jsonSchema.output(opts)] as const)
    return {
      type: 'object',
      properties: Object.fromEntries(properties),
      // A field that declares a default need not be supplied: whoever is
      // reading this — a model deciding what to send, a form deciding what to
      // ask for — would otherwise be told to provide what it can leave out.
      required: properties.filter(([k, json]) => !p[k]?.optional && json['default'] === undefined).map(([k]) => k),
      description,
    }
  })

export const optional = <T extends Schema>(t: T): T & { optional: true } => {
  Object.defineProperty(t, 'optional', { value: true })
  return t as any
}

// ---------------- Utility Types --------------------------
type OpK<T, K extends keyof T> = Computed<Omit<T, K> & Partial<Pick<T, K>>>
type Params<T> = T extends (...args: infer A) => any ? A : never
type Computed<T> = { [K in keyof T]: T[K] } & {}

export const t = {
  void: empty(),
  empty,
  number,
  string,
  boolean,
  unknown,
  any,
  null: nul,
  undefined: undef,
  array,
  set,
  union,
  object,
  optional,
  output,
  op,
  ns,
}
