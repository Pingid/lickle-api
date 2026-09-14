import type { FieldType, ValueOf } from './standard.ts'

export type { FieldType, ValueOf }

// ---------------- Types --------------------------
export const KIND = {
  bool: 'bool',
  string: 'string',
  num: 'num',
  choice: 'choice',
  optional: 'optional',
  list: 'list',
} as const

export type Kind = (typeof KIND)[keyof typeof KIND]

/**
 * The members of a `choice`, held to one JS type so that every projection can
 * name it: JSON Schema wants a `type` alongside its `enum`, and a command line
 * has to know whether to parse a number.
 */
export type Choices = readonly string[] | readonly number[]

/**
 * A closed set of values — what other systems call an enum.
 *
 * It is a type rather than a field annotation because that is what it is: the
 * set of values something may hold. Being a type is also what lets `TypeOf`
 * report it, so a handler receives `'fast' | 'safe'` rather than `string`, and
 * what lets `list(choice([…]))` and `optional(choice([…]))` work for free.
 */
export interface Choice<V extends Choices = Choices> {
  kind: typeof KIND.choice
  values: V
}

/**
 * A union rather than one interface with a union-typed `kind`, so that
 * `TypeOf` distributes over it. An interface would collapse to `never`.
 */
export type Primitive = { kind: typeof KIND.bool } | { kind: typeof KIND.string } | { kind: typeof KIND.num } | Choice

export interface Optional<T extends Primitive> {
  kind: typeof KIND.optional
  item: T
}

export interface List<T extends Primitive> {
  kind: typeof KIND.list
  item: T
}

export type Type = Primitive | Optional<Primitive> | List<Primitive>

/** The value a type describes. */
export type TypeOf<T extends Type> =
  T extends Optional<infer I>
    ? TypeOf<I> | undefined
    : T extends List<infer I>
      ? TypeOf<I>[]
      : T extends Choice<infer V>
        ? V[number]
        : T extends { kind: typeof KIND.bool }
          ? boolean
          : T extends { kind: typeof KIND.string }
            ? string
            : T extends { kind: typeof KIND.num }
              ? number
              : never

/** The primitive inside a type, unwrapping `optional` and `list`. */
export type ItemOf<T extends Type> = T extends Optional<infer I> ? I : T extends List<infer I> ? I : T

// ---------------- Fields --------------------------
// Type-only import: `standard.ts` imports values from here, so this direction
// must never carry runtime bindings.

export interface Field<T extends FieldType = FieldType> {
  description: string
  type: T
}

export interface InputField<T extends FieldType = FieldType> extends Field<T> {
  default?: ValueOf<T>
  alias?: string[]
}

export interface OutputField<T extends FieldType = FieldType> extends Field<T> {}

export interface FieldMap extends Record<string, Field> {}
export interface InputFields extends Record<string, InputField> {}
export interface OutputFields extends Record<string, OutputField> {}

// ---------------- Operation --------------------------
/**
 * Target-owned configuration, keyed by target (`{ cli: { … } }`). Core never
 * reads it; each target reads its own key, types it, and ignores the rest.
 *
 * This is the only thing core says about targets. It is per-node data, so two
 * targets can never collide and importing one cannot change what another sees.
 */
export type Meta = Readonly<Record<string, unknown>>

/**
 * A node a target addresses, and may configure.
 *
 * Configuration hangs off the binding rather than the description: an
 * `Operation` is portable and knows nothing about any target, and only once it
 * is bound — into a `Command`, or placed in a `Namespace` — can a target say
 * how it wants that node rendered. A library can therefore ship commands
 * without welding one consumer's command line onto them.
 */
export interface Configured {
  meta?: Meta
}

/**
 * Anything that sits in the tree: it has a name, and may carry configuration
 * for whichever target renders it. Both a `Command` and a `Namespace` are one.
 *
 * The `name` is not decoration here — `Configured` alone is a weak type (every
 * member optional), so it cannot constrain a helper that attaches `meta` to a
 * node that has none yet.
 */
