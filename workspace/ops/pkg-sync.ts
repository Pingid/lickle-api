import * as path from 'node:path'

import * as t from '@lickle/legacy-api'

import { spawn } from './_util.ts'

const root = path.resolve(import.meta.dirname, '../..')

const pkg_sync_op = t.op({
  name: 'pkg-sync',
  description: 'Resets pkg branch on main and commits transpiled javascript',
  inputs: {
    base: t.field({ description: 'Base branch to sync from', type: t.string, default: 'main' }),
    branch: t.field({ description: 'Branch to sync to', type: t.string, default: 'pkgv2' }),
  },
})

export const pkg_sync = t.cmd(pkg_sync_op, async (c) => {
  const head = await spawn.stdout('git', ['branch', '--show-current'])
  if (head !== c.base) return console.log('Skipping pkg-sync: not on base branch')

  const branch = c.branch

  const wd = path.resolve(root, '.temp', branch)
  await cleanup(branch)
  await spawn('git', ['worktree', 'add', wd, '-B', branch])
  try {
    await spawn('git', ['reset', '--hard', c.base], { cwd: wd })

    const opts = { silent: false, cwd: wd }
    await spawn.inherit('pnpm', ['install'], opts)
    await spawn.inherit('pnpm', ['build'], opts)
    await spawn.inherit('git', ['add', './package/*/dist/**', '-f'], opts)

    await spawn.inherit('git', ['config', 'user.email', 'bot@lickle.dev'], opts)
    await spawn.inherit('git', ['config', 'user.name', 'Lickle Bot'], opts)

    await spawn.inherit('git', ['commit', '-m', 'chore: sync pkg branch'], opts)
    await spawn.inherit('git', ['push', 'origin', branch, '--force'], opts)
  } finally {
    await cleanup(branch)
  }
})

const cleanup = async (branch: string) => {
  await spawn('git', ['worktree', 'remove', path.resolve(root, '.temp', branch), '--force']).catch(() => {})
  await spawn('git', ['worktree', 'prune']).catch(() => {})
}
