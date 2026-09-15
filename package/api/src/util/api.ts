import type { Api, Namespace, Operation } from '../types.ts'
import { API } from '../types.ts'

export const of: {
  <T extends Operation.Any | Namespace.Any | Api>(t: T): Api.Extract<T>
  <T extends Operation.Any | Namespace.Any | Api>(t?: T | undefined): Api.Extract<T> | undefined
} = <T extends Operation.Any | Namespace.Any>(t: T | Api<T>): T => {
  if (t === undefined) return undefined as any
  if ((t as any)[API]) return (t as any)[API]
  return t as any
}

export const as: {
  <T extends Operation.Any | Namespace.Any>(t: T | Api<T>): Api<T>
  <T extends Operation.Any | Namespace.Any>(t?: T | Api<T> | undefined): Api<T> | undefined
} = <T extends Operation.Any | Namespace.Any>(t: T | Api<T>): Api<T> => {
  if (t === undefined) return undefined as any
  if ((t as any)[API]) return t as any
  return on(t as any, t as any) as any
}

/**
 * Point a carrier at the api node it stands for.
 *
 * `apiAs` brands a node with itself, which is all an operation or a namespace
 * needs. A target that has its own shape uses this instead: a `Cmd` is written
 * the way a command line wants to be written and carries the operation it
 * compiles to, so every other target still sees an operation.
 *
 * The key is non-enumerable, so branding never shows up in a spread or a
 * `JSON.stringify` — and never in the JSON Schema a type emits.
 */
export const on = <T extends object, A extends Operation.Any | Namespace.Any>(carrier: T, api: A): T & Api<A> => {
  Object.defineProperty(carrier, API, { value: api, enumerable: false, configurable: true })
  return carrier as T & Api<A>
}
