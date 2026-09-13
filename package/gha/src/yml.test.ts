import { expect, test } from 'vitest'
import { field, list, optional, string } from '@lickle/cmd-core'
import { load } from 'js-yaml'
import { runsNode, yml } from './yml.ts'

const spec = {
  name: 'greet',
  description: 'Greet someone.',
  inputs: {
    who: field({ description: 'Who to greet.', type: string }),
    greeting: field({ description: 'What to say.', type: string, default: 'hello' }),
    title: field({ description: 'Optional title.', type: optional(string) }),
    tags: field({ description: 'Tags.', type: list(string) }),
  },
  outputs: {
    message: field({ description: 'The greeting.', type: string }),
  },
}

const parse = (s: string) => load(s) as any

test('the action carries the spec name and description', () => {
  const action = parse(yml(spec, runsNode('dist/index.js')))
  expect(action.name).toBe('greet')
  expect(action.description).toBe('Greet someone.')
  expect(action.runs).toEqual({ using: 'node24', main: 'dist/index.js' })
})

test('an input is required only when nothing else will supply it', () => {
  const { inputs } = parse(yml(spec, runsNode('dist/index.js')))

  expect(inputs.who.required).toBe(true)
  expect(inputs.title.required).toBe(false) // optional kind

  // The regression: a default means the caller need not supply it. Declaring
  // `required: true` alongside `default:` contradicts itself.
  expect(inputs.greeting.required).toBe(false)
  expect(inputs.greeting.default).toBe('hello')
})

test('descriptions come from the field docs', () => {
  const { inputs, outputs } = parse(yml(spec, runsNode('dist/index.js')))
  expect(inputs.who.description).toBe('Who to greet.')
  expect(outputs.message.description).toBe('The greeting.')
})

test('outputs wire to the run step, with the expression left unquoted', () => {
  const out = yml(spec, runsNode('dist/index.js'))
  // The replaceAll must strip the quotes js-yaml adds, or Actions sees a literal.
  expect(out).toContain('value: ${{ steps.run.outputs.message }}')
  expect(parse(out).outputs.message.value).toBe('${{ steps.run.outputs.message }}')
})

test('a spec with no inputs or outputs still emits', () => {
  const bare = parse(yml({ name: 'bare', description: 'Nothing.' }, runsNode('x.js')))
  expect(bare.inputs).toEqual({})
  expect(bare.outputs).toEqual({})
})
