import type { CallToolResult } from './types.ts'

/**
 * Map a command's return value onto a tool result.
 *
 * A spec that declares `outputs` gets `structuredContent` plus a text rendering
 * of the same data, so clients that ignore structured content still see it.
 */
export const toolResult = (value: unknown, hasOutputs: boolean): CallToolResult => {
  if (value === undefined || value === null) return { content: [{ type: 'text', text: 'Done.' }] }

  if (hasOutputs && typeof value === 'object')
    return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value }

  const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
  return { content: [{ type: 'text', text }] }
}

/**
 * Map a thrown value onto a tool result.
 *
 * Failures from the tool are reported in the result, not as a protocol error —
 * the schema is explicit that otherwise the model cannot see the failure and
 * self-correct.
 */
export const errorResult = (err: unknown): CallToolResult => ({
  content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
  isError: true,
})
