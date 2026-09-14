import { expect, test } from 'vitest'
import { cmd, isNamespace, ns } from './cons.ts'
import { findChild, operations, walk } from './tree.ts'
import type { Namespace } from './types.ts'

const leaf = (name: string) => cmd({ name, description: `${name} does a thing.` }, () => {})

const migrate = leaf('migrate')
const seed = leaf('seed')
const version = leaf('version')

const tree = ns({
  name: 'app',
  description: 'Demo.',
  cmds: [
    { name: 'db', description: 'Database commands.', cmds: [migrate, seed] },
    // A namespace is always named; commands that belong to the parent are
    // simply listed there.
    version,
  ],
} satisfies Namespace)

test('isNamespace separates namespaces from commands', () => {
  expect(isNamespace(tree)).toBe(true)
  expect(isNamespace(migrate)).toBe(false)
})

test('a namespace’s children are exactly its cmds', () => {
  expect(tree.cmds.map((c) => c.name)).toEqual(['db', 'version'])
  expect(tree.cmds.map((c) => c.description)).toEqual(['Database commands.', 'version does a thing.'])
})

test('findChild matches one segment', () => {
  expect(findChild(tree, 'db')).toBe(tree.cmds[0])
  expect(findChild(tree, 'version')).toBe(version)
  expect(findChild(tree, 'migrate')).toBeUndefined() // a level too deep
  expect(findChild(tree, 'nope')).toBeUndefined()
})

test('walk yields every node with the path that reaches it', () => {
  expect(walk(tree).map((r) => r.path)).toEqual([['db'], ['db', 'migrate'], ['db', 'seed'], ['version']])
})

test('operations yields only the callable leaves', () => {
  expect(operations(tree).map((o) => o.path)).toEqual([['db', 'migrate'], ['db', 'seed'], ['version']])
  expect(operations(tree).map((o) => o.node)).toEqual([migrate, seed, version])
})
