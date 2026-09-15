import type { Dispatch } from './server.ts'
import { INVALID_REQUEST, JSONRPC_VERSION, PARSE_ERROR, type JSONRPCResponse } from './wire.ts'

/**
 * Serve MCP over Streamable HTTP: each message is a POST to a single endpoint,
 * answered with a JSON object.
 *
 * Built on web-standard `Request`/`Response` so it runs on Node, Deno, Bun and
 * workers without a framework. It answers once and closes, so it passes no
 * `emit` and a long call simply stays quiet until it is done.
 *
 * It implements none of the transport's security requirements — no `Origin`
 * validation, no protection against DNS rebinding, no checking of headers
 * mirrored from the body. Putting this on a public port is the caller's
 * business, and needs a layer in front of it.
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
