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
export interface Field<T extends Type = Type> {
  description: string
  type: T
}

export interface InputField<T extends Type = Type> extends Field<T> {
  default?: TypeOf<T>
  alias?: string[]
}

export interface OutputField<T extends Type = Type> extends Field<T> {}

export interface FieldMap extends Record<string, Field> {}
export interface InputFields extends Record<string, InputField> {}
export interface OutputFields extends Record<string, OutputField> {}

// ---------------- Operation --------------------------
/**
 * Adapter-owned configuration, keyed by adapter (`{ cli: { … } }`). Core never
 * reads it; each adapter reads its own key, types it, and ignores the rest.
 *
 * This is the only thing core says about adapters. A field here is per-command
 * data, so two adapters can never collide and importing one cannot change what
 * another sees.
 */
export type Meta = Readonly<Record<string, unknown>>

/**
 * One named operation: what it is called, what it does, what it takes and what
 * it produces. Deliberately says nothing about *how* it runs — that belongs to
 * whichever target renders it.
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
  meta?: Meta
}

/**
 * An operation bound to an implementation.
 *
 * `run` is declared in method shorthand deliberately: parameters written that
 * way are checked bivariantly even under `strictFunctionTypes`, which is what
 * lets a `Command<ConcreteOp>` sit in a `ReadonlyArray<Command>`. An arrow
 * property would be contravariant, and every tree literal would need a cast.
 */
export type Command<O extends Operation = Operation> = O & {
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
export interface Namespace {
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
    ? TypeOf<O['outputs']['type']>
    : O['outputs'] extends OutputFields
      ? Fields<O['outputs']>
      : unknown

/** The object a field map describes: optional-kinded fields become optional keys. */
export type Fields<D extends FieldMap> = Computed<
  { [K in RequiredKeys<D>]: TypeOf<D[K]['type']> } & { [K in OptionalKeys<D>]?: TypeOf<D[K]['type']> }
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
