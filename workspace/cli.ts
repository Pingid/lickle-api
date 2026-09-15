import { run } from '@lickle/cli'
import { ns } from '@lickle/api'

import { gha_types, version_sync, pkg_sync } from './ops/index.ts'

export const workspace = ns({
  name: 'workspace',
  description: 'Workspace operations',
  operations: [version_sync, pkg_sync, gha_types],
})

run(workspace, process.argv.slice(2))
