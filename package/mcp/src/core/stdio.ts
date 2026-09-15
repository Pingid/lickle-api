import type { Dispatch, Emit } from './server.ts'
import { JSONRPC_VERSION, PARSE_ERROR, type JSONRPCNotification, type JSONRPCResponse } from './wire.ts'

/**
 * The byte streams the stdio transport rides on, narrowed to what is used so
 * tests can pass plain objects instead of real process streams.
 */
export interface StdioIO {
  input: AsyncIterable<string | Uint8Array>
  write: (chunk: string) => void
}

/**
 * Serve MCP over newline-delimited JSON-RPC, the stdio framing from the spec.
 *
 * Resolves when the input ends, so a caller can simply await it — which is what
 * keeps an `mcp` subcommand alive for as long as its client is attached.
 *
 * Nothing but protocol frames may reach the output stream: anything else
 * corrupts the session. Diagnostics belong on stderr.
 */
export const serveStdio = async (dispatch: Dispatch, io: Partial<StdioIO> = {}): Promise<void> => {
  const input = io.input ?? process.stdin
  const write = io.write ?? ((chunk: string) => void process.stdout.write(chunk))

  const send = (message: JSONRPCResponse | JSONRPCNotification) => write(`${JSON.stringify(message)}\n`)

  // A chunk is not a message: one can split a message, or carry several.
  let buffer = ''
  for await (const chunk of input) {
    buffer += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)

    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      await handle(line, dispatch, send)
      newline = buffer.indexOf('\n')
    }
  }

  // A final message with no trailing newline still counts.
  await handle(buffer, dispatch, send)
}

const handle = async (
  line: string,
  dispatch: Dispatch,
  send: (m: JSONRPCResponse | JSONRPCNotification) => void,
): Promise<void> => {
  if (line.trim() === '') return

  let message: unknown
  try {
    message = JSON.parse(line)
  } catch {
    send({ jsonrpc: JSONRPC_VERSION, id: null, error: { code: PARSE_ERROR, message: 'invalid JSON' } })
    return
  }

  // This transport interleaves, so a long call can say how it is going on the
  // same stream before its result lands.
  const emit: Emit = (notification) => send(notification)
  const response = await dispatch(message, emit)
  if (response !== undefined) send(response)
}
