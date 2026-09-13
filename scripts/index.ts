import { compile } from 'json-schema-to-typescript'
import * as prettier from 'prettier'
import * as path from 'node:path'
import * as fs from 'node:fs'

import { cli, completionsCmd, run } from '../package/cli/src/index.ts'
import { cmd, field, ns, string, type Namespace } from '../package/cli/src/cmd.ts'

const root = path.resolve(import.meta.dirname, '..')

const ghaTypesOp = cli(
  {
    name: 'gh-types',
    description: 'Generate ts types for github actions yml',
    inputs: {
      file: field({
        description: 'output file',
        type: string,
        default: path.resolve(root, 'package/gha/src/types.ts'),
      }),
    },
  },
  { positionals: ['file'] },
)

const ghaTypes = cmd(ghaTypesOp, async (args) => {
  const schema = await fetch('https://json.schemastore.org/github-action.json').then((res) => res.json())
  const ts = await compile(schema, 'Action')
  // Format with the repo's own prettier config so the generated file is not a
  // permanent diff against `prettier --check`.
  const config = await prettier.resolveConfig(args.file)
  const formatted = await prettier.format(ts, { ...config, parser: 'typescript' })
  fs.mkdirSync(path.dirname(args.file), { recursive: true })
  await fs.promises.writeFile(args.file, formatted)
})

const tree = ns({
  name: 'lcli',
  description: 'A CLI for @lickle/cmd workspace',
  cmds: [ghaTypes, completionsCmd((): Namespace => tree)],
})

run(tree, process.argv.slice(2))
