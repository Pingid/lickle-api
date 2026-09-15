import * as path from 'node:path'

import * as cl from '@lickle/cli'

import { spawn } from './_util.ts'

const root = path.resolve(import.meta.dirname, '../..')

export const pkg_sync = cl.cmd({
  name: 'pkg-sync',
  description: 'Resets pkg branch on main and commits transpiled javascript',
  args: {
    target: { description: 'Target branch to name', type: cl.string().default('pkg') },
    source: { description: 'Source branch to sync from', type: cl.string().default('main') },
  },
  handle: async (args) => {
    const branch = await spawn.stdout('git', ['branch', '--show-current'])
    if (branch !== args.source) return console.log(`Skipping pkg-sync: not on ${args.source} branch`)

    const wd = path.resolve(root, '.temp', 'pkg')
    await cleanup(args.target)
    try {
      await spawn('git', ['worktree', 'add', wd, '-B', args.target])
      await spawn('git', ['reset', '--hard', args.source], { cwd: wd })

      const opts = { silent: false, cwd: wd }
      await spawn.inherit('pnpm', ['install'], opts)
      await spawn.inherit('pnpm', ['build'], opts)
      await spawn.inherit('git', ['add', './package/*/dist/**', '-f'], opts)

      await spawn.inherit('git', ['config', 'user.email', 'bot@lickle.dev'], opts)
      await spawn.inherit('git', ['config', 'user.name', 'Lickle Bot'], opts)

      await spawn.inherit('git', ['commit', '-m', 'chore: sync pkg branch'], opts)
      await spawn.inherit('git', ['push', 'origin', args.target, '--force'], opts)
    } finally {
      await cleanup(args.target)
    }
  },
})

const cleanup = async (target: string) => {
  await spawn('git', ['worktree', 'remove', path.resolve(root, '.temp', target), '--force']).catch(() => {})
  await spawn('git', ['worktree', 'prune']).catch(() => {})
}
