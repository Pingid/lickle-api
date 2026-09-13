import { expect, test } from 'vitest'
import { isFormat, render, renderError } from './output.ts'
import { field, list, num, string, type OutputFields } from './cmd.ts'

const outputs = {
  id: field({ description: 'id', type: string }),
  count: field({ description: 'count', type: num }),
} as OutputFields

test('text output aligns one key per line, in the declared order', () => {
  expect(render({ count: 2, id: 'abc' }, outputs, 'text')).toBe('id:    abc\ncount: 2')
})

test('text output expands lists', () => {
  const spec = { tags: field({ description: 'tags', type: list(string) }) } as OutputFields
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

test('a single unnamed output renders as the bare value', () => {
  const script = field({ description: 'The script.', type: string })
  expect(render('#!/bin/sh\necho hi', script, 'text')).toBe('#!/bin/sh\necho hi')
  expect(render(['a', 'b'], script, 'text')).toBe('a\nb')
})
