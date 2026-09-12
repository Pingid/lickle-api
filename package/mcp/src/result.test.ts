import { expect, test } from 'vitest'
import { errorResult, toolResult } from './result.ts'

test('outputs become structuredContent plus a readable text rendering', () => {
  const result = toolResult({ applied: 3 }, true)
  expect(result.structuredContent).toEqual({ applied: 3 })
  expect(result.content).toEqual([{ type: 'text', text: '{\n  "applied": 3\n}' }])
  expect(result.isError).toBeUndefined()
})

test('a void return still answers with content', () => {
  expect(toolResult(undefined, false)).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
  expect(toolResult(null, false)).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
})

test('a value from a command declaring no outputs is text only', () => {
  expect(toolResult('hello', false)).toEqual({ content: [{ type: 'text', text: 'hello' }] })
  expect(toolResult(42, false)).toEqual({ content: [{ type: 'text', text: '42' }] })
  expect(toolResult({ a: 1 }, false).structuredContent).toBeUndefined()
})

test('a thrown error becomes a result the model can read, not a rejection', () => {
  expect(errorResult(new Error('boom'))).toEqual({ content: [{ type: 'text', text: 'boom' }], isError: true })
  expect(errorResult('plain string')).toEqual({ content: [{ type: 'text', text: 'plain string' }], isError: true })
})
