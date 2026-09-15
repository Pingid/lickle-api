import { compile } from 'json-schema-to-typescript'
import * as prettier from 'prettier'
import * as path from 'node:path'
import * as fs from 'node:fs'

import * as cl from '@lickle/cli'

const root = path.resolve(import.meta.dirname, '..')

export const gha_types = cl.cmd({
  name: 'gha-types',
  description: 'Generate ts types for github actions yml',
  args: {
    file: {
      description: 'output file',
      type: cl.string(),
      default: path.resolve(root, 'package/gha/src/types.ts'),
      short: 'f',
      positional: true,
    },
  },
  handle: async (args) => {
    const schema = await fetch('https://json.schemastore.org/github-action.json').then((res) => res.json())
    const ts = await compile(schema, 'Action')
    const config = await prettier.resolveConfig(args.file)
    const formatted = await prettier.format(ts, { ...config, parser: 'typescript' })
    fs.mkdirSync(path.dirname(args.file), { recursive: true })
    await fs.promises.writeFile(args.file, formatted)
  },
})
