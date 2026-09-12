import { compile } from 'json-schema-to-typescript'
import * as path from 'node:path'
import * as fs from 'node:fs'

import { commands, run, completionsCmd, type SubCmds } from '../package/cli/src/index.ts'
import * as spec from '../package/core/src/index.ts'

const root = path.resolve(import.meta.dirname, '..')

const gha_types_spec = spec
  .build('gh-types')
  .description('Generate ts types for github actions yml')
  .inputs({
    file: spec.field({ d: 'output file', kind: spec.string, default: path.resolve(root, 'package/gha/src/types.ts') }),
  })
  .positionals(['file'])
  .spec()

const gha_types = spec.cmd(gha_types_spec, async (args) => {
  const schema = await fetch('https://json.schemastore.org/github-action.json').then((res) => res.json())
  const ts = await compile(schema, 'Action')
  fs.mkdirSync(path.dirname(args.file), { recursive: true })
  await fs.promises.writeFile(args.file, ts)
})

const cli = commands({
  name: 'lcli',
  description: 'A CLI for @lickle/cmd workspace',
  cmds: [gha_types, completionsCmd((): SubCmds => cli)],
})

run(cli, process.argv.slice(2))
