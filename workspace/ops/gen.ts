import { compile } from 'json-schema-to-typescript'
import * as prettier from 'prettier'
import * as path from 'node:path'
import * as fs from 'node:fs'

import * as t from '@lickle/api'

const root = path.resolve(import.meta.dirname, '..')

const gha_types_op = t.op({
  name: 'gen',
  description: 'Generate ts types for github actions yml',
  inputs: {
    file: t.field({
      description: 'output file',
      type: t.string,
      default: path.resolve(root, 'package/gha/src/types.ts'),
    }),
  },
})

export const gha_types = t.cmd(gha_types_op, async (args) => {
  const schema = await fetch('https://json.schemastore.org/github-action.json').then((res) => res.json())
  const ts = await compile(schema, 'Action')
  const config = await prettier.resolveConfig(args.file)
  const formatted = await prettier.format(ts, { ...config, parser: 'typescript' })
  fs.mkdirSync(path.dirname(args.file), { recursive: true })
  await fs.promises.writeFile(args.file, formatted)
})
