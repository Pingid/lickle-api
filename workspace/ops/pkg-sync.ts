import * as path from 'node:path'

import * as t from '@lickle/api'

import { spawn } from './_util.ts'

const root = path.resolve(import.meta.dirname, '../..')

const pkg_sync_op = t.op({
  name: 'pkg-sync',
  description: 'Resets pkg branch on main and commits transpiled javascript',
})

export const pkg_sync = t.cmd(pkg_sync_op, async () => {
  const branch = await spawn.stdout('git', ['branch', '--show-current'])
  if (branch !== 'main') return console.log('Skipping pkg-sync: not on main branch')

  const wd = path.resolve(root, '.temp', 'pkg')
  await cleanup()
  await spawn('git', ['worktree', 'add', wd, '-B', 'pkg'])
  await spawn('git', ['reset', '--hard', 'main'], { cwd: wd })

  const opts = { silent: false, cwd: wd }
  await spawn.inherit('pnpm', ['install'], opts)
  await spawn.inherit('pnpm', ['build'], opts)
  await spawn.inherit('git', ['add', './package/*/dist/**', '-f'], opts)

  await spawn.inherit('git', ['config', 'user.email', 'bot@lickle.dev'], opts)
  await spawn.inherit('git', ['config', 'user.name', 'Lickle Bot'], opts)

  await spawn.inherit('git', ['commit', '-m', 'chore: sync pkg branch'], opts)
  await spawn.inherit('git', ['push', 'origin', 'pkg', '--force'], opts)

  await cleanup()
})

const cleanup = async () => {
  await spawn('git', ['worktree', 'remove', path.resolve(root, '.temp', 'pkg'), '--force']).catch(() => {})
  await spawn('git', ['worktree', 'prune']).catch(() => {})
}
