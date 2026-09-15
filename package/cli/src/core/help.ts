import { type Namespace, type Operation } from '@lickle/api'
import { api } from '@lickle/api/util'

import { schema as js } from '@lickle/api/util'

import { inputsOf, typeLabel, valueLabel, type Field } from './fields.ts'

type Row = [left: string, right: string]

const GLOBAL_OPTIONS: Row[] = [
  ['-h, --help', 'Show this help.'],
  ['-o, --output <text|json>', 'Output format. (default: text)'],
]

/** Help for a namespace: the commands it holds, plus the global options. */
export const namespaceHelp = (ns: Namespace, path: string[]): string => {
  const sections: string[] = []
  if (ns.description) sections.push(ns.description)
  sections.push(`Usage: ${path.join(' ')} <command> [options]`)

  const children = (ns.operations as unknown[]).map((c) => api.of(c as Operation.Any | Namespace))
  const commands: Row[] = children.map((child) => [child.name, child.description ?? ''])
  if (commands.length > 0) sections.push(section('Commands', commands))
  sections.push(section('Options', GLOBAL_OPTIONS))

  return sections.join('\n\n')
}

/** Help for a single operation: its arguments, its options and what it returns. */
export const operationHelp = (op: Operation.Any, path: string[]): string => {
  const { fields, positionals } = inputsOf(op)
  const byKey = new Map(fields.map((f) => [f.key, f]))

  const sections: string[] = []
  if (op.description) sections.push(op.description)

  const placed = positionals.map((key) => token(key, byKey.get(key)))
  sections.push([`Usage: ${path.join(' ')}`, '[options]', ...placed].join(' '))

  const args: Row[] = []
  for (const key of positionals) {
    const field = byKey.get(key)
    if (field === undefined) continue
    args.push([token(key, field), annotate(field.description, typeLabel(field.shape), defaultNote(field))])
  }
  if (args.length > 0) sections.push(section('Arguments', args))

  const options: Row[] = fields
    .filter((field) => !positionals.includes(field.key))
    .map((field) => [flags(field), annotate(field.description, defaultNote(field) ?? requiredNote(field))])
  sections.push(section('Options', [...options, ...GLOBAL_OPTIONS]))

  const output = outputSection(op)
  if (output !== undefined) sections.push(output)

  return sections.join('\n\n')
}

/**
 * What the command prints. An operation returning a record lists its fields; one
 * returning a single value shows its type; one returning nothing says nothing.
 */
const outputSection = (op: Operation.Any): string | undefined => {
  if (op.out === undefined) return undefined
  const json = js.json(op.out)
  if (js.isNothing(json)) return undefined

  const title = op.out.returns === 'async-iter' ? 'Output (streamed)' : 'Output'
  const properties = Object.entries(json.properties ?? {})
  if (properties.length > 0)
    return section(
      title,
      properties.map(([key, property]): Row => [
        key,
        annotate(property.description ?? '', typeLabel(js.shape(property))),
      ]),
    )
  return section(title, [[typeLabel(js.shape(json)), json.description ?? '']])
}

/** Usage token for a positional: `<name>`, `[name]` or `[name...]`. */
const token = (key: string, field: Field | undefined): string => {
  if (field === undefined) return `<${key}>`
  if (field.shape.list) return `[${key}...]`
  return field.required ? `<${key}>` : `[${key}]`
}

/**
 * Flag column for an option: shorts first, then the long spellings. Options with
 * no short flag are indented so the long ones line up.
 */
const flags = (field: Field): string => {
  const shorts = field.names.filter((n) => n.length === 1).map((n) => `-${n}`)
  const longs = field.names.filter((n) => n.length > 1).map((n) => `--${n}`)
  const names = [...shorts, ...longs].join(', ')
  const column = shorts.length > 0 ? names : `    ${names}`
  return field.shape.type === 'boolean' ? column : `${column} <${valueLabel(field.shape)}>`
}

const defaultNote = (field: Field): string | undefined =>
  field.default === undefined ? undefined : `default: ${JSON.stringify(field.default)}`

const requiredNote = (field: Field): string => (field.required ? 'required' : '')

const annotate = (text: string, ...notes: (string | undefined)[]): string => {
  const kept = notes.filter((n): n is string => n !== undefined && n !== '')
  return kept.length > 0 ? `${text} (${kept.join(', ')})`.trimStart() : text
}

const section = (title: string, rows: Row[]): string => {
  const width = Math.max(0, ...rows.map(([left]) => left.length))
  const lines = rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd())
  return [`${title}:`, ...lines].join('\n')
}
