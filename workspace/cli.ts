import { run, cli } from '@lickle/cli'
import * as t from '@lickle/api'

import { gha_types, version_sync, pkg_sync } from './ops/index.ts'

export const workspace = t.ns({
  name: 'workspace',
  description: 'Workspace operations',
  cmds: [version_sync, pkg_sync, cli(gha_types, { positionals: ['file'] })],
})

run(workspace, process.argv.slice(2))
