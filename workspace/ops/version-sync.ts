import * as path from 'node:path'
import * as fs from 'node:fs'

import * as cl from '@lickle/cli'
import pkg from '../../package.json' with { type: 'json' }

const root = path.resolve(import.meta.dirname, '..')

export const version_sync = cl.cmd({
  name: 'version-sync',
  description: 'Sync versions of all packages in the workspace',
  args: { version: { description: 'Version to use', type: cl.string(), default: pkg.version } },
  handle: async (args) => {
    const pkgs = await fs.promises.readdir(path.resolve(root, 'package'))
    for (const pkg of pkgs) {
      if (!(await fs.promises.stat(path.resolve(root, 'package', pkg)).then((stat) => stat.isDirectory()))) continue
      const pkgPath = path.resolve(root, 'package', pkg)
      const pkgJson = await fs.promises.readFile(path.resolve(pkgPath, 'package.json'), 'utf8')
      const pkgJsonObj = JSON.parse(pkgJson)
      pkgJsonObj.version = args.version
      await fs.promises.writeFile(path.resolve(pkgPath, 'package.json'), JSON.stringify(pkgJsonObj, null, 2))
    }

    const rootPkgJson = await fs.promises.readFile(path.resolve(root, 'package.json'), 'utf8')
    const rootPkgJsonObj = JSON.parse(rootPkgJson)
    rootPkgJsonObj.version = args.version
    await fs.promises.writeFile(path.resolve(root, 'package.json'), JSON.stringify(rootPkgJsonObj, null, 2))
  },
})
