import { expect, test } from 'vitest'
import { MAX_NAME, toolName, uniqueName } from './name.ts'

test('a path becomes an underscore-joined name', () => {
  expect(toolName(['migrate'])).toBe('migrate')
  expect(toolName(['db', 'migrate'])).toBe('db_migrate')
  expect(toolName(['a', 'b', 'c'])).toBe('a_b_c')
})

test('characters outside the allowed set are replaced', () => {
  // Must satisfy ^[A-Za-z0-9_-]{1,64}$ wherever these tools surface.
  expect(toolName(['db:main', 'migrate up'])).toBe('db_main_migrate_up')
  expect(toolName(['héllo'])).toMatch(/^[A-Za-z0-9_-]+$/)
})

test('names are capped at 64 characters', () => {
  const long = toolName(['x'.repeat(40), 'y'.repeat(40)])
  expect(long).toHaveLength(MAX_NAME)
})

test('collisions get a deterministic suffix', () => {
  const taken = new Set(['db_migrate'])
  expect(uniqueName('db_migrate', taken)).toBe('db_migrate_2')
  taken.add('db_migrate_2')
  expect(uniqueName('db_migrate', taken)).toBe('db_migrate_3')
  expect(uniqueName('other', taken)).toBe('other')
})

test('a suffixed collision still respects the cap', () => {
  const name = 'z'.repeat(MAX_NAME)
  const unique = uniqueName(name, new Set([name]))
  expect(unique).toHaveLength(MAX_NAME)
  expect(unique.endsWith('_2')).toBe(true)
})
