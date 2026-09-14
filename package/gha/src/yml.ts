import { hasDefault, outputFields, shapeOf, type Operation } from '@lickle/api'
import { dump } from 'js-yaml'

import type * as Action from './types.ts'

export const yml = (op: Operation, runner: (op: Operation) => Action.HttpsJsonSchemastoreOrgGithubActionJson['runs']) =>
  dump({
    name: op.name,
    description: op.description,
    inputs: remap(op.inputs ?? {}, (key, value) => [
      key as string,
      // An input with a default is not required, whatever its kind — saying
      // both would tell the caller to supply something the action supplies.
      {
        description: value.description,
        required: !shapeOf(value.type).optional && !hasDefault(value),
        default: value.default,
      },
    ]),
    // Action outputs are named, so an operation returning a single unnamed
    // value has no representation here and contributes none.
    outputs: remap(outputFields(op.outputs) ?? {}, (key, value) => [
      key as string,
      { description: value.description, value: `\${{ steps.run.outputs.${key} }}` },
    ]),
    runs: runner(op),
  }).replaceAll(/['"](\$\{\{\s*[^}\n]+\s*\}\})['"]/g, '$1')

export const runsNode =
  (file: string) =>
  (_op: Operation): Action.HttpsJsonSchemastoreOrgGithubActionJson['runs'] => ({
    using: 'node24',
    main: file,
  })

const remap = <T extends Record<string, any>, R extends Record<string, any> = T>(
  obj: T,
  fn: <K extends keyof T>(key: K, value: T[K]) => PairsOf<R>,
) => Object.fromEntries(Object.entries(obj).map(([key, value]) => fn(key, value))) as R

type PairsOf<T extends Record<string, any>> = { [K in keyof T]: [K, T[K]] }[keyof T]
