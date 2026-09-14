import { t } from '@lickle/api-v2'

import { run } from './src/core/index.ts'

run(t.op({ name: 'test', description: 'test', handle: () => Promise.resolve() }), process.argv.slice(3))
