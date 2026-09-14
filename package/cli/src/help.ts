import { outputField, outputFields, shapeOf } from '@lickle/api'
import type { Configured, InputField, Namespace, Operation } from '@lickle/api'
import { isBoolFlag, isRequired, typeLabel, valueLabel } from './kind.ts'
import { positionalsOf } from './meta.ts'

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

  const commands = ns.cmds.map(({ name, description }): Row => [name, description ?? ''])
  if (commands.length > 0) sections.push(section('Commands', commands))
  sections.push(section('Options', GLOBAL_OPTIONS))

  return sections.join('\n\n')
}

/** Help for a single command: its arguments, options and outputs. */
export const cmdHelp = (op: Operation & Configured, path: string[]): string => {
  const inputs = op.inputs ?? {}
  const positionals = positionalsOf(op)

  const sections: string[] = []
  if (op.description) sections.push(op.description)

  const usage = [`Usage: ${path.join(' ')}`, '[options]', ...positionals.map((k) => token(k, inputs[k]))]
  sections.push(usage.join(' '))

  const args: Row[] = []
  for (const key of positionals) {
    const field = inputs[key]
    if (field === undefined) continue
    args.push([token(key, field), annotate(field.description, typeLabel(field.type), defaultNote(field))])
  }
  if (args.length > 0) sections.push(section('Arguments', args))

  const options: Row[] = []
  for (const [key, field] of Object.entries(inputs)) {
    if (positionals.includes(key)) continue
    options.push([
      flags(key, field),
      annotate(field.description, defaultNote(field) ?? (isRequired(field) ? 'required' : '')),
    ])
  }
  sections.push(section('Options', [...options, ...GLOBAL_OPTIONS]))

  const single = outputField(op.outputs)
  const outputs: Row[] =
    single !== undefined
      ? [[typeLabel(single.type), single.description]]
      : Object.entries(outputFields(op.outputs) ?? {}).map(([key, field]): Row => [
          key,
          annotate(field.description, typeLabel(field.type)),
        ])
  if (outputs.length > 0) sections.push(section('Output', outputs))

  return sections.join('\n\n')
}

/** Usage token for a positional: `<name>`, `[name]` or `[name...]`. */
const token = (key: string, field: InputField | undefined): string => {
  if (field === undefined) return `<${key}>`
  if (shapeOf(field.type).list) return `[${key}...]`
  return isRequired(field) ? `<${key}>` : `[${key}]`
}

/**
 * Flag column for an option: shorts first, then the key, then long aliases.
 * Options with no short alias are indented so the long flags line up.
 */
const flags = (key: string, field: InputField): string => {
  const aliases = field.alias ?? []
  const shorts = aliases.filter((a) => a.length === 1).map((a) => `-${a}`)
  const names = [...shorts, `--${key}`, ...aliases.filter((a) => a.length > 1).map((a) => `--${a}`)]
  const column = shorts.length > 0 ? names.join(', ') : `    ${names.join(', ')}`
  if (isBoolFlag(field.type)) return column
  return `${column} <${valueLabel(field.type)}>`
}

const defaultNote = (field: InputField): string | undefined =>
  field.default === undefined ? undefined : `default: ${JSON.stringify(field.default)}`

const annotate = (text: string, ...notes: (string | undefined)[]): string => {
  const kept = notes.filter((n): n is string => n !== undefined && n !== '')
  return kept.length > 0 ? `${text} (${kept.join(', ')})` : text
}

const section = (title: string, rows: Row[]): string => {
  const width = Math.max(0, ...rows.map(([left]) => left.length))
  const lines = rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd())
  return [`${title}:`, ...lines].join('\n')
}
