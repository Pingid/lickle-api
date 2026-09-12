import { type Spec } from '@lickle/cmd-core'
import { dump } from 'js-yaml'

import type * as Action from './types.ts'

export const yml = (d: Spec, runner: (definition: Spec) => Action.HttpsJsonSchemastoreOrgGithubActionJson['runs']) =>
  dump({
    name: d.name,
    description: d.description,
    inputs: remap(d.inputs ?? {}, (key, value) => [
      key as string,
      { description: value.d, required: value.kind.type !== 'optional', default: value.default },
    ]),
    outputs: remap(d.outputs ?? {}, (key, value) => [
      key as string,
      { description: value.d, value: `\${{ steps.run.outputs.${key} }}` },
    ]),
    runs: runner(d),
  }).replaceAll(/['"](\$\{\{\s*[^}\n]+\s*\}\})['"]/g, '$1')

export const runsNode =
  (file: string) =>
  (_s: Spec): Action.HttpsJsonSchemastoreOrgGithubActionJson['runs'] => ({
    using: 'node24',
    main: file,
  })

const remap = <T extends Record<string, any>, R extends Record<string, any> = T>(
  obj: T,
  fn: <K extends keyof T>(key: K, value: T[K]) => PairsOf<R>,
) => Object.fromEntries(Object.entries(obj).map(([key, value]) => fn(key, value))) as R

type PairsOf<T extends Record<string, any>> = { [K in keyof T]: [K, T[K]] }[keyof T]
