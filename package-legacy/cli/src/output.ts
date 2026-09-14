import { outputField, outputFields } from '@lickle/legacy-api'
import type { Operation } from '@lickle/legacy-api'

export const FORMATS = ['text', 'json'] as const

export type Format = (typeof FORMATS)[number]

export const isFormat = (v: string): v is Format => (FORMATS as readonly string[]).includes(v)

/**
 * Render a command's result for the terminal.
 *
 * `json` emits the value verbatim. `text` emits one `key: value` line per field,
 * ordered by the operation so output is stable regardless of insertion order —
 * or the bare value when the operation declares a single unnamed output, which
 * is what a document needs: a completion script has no field name to print.
 *
 * A command with no declared outputs renders to the empty string, which the
 * runner prints as nothing at all.
 */
export const render = (value: unknown, outputs: Operation['outputs'], format: Format): string => {
  if (format === 'json') return value === undefined ? '' : JSON.stringify(value, null, 2)
  if (value === undefined || value === null) return ''

  if (outputField(outputs) !== undefined) return Array.isArray(value) ? value.map(scalar).join('\n') : String(value)

  if (typeof value !== 'object') return String(value)

  const record = value as Record<string, unknown>
  const fields = outputFields(outputs) ?? {}
  const keys = [...new Set([...Object.keys(fields), ...Object.keys(record)])].filter((k) => record[k] !== undefined)

  const width = Math.max(0, ...keys.filter((k) => !Array.isArray(record[k])).map((k) => k.length))

  const lines: string[] = []
  for (const key of keys) {
    const v = record[key]
    if (Array.isArray(v)) {
      lines.push(`${key}:`)
      for (const item of v) lines.push(`  - ${scalar(item)}`)
    } else {
      lines.push(`${`${key}:`.padEnd(width + 1)} ${scalar(v)}`)
    }
  }
  return lines.join('\n')
}

/** Render a thrown value as the CLI's error output, honouring the chosen format. */
export const renderError = (err: unknown, format: Format): string => {
  const message = err instanceof Error ? err.message : String(err)
  return format === 'json' ? JSON.stringify({ error: { message } }, null, 2) : `error: ${message}`
}

const scalar = (v: unknown): string => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))
