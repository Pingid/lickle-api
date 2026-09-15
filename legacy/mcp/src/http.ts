import { INVALID_REQUEST, JSONRPC_VERSION, PARSE_ERROR, type JSONRPCResponse } from './types.ts'
import type { Dispatch } from './server.ts'

/**
 * Serve MCP over Streamable HTTP: each message is a POST to a single endpoint,
 * answered with a JSON object.
 *
 * Built on web-standard `Request`/`Response` so it runs on Node, Deno, Bun and
 * workers without a framework. Request-scoped SSE streaming and validation of
 * headers mirrored from the body are not implemented — this package only ever
 * answers a request, and every response fits in one JSON object.
 */
export const httpHandler =
  (dispatch: Dispatch) =>
  async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: ALLOW })

    let message: unknown
    try {
      message = await request.json()
    } catch {
      return json(fail(PARSE_ERROR, 'invalid JSON'), 400)
    }

    const response = await dispatch(message)
    // A notification has no response; the exchange is still a success.
    if (response === undefined) return new Response(null, { status: 202 })
    if ('error' in response && response.error.code === INVALID_REQUEST) return json(response, 400)
    return json(response)
  }

const ALLOW = { Allow: 'POST' }

const json = (body: JSONRPCResponse, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const fail = (code: number, message: string): JSONRPCResponse => ({
  jsonrpc: JSONRPC_VERSION,
  id: null,
  error: { code, message },
})