export type Addressable = Configured & { name: string }

/**
 * One named operation: what it is called, what it does, what it takes and what
 * it produces. Deliberately says nothing about *how* it runs, nor about any
 * target — both belong to whatever binds it.
 *
 * `outputs` is either a map of named fields or a single unnamed value, which is
 * the same choice every target faces: structured content or text, a JSON object
 * or a body, printed fields or a document.
 */
export interface Operation {
  name: string
  description: string
  inputs?: InputFields
  outputs?: OutputFields | OutputField
}

/**
 * An operation bound to an implementation.
 *
 * `run` is declared in method shorthand deliberately: parameters written that
 * way are checked bivariantly even under `strictFunctionTypes`, which is what
 * lets a `Command<ConcreteOp>` sit in a `ReadonlyArray<Command>`. An arrow
 * property would be contravariant, and every tree literal would need a cast.
 */
export type Command<O extends Operation = Operation> = O &
  Configured & {
    run(input: InputOf<O>): Result<OutputOf<O>>
  }

export type Handler<O extends Operation = Operation> = (input: InputOf<O>) => Result<OutputOf<O>>

export type Result<T> = T | Promise<T>

/**
 * A group of commands, occupying one segment of the path a target addresses
 * commands by (`app db migrate`).
 *
 * The name is required: a namespace is precisely the thing that contributes a
 * segment, and a transparent one would only duplicate what spreading the
 * commands into the parent already does.
 */
export interface Namespace extends Configured {
  name: string
  description?: string
  cmds: ReadonlyArray<Command | Namespace>
}

// ---------------- Inference --------------------------
export type InputOf<O extends Operation> = [O['inputs']] extends [undefined]
  ? Record<string, never>
  : O['inputs'] extends InputFields
    ? Fields<O['inputs']>
    : Record<string, unknown>

export type OutputOf<O extends Operation> = [O['outputs']] extends [undefined]
  ? void
  : O['outputs'] extends OutputField
    ? ValueOf<O['outputs']['type']>
    : O['outputs'] extends OutputFields
      ? Fields<O['outputs']>
      : unknown

/** The object a field map describes: optional-kinded fields become optional keys. */
export type Fields<D extends FieldMap> = Computed<
  { [K in RequiredKeys<D>]: ValueOf<D[K]['type']> } & { [K in OptionalKeys<D>]?: ValueOf<D[K]['type']> }
>

export type FieldKeys<D extends FieldMap> = keyof D & string

export type PrimitiveKeys<D extends FieldMap> = {
  [K in keyof D]: D[K]['type'] extends Primitive ? K & string : never
}[keyof D]

type RequiredKeys<D extends FieldMap> = {
  [K in keyof D]: D[K]['type'] extends Optional<Primitive> ? never : K
}[keyof D]

type OptionalKeys<D extends FieldMap> = {
  [K in keyof D]: D[K]['type'] extends Optional<Primitive> ? K : never
}[keyof D]

// ---------------- Builder --------------------------
export type Builder<O extends Struct> = BaseBuilder<O> & (O extends Operation ? Complete<O> : unknown)

export interface BaseBuilder<O extends Struct> {
  description: <D extends string>(d: D) => Builder<O & { description: D }>
  inputs: <I extends InputFields>(i: I) => Builder<O & { inputs: I }>
  outputs: <T extends OutputFields | OutputField>(o: T) => Builder<O & { outputs: T }>
  meta: <M extends Meta>(m: M) => Builder<O & { meta: M }>
}

interface Complete<O extends Operation> {
  op: () => Computed<O>
  cmd: (run: Handler<O>) => Command<O>
}

// ---------------- Type utils --------------------------
export type Struct<V = any> = Record<string, V>
export type Computed<T> = { [K in keyof T]: T[K] } & {}
