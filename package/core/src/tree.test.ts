import { expect, test } from 'vitest'
import { cmd, commands, isSubCmds } from './cons.ts'
import { children, findChild, walk } from './tree.ts'
import type { SubCmds } from './types.ts'

const leaf = (name: string) => cmd({ name, description: `${name} does a thing.` }, () => {})

const migrate = leaf('migrate')
const seed = leaf('seed')
const version = leaf('version')

const tree = commands({
  name: 'app',
  description: 'Demo.',
  cmds: [
    { name: 'db', description: 'Database commands.', cmds: [migrate, seed] },
    { cmds: [version] }, // unnamed: lends its commands to the parent
  ],
} satisfies SubCmds)

test('isSubCmds separates groups from commands', () => {
  expect(isSubCmds(tree)).toBe(true)
  expect(isSubCmds(migrate)).toBe(false)
})

test('children flattens unnamed groups into the parent namespace', () => {
  expect(children(tree).map((c) => c.name)).toEqual(['db', 'version'])
  expect(children(tree).map((c) => c.description)).toEqual(['Database commands.', 'version does a thing.'])
})

test('findChild matches one segment, looking through unnamed groups', () => {
  expect(findChild(tree, 'db')).toBe(tree.cmds[0])
  expect(findChild(tree, 'version')).toBe(version) // reached through the unnamed group
  expect(findChild(tree, 'migrate')).toBeUndefined() // a level too deep
  expect(findChild(tree, 'nope')).toBeUndefined()
})

test('walk yields every node with the path that reaches it', () => {
  expect(walk(tree).map((r) => r.path)).toEqual([['db'], ['db', 'migrate'], ['db', 'seed'], ['version']])
})
