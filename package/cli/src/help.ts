import type { InputField, Spec } from '@lickle/cmd-core'
import { isBoolFlag, isRequired, typeLabel } from './kind.ts'
import { children, isList, itemOf, type SubCmds } from './spec.ts'

type Row = [left: string, right: string]

const GLOBAL_OPTIONS: Row[] = [
  ['-h, --help', 'Show this help.'],
  ['-o, --output <text|json>', 'Output format. (default: text)'],
]

/** Help for a command group: the commands it holds, plus the global options. */
export const groupHelp = (group: SubCmds, path: string[]): string => {
  const sections: string[] = []
  if (group.description) sections.push(group.description)
  sections.push(`Usage: ${path.join(' ')} <command> [options]`)

  const commands = children(group).map(({ name, description }): Row => [name, description])
  if (commands.length > 0) sections.push(section('Commands', commands))
  sections.push(section('Options', GLOBAL_OPTIONS))

  return sections.join('\n\n')
}

/** Help for a single command: its arguments, options and outputs. */
export const cmdHelp = (spec: Spec, path: string[]): string => {
  const inputs = spec.inputs ?? {}
  const positionals = spec.positionals ?? []

  const sections: string[] = []
  if (spec.description) sections.push(spec.description)

  const usage = [`Usage: ${path.join(' ')}`, '[options]', ...positionals.map((k) => token(k, inputs[k]))]
  sections.push(usage.join(' '))

  const args: Row[] = []
  for (const key of positionals) {
    const field = inputs[key]
    if (field === undefined) continue
    args.push([token(key, field), annotate(field.d, valueLabel(field), defaultNote(field))])
  }
  if (args.length > 0) sections.push(section('Arguments', args))

  const options: Row[] = []
  for (const [key, field] of Object.entries(inputs)) {
    if (positionals.includes(key)) continue
    options.push([flags(key, field), annotate(field.d, defaultNote(field) ?? (isRequired(field) ? 'required' : ''))])
  }
  sections.push(section('Options', [...options, ...GLOBAL_OPTIONS]))

  const outputs = Object.entries(spec.outputs ?? {}).map(([key, field]): Row => [
    key,
    annotate(field.d, typeLabel(field.kind)),
  ])
  if (outputs.length > 0) sections.push(section('Output', outputs))

  return sections.join('\n\n')
}

/** Usage token for a positional: `<name>`, `[name]` or `[name...]`. */
const token = (key: string, field: InputField | undefined): string => {
  if (field === undefined) return `<${key}>`
  if (isList(field.kind)) return `[${key}...]`
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
  if (isBoolFlag(field.kind)) return column
  const label = field.values ? field.values.join('|') : itemOf(field.kind).type
  return `${column} <${label}${isList(field.kind) ? '...' : ''}>`
}

/** What a field accepts: its declared choices, else its type. */
const valueLabel = (field: InputField): string => (field.values ? field.values.join('|') : typeLabel(field.kind))

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
