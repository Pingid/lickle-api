import { expect, test } from 'vitest'
import { isFormat, render, renderError } from './output.ts'
import { field, list, num, string, type OutputsSpec } from './spec.ts'

const outputs = {
  id: field({ d: 'id', kind: string }),
  count: field({ d: 'count', kind: num }),
} as OutputsSpec

test('text output aligns one key per line, in spec order', () => {
  expect(render({ count: 2, id: 'abc' }, outputs, 'text')).toBe('id:    abc\ncount: 2')
})

test('text output expands lists', () => {
  const spec = { tags: field({ d: 'tags', kind: list(string) }) } as OutputsSpec
  expect(render({ tags: ['a', 'b'] }, spec, 'text')).toBe('tags:\n  - a\n  - b')
  expect(render({ tags: [] }, spec, 'text')).toBe('tags:')
})

test('undefined fields are omitted', () => {
  expect(render({ id: 'abc', count: undefined }, outputs, 'text')).toBe('id: abc')
})

test('json output is the value verbatim', () => {
  expect(render({ id: 'abc', count: 2 }, outputs, 'json')).toBe('{\n  "id": "abc",\n  "count": 2\n}')
})

test('a command with no outputs renders to nothing', () => {
  expect(render(undefined, undefined, 'text')).toBe('')
  expect(render(undefined, undefined, 'json')).toBe('')
})

test('errors render in the selected format', () => {
  expect(renderError(new Error('boom'), 'text')).toBe('error: boom')
  expect(renderError(new Error('boom'), 'json')).toBe('{\n  "error": {\n    "message": "boom"\n  }\n}')
})

test('isFormat narrows the accepted values', () => {
  expect(isFormat('text')).toBe(true)
  expect(isFormat('json')).toBe(true)
  expect(isFormat('yaml')).toBe(false)
})
