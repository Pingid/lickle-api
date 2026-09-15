import { expect, test } from 'vitest'

import { errorResult, toolResult } from './result.ts'

test('a structured result is published and rendered, so either kind of client can read it', () => {
  expect(toolResult({ id: 1 }, true)).toEqual({
    resultType: 'complete',
    content: [{ type: 'text', text: '{\n  "id": 1\n}' }],
    structuredContent: { id: 1 },
  })
})

test('a single value is structured content too, not only text', () => {
  expect(toolResult('1.0.0', true)).toEqual({
    resultType: 'complete',
    content: [{ type: 'text', text: '1.0.0' }],
    structuredContent: '1.0.0',
  })
  expect(toolResult([1, 2], true)).toMatchObject({ structuredContent: [1, 2] })
})

test('an operation that declares no output publishes none', () => {
  expect(toolResult({ id: 1 }, false)).toEqual({
    resultType: 'complete',
    content: [{ type: 'text', text: '{\n  "id": 1\n}' }],
  })
})

test('nothing returned still says something', () => {
  const done = { resultType: 'complete', content: [{ type: 'text', text: 'Done.' }] }
  expect(toolResult(undefined, false)).toEqual(done)
  expect(toolResult(null, true)).toEqual(done)
})

test('a failure is a result the model can read, not a protocol error', () => {
  expect(errorResult(new Error('boom'))).toEqual({
    resultType: 'complete',
    content: [{ type: 'text', text: 'boom' }],
    isError: true,
  })
  expect(errorResult('a string')).toMatchObject({ content: [{ type: 'text', text: 'a string' }], isError: true })
})
